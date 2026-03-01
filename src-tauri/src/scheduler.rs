//! Background scheduler for running scrapes on projects with active schedules.

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use chrono::{Datelike, Timelike};
use tauri::{AppHandle, Emitter};

use crate::db;
use crate::{config_to_python, get_scraper_path, ScraperConfig, ScraperProject};

static SCHEDULER_RUNNING: AtomicBool = AtomicBool::new(false);

fn save_data_to_csv(data: &[HashMap<String, serde_json::Value>], path: &Path) -> Result<(), String> {
    let mut wtr = csv::Writer::from_path(path).map_err(|e| e.to_string())?;
    if !data.is_empty() {
        let headers: Vec<String> = data[0].keys().cloned().collect();
        wtr.write_record(&headers).map_err(|e| e.to_string())?;
    }
    for row in data {
        let values: Vec<String> = row
            .values()
            .map(|v| match v {
                serde_json::Value::Null => String::new(),
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            })
            .collect();
        wtr.write_record(&values).map_err(|e| e.to_string())?;
    }
    wtr.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn run_scrape_sync(
    app: &AppHandle,
    config: &ScraperConfig,
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let (scraper_path, proj_root) = get_scraper_path(app);
    let scraper_arg = if scraper_path.exists() {
        scraper_path.to_string_lossy().to_string()
    } else {
        "scraper/scraper.py".to_string()
    };

    let config_json = config_to_python(config);
    let (config_arg, config_value) = {
        let path = std::env::temp_dir().join(format!("spider_config_sched_{}.json", std::process::id()));
        match std::fs::write(&path, &config_json) {
            Ok(_) => ("--config-file".to_string(), path.to_string_lossy().to_string()),
            Err(_) => ("--config".to_string(), config_json),
        }
    };

    let output = std::process::Command::new("python")
        .args([&scraper_arg, &config_arg, &config_value])
        .current_dir(&proj_root)
        .output()
        .map_err(|e| format!("Failed to run Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Scraper failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines().rev() {
        if let Some(msg) = line.strip_prefix("ERROR:") {
            return Err(msg.trim().to_string());
        }
        if line.starts_with("DATA:") {
            let json_str = line.strip_prefix("DATA:").unwrap_or("[]");
            return serde_json::from_str(json_str).map_err(|e| e.to_string());
        }
    }
    Ok(vec![])
}

fn is_scheduled_run_due(project: &ScraperProject) -> bool {
    let schedule = match &project.schedule {
        Some(s) if s.enabled && s.frequency != "none" => s,
        _ => return false,
    };

    let now = chrono::Local::now();
    let current_minute = now.hour() as i32 * 60 + now.minute() as i32;
    let weekday = now.weekday().num_days_from_monday() as i32;

    match schedule.frequency.as_str() {
        "hourly" => {
            let last = project.last_run_at.as_ref().and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(s)
                    .ok()
                    .map(|t| t.with_timezone(&chrono::Local))
            });
            if let Some(t) = last {
                let elapsed = now.signed_duration_since(t);
                elapsed.num_minutes() >= 55
            } else {
                true
            }
        }
        "daily" => {
            if let Some(ref t) = schedule.time {
                let parts: Vec<&str> = t.split(':').collect();
                if parts.len() >= 2 {
                    let sched_h: i32 = parts[0].parse().unwrap_or(0);
                    let sched_m: i32 = parts[1].parse().unwrap_or(0);
                    let sched_minute = sched_h * 60 + sched_m;
                    return (current_minute - sched_minute).abs() < 2;
                }
            }
            false
        }
        "weekly" => {
            let day_match = schedule.day.map(|d| d == weekday).unwrap_or(false);
            if !day_match {
                return false;
            }
            if let Some(ref t) = schedule.time {
                let parts: Vec<&str> = t.split(':').collect();
                if parts.len() >= 2 {
                    let sched_h: i32 = parts[0].parse().unwrap_or(0);
                    let sched_m: i32 = parts[1].parse().unwrap_or(0);
                    let sched_minute = sched_h * 60 + sched_m;
                    return (current_minute - sched_minute).abs() < 2;
                }
            }
            false
        }
        _ => false,
    }
}

fn run_scheduled_project(app: AppHandle, project: ScraperProject) {
    let schedule = match &project.schedule {
        Some(s) => s.clone(),
        None => return,
    };
    let output_folder = match &schedule.output_folder {
        Some(f) if !f.is_empty() => f.clone(),
        _ => return,
    };

    let result = run_scrape_sync(&app, &project.config);
    let timestamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let filename = format!("{}_{}.csv", project.name.replace(' ', "_"), timestamp);
    let output_path = Path::new(&output_folder).join(&filename);

    match result {
        Ok(data) => {
            let row_count = data.len() as u32;
            if let Err(e) = std::fs::create_dir_all(&output_folder) {
                eprintln!("[scheduler] Failed to create output dir: {}", e);
            } else if let Err(e) = save_data_to_csv(&data, &output_path) {
                eprintln!("[scheduler] Failed to save CSV: {}", e);
                let _ = db::add_run_history(
                    &app,
                    &project.id,
                    &chrono::Utc::now().to_rfc3339(),
                    row_count,
                    None,
                    "error",
                );
            } else {
                let path_str = output_path.to_string_lossy().to_string();
                let _ = db::update_project_last_run(
                    &app,
                    &project.id,
                    &chrono::Utc::now().to_rfc3339(),
                    row_count,
                );
                let _ = db::add_run_history(
                    &app,
                    &project.id,
                    &chrono::Utc::now().to_rfc3339(),
                    row_count,
                    Some(&path_str),
                    "success",
                );

                let _ = app.emit("scheduled-run-complete", (project.name.clone(), row_count));
            }
        }
        Err(e) => {
            eprintln!("[scheduler] Scrape failed for {}: {}", project.name, e);
            let _ = db::add_run_history(
                &app,
                &project.id,
                &chrono::Utc::now().to_rfc3339(),
                0,
                None,
                &format!("error: {}", e),
            );
        }
    }
}

pub fn start_scheduler(app: AppHandle) {
    if SCHEDULER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    thread::spawn(move || {
        loop {
            if let Ok(projects) = db::get_projects_with_schedule(&app) {
                for project in projects {
                    if is_scheduled_run_due(&project) {
                        run_scheduled_project(app.clone(), project);
                        thread::sleep(Duration::from_secs(65));
                    }
                }
            }
            thread::sleep(Duration::from_secs(60));
        }
    });
}
