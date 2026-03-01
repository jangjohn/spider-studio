mod db;
mod scheduler;

use rust_xlsxwriter::Workbook;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderPair {
    pub id: String,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScraperField {
    pub id: String,
    pub name: String,
    pub selector: String,
    pub data_type: String,
    pub cleaning_rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginationConfig {
    pub mode: String,
    pub next_button_selector: Option<String>,
    pub max_pages: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSettings {
    pub delay_between_requests: f64,
    pub retry_on_failure: u32,
    pub respect_robots_txt: bool,
    pub user_agent: String,
    pub custom_user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScraperConfig {
    pub url: String,
    pub method: String,
    pub headers: Vec<HeaderPair>,
    pub fields: Vec<ScraperField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_container_selector: Option<String>,
    pub pagination: PaginationConfig,
    pub run_settings: RunSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSchedule {
    pub frequency: String,
    pub time: Option<String>,
    pub day: Option<i32>,
    pub output_folder: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunHistoryEntry {
    pub id: i64,
    pub project_id: String,
    pub timestamp: String,
    pub rows_collected: i64,
    pub output_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScraperProject {
    pub id: String,
    pub name: String,
    pub url: String,
    pub config: ScraperConfig,
    pub last_run_at: Option<String>,
    pub last_row_count: Option<u32>,
    pub field_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule: Option<ProjectSchedule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ScrapeProgressPayload {
    pub page: u32,
    pub total_pages: u32,
    pub rows: u32,
    pub speed: f64,
    pub eta_seconds: u32,
    pub status: String,
}

struct ScrapeState {
    stop_file: Mutex<Option<std::path::PathBuf>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub include_headers: bool,
    pub auto_open_after_export: bool,
    pub split_into_files_of: Option<u32>,
    pub filename: String,
}

#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if status.is_success() {
        Ok(text)
    } else {
        Err(format!("HTTP {}: {}", status, &text[..text.len().min(200)]))
    }
}

fn config_to_python(config: &ScraperConfig) -> String {
    serde_json::to_string(config).unwrap_or_default()
}

#[tauri::command]
async fn run_scrape(config: ScraperConfig, app: tauri::AppHandle) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    eprintln!("[run_scrape] URL: {}", config.url);
    eprintln!("[run_scrape] Fields: {} configured", config.fields.len());
    for (i, f) in config.fields.iter().enumerate() {
        eprintln!("[run_scrape]   Field {}: name={:?} selector={:?}", i, f.name, f.selector);
    }
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let scraper_path = resource_dir.join("scraper").join("scraper.py");

    #[cfg(debug_assertions)]
    let scraper_path = {
        let exe_dir = std::env::current_exe().map_err(|e| e.to_string())?;
        let dev_path = exe_dir
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.join("scraper").join("scraper.py"));
        dev_path.unwrap_or(scraper_path)
    };

    let config_json = config_to_python(&config);

    let (config_arg, config_value) = {
        let path = std::env::temp_dir().join(format!("spider_config_{}.json", std::process::id()));
        match std::fs::write(&path, &config_json) {
            Ok(_) => ("--config-file".to_string(), path.to_string_lossy().to_string()),
            Err(_) => ("--config".to_string(), config_json),
        }
    };

    let stop_file = std::env::temp_dir().join(format!("spider_stop_{}.flag", std::process::id()));
    let stop_file_str = stop_file.to_string_lossy().to_string();
    if let Some(state) = app.try_state::<ScrapeState>() {
        *state.stop_file.lock().unwrap() = Some(stop_file.clone());
    }

    let (scraper_arg, proj_root) = if !scraper_path.exists() {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let proj_root = std::path::Path::new(&manifest_dir).parent().unwrap_or(std::path::Path::new("."));
        let dev_scraper = proj_root.join("scraper").join("scraper.py");
        let arg = if dev_scraper.exists() {
            dev_scraper.to_string_lossy().to_string()
        } else {
            "scraper/scraper.py".to_string()
        };
        (arg, proj_root.to_path_buf())
    } else {
        let proj_root = scraper_path
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();
        (scraper_path.to_string_lossy().to_string(), proj_root)
    };

    let app_handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut child = std::process::Command::new("python")
            .args([&scraper_arg, &config_arg, &config_value])
            .current_dir(&proj_root)
            .env("SPIDER_STOP_FILE", &stop_file_str)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to run Python: {}. Install Python + playwright: pip install playwright && playwright install", e))?;

        let stdout = child.stdout.take().ok_or("No stdout")?;
        let reader = BufReader::new(stdout);
        let mut data: Vec<HashMap<String, serde_json::Value>> = vec![];

        for line in reader.lines() {
            let line = line.map_err(|e| e.to_string())?;
            if let Some(msg) = line.strip_prefix("ERROR:") {
                return Err(msg.trim().to_string());
            }
            if let Some(json_str) = line.strip_prefix("PROGRESS:") {
                if let Ok(prog) = serde_json::from_str::<ScrapeProgressPayload>(json_str) {
                    let _ = app_handle.emit("scrape-progress", &prog);
                }
            }
            if line.starts_with("DATA:") {
                let json_str = line.strip_prefix("DATA:").unwrap_or("[]");
                data = serde_json::from_str(json_str).unwrap_or_default();
                eprintln!("[run_scrape] Parsed {} rows from DATA line", data.len());
                break;
            }
        }

        Ok(data)
    })
    .await
    .map_err(|e| format!("Spawn failed: {}", e))??;

    if let Some(state) = app.try_state::<ScrapeState>() {
        *state.stop_file.lock().unwrap() = None;
    }
    let _ = std::fs::remove_file(&stop_file);

    Ok(result)
}

#[tauri::command]
async fn stop_scrape(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<ScrapeState>() {
        let path = state.stop_file.lock().unwrap().clone();
        if let Some(p) = path {
            let _ = std::fs::write(&p, "1");
            eprintln!("[stop_scrape] Wrote stop file: {:?}", p);
        }
    }
    Ok(())
}

#[tauri::command]
async fn list_projects(app: tauri::AppHandle) -> Result<Vec<ScraperProject>, String> {
    db::list_projects(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_project(project: ScraperProject, app: tauri::AppHandle) -> Result<(), String> {
    db::save_project(&app, &project).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_run_history(project_id: String, app: tauri::AppHandle) -> Result<Vec<RunHistoryEntry>, String> {
    db::get_run_history(&app, &project_id).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareRunsResult {
    pub added: Vec<HashMap<String, serde_json::Value>>,
    pub removed: Vec<HashMap<String, serde_json::Value>>,
    pub changed: Vec<CompareChangedRow>,
    pub unchanged: Vec<HashMap<String, serde_json::Value>>,
    pub headers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareChangedRow {
    pub old: HashMap<String, serde_json::Value>,
    pub new: HashMap<String, serde_json::Value>,
    #[serde(alias = "changed_fields")]
    pub changed_fields: Vec<String>,
}

#[tauri::command]
async fn compare_runs(
    file_a: String,
    file_b: String,
    key_field: Option<String>,
    app: tauri::AppHandle,
) -> Result<CompareRunsResult, String> {
    let (scraper_path, proj_root) = get_scraper_path(&app);
    let scraper_arg = if scraper_path.exists() {
        scraper_path.to_string_lossy().to_string()
    } else {
        "scraper/scraper.py".to_string()
    };

    let mut cmd = std::process::Command::new("python");
    cmd.args([
        &scraper_arg,
        "--compare",
        "--compare-file-a",
        &file_a,
        "--compare-file-b",
        &file_b,
    ])
    .current_dir(&proj_root);

    if let Some(ref k) = key_field {
        cmd.args(["--compare-key", k]);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run compare: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Compare failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(msg) = line.strip_prefix("ERROR:") {
            return Err(msg.trim().to_string());
        }
        if let Some(json_str) = line.strip_prefix("COMPARE:") {
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "snake_case")]
            struct RawCompare {
                added: Vec<HashMap<String, serde_json::Value>>,
                removed: Vec<HashMap<String, serde_json::Value>>,
                changed: Vec<RawChanged>,
                unchanged: Vec<HashMap<String, serde_json::Value>>,
                headers: Vec<String>,
            }
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "snake_case")]
            struct RawChanged {
                old: HashMap<String, serde_json::Value>,
                new: HashMap<String, serde_json::Value>,
                changed_fields: Vec<String>,
            }
            let raw: RawCompare = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
            let changed = raw
                .changed
                .into_iter()
                .map(|r| CompareChangedRow {
                    old: r.old,
                    new: r.new,
                    changed_fields: r.changed_fields,
                })
                .collect();
            return Ok(CompareRunsResult {
                added: raw.added,
                removed: raw.removed,
                changed,
                unchanged: raw.unchanged,
                headers: raw.headers,
            });
        }
    }
    Err("No COMPARE output from Python".to_string())
}

#[tauri::command]
async fn export_compare_diff(
    result: CompareRunsResult,
    filename: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let dir = app.path().document_dir().map_err(|e| e.to_string())?;
    let spider_dir = dir.join("Spider Studio");
    std::fs::create_dir_all(&spider_dir).map_err(|e| e.to_string())?;
    let path = spider_dir.join(format!("{}.csv", filename));

    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;

    let headers: Vec<String> = ["_status", "_old_new"]
        .iter()
        .map(|s| s.to_string())
        .chain(result.headers.clone())
        .collect();
    wtr.write_record(&headers).map_err(|e| e.to_string())?;

    let row_to_values = |row: &HashMap<String, serde_json::Value>| {
        result
            .headers
            .iter()
            .map(|h| {
                row.get(h)
                    .map(|v| match v {
                        serde_json::Value::Null => String::new(),
                        serde_json::Value::String(s) => s.clone(),
                        other => other.to_string(),
                    })
                    .unwrap_or_default()
            })
            .collect::<Vec<String>>()
    };

    for row in &result.added {
        let mut rec = vec!["new".to_string(), "new".to_string()];
        rec.extend(row_to_values(row));
        wtr.write_record(&rec).map_err(|e| e.to_string())?;
    }
    for row in &result.removed {
        let mut rec = vec!["removed".to_string(), "old".to_string()];
        rec.extend(row_to_values(row));
        wtr.write_record(&rec).map_err(|e| e.to_string())?;
    }
    for cr in &result.changed {
        let mut rec_old = vec!["changed".to_string(), "old".to_string()];
        rec_old.extend(row_to_values(&cr.old));
        wtr.write_record(&rec_old).map_err(|e| e.to_string())?;
        let mut rec_new = vec!["changed".to_string(), "new".to_string()];
        rec_new.extend(row_to_values(&cr.new));
        wtr.write_record(&rec_new).map_err(|e| e.to_string())?;
    }
    for row in &result.unchanged {
        let mut rec = vec!["unchanged".to_string(), "".to_string()];
        rec.extend(row_to_values(row));
        wtr.write_record(&rec).map_err(|e| e.to_string())?;
    }

    wtr.flush().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewScreenshotResult {
    pub base64: String,
    pub width: u32,
    pub height: u32,
}

pub(crate) fn get_scraper_path(app: &tauri::AppHandle) -> (std::path::PathBuf, std::path::PathBuf) {
    let resource_dir = app.path().resource_dir().unwrap_or_else(|_| std::path::PathBuf::new());
    let scraper_path = resource_dir.join("scraper").join("scraper.py");

    #[cfg(debug_assertions)]
    {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let manifest_path = std::path::Path::new(&manifest_dir);
        let proj_root = manifest_path.parent().unwrap_or(std::path::Path::new("."));
        let dev_scraper = proj_root.join("scraper").join("scraper.py");
        let path = if dev_scraper.exists() {
            dev_scraper
        } else {
            scraper_path
        };
        return (path, proj_root.to_path_buf());
    }

    #[cfg(not(debug_assertions))]
    {
        let proj_root = scraper_path
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();
        (scraper_path, proj_root)
    }
}

#[tauri::command]
async fn preview_screenshot(url: String, app: tauri::AppHandle) -> Result<PreviewScreenshotResult, String> {
    let (scraper_path, proj_root) = get_scraper_path(&app);

    let scraper_arg = if scraper_path.exists() {
        scraper_path.to_string_lossy().to_string()
    } else {
        let dev_path = std::path::Path::new("scraper").join("scraper.py");
        dev_path.to_string_lossy().to_string()
    };

    let output = std::process::Command::new("python")
        .args([
            &scraper_arg,
            "--screenshot",
            "--screenshot-url",
            &url,
        ])
        .current_dir(&proj_root)
        .output()
        .map_err(|e| format!("Failed to run Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Screenshot failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(json_str) = line.strip_prefix("SCREENSHOT:") {
            let parsed: PreviewScreenshotResult =
                serde_json::from_str(json_str).map_err(|e| format!("Parse error: {}", e))?;
            return Ok(parsed);
        }
        if let Some(msg) = line.strip_prefix("ERROR:") {
            return Err(msg.trim().to_string());
        }
    }
    Err("No screenshot output from Python".to_string())
}

#[tauri::command]
async fn get_element_selector(
    url: String,
    x: u32,
    y: u32,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let (scraper_path, proj_root) = get_scraper_path(&app);

    let scraper_arg = if scraper_path.exists() {
        scraper_path.to_string_lossy().to_string()
    } else {
        std::path::Path::new("scraper")
            .join("scraper.py")
            .to_string_lossy()
            .to_string()
    };

    let output = std::process::Command::new("python")
        .args([
            &scraper_arg,
            "--selector-at-point",
            "--selector-url",
            &url,
            "--selector-x",
            &x.to_string(),
            "--selector-y",
            &y.to_string(),
        ])
        .current_dir(&proj_root)
        .output()
        .map_err(|e| format!("Failed to run Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Selector lookup failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(json_str) = line.strip_prefix("SELECTOR:") {
            let sel: Option<String> = serde_json::from_str(json_str).unwrap_or(None);
            return Ok(sel.unwrap_or_default());
        }
        if let Some(msg) = line.strip_prefix("ERROR:") {
            return Err(msg.trim().to_string());
        }
    }
    Err("No selector output from Python".to_string())
}

#[tauri::command]
async fn count_selector_matches(
    url: String,
    selector: String,
    app: tauri::AppHandle,
) -> Result<u32, String> {
    let (scraper_path, proj_root) = get_scraper_path(&app);

    let scraper_arg = if scraper_path.exists() {
        scraper_path.to_string_lossy().to_string()
    } else {
        std::path::Path::new("scraper")
            .join("scraper.py")
            .to_string_lossy()
            .to_string()
    };

    let output = std::process::Command::new("python")
        .args([
            &scraper_arg,
            "--count-selector",
            "--count-url",
            &url,
            "--count-sel",
            &selector,
        ])
        .current_dir(&proj_root)
        .output()
        .map_err(|e| format!("Failed to run Python: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(n_str) = line.strip_prefix("COUNT:") {
            let n: u32 = n_str.trim().parse().unwrap_or(0);
            return Ok(n);
        }
    }
    Ok(0)
}

#[tauri::command]
async fn export_data(
    format: String,
    options: ExportOptions,
    data: Vec<HashMap<String, serde_json::Value>>,
    path_override: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let ext = match format.as_str() {
        "CSV" => "csv",
        "JSON" => "json",
        "XLSX" => "xlsx",
        _ => "csv",
    };
    let path = if let Some(p) = path_override {
        std::path::PathBuf::from(p)
    } else {
        let dir = app.path().document_dir().map_err(|e| e.to_string())?;
        let spider_dir = dir.join("Spider Studio");
        std::fs::create_dir_all(&spider_dir).map_err(|e| e.to_string())?;
        spider_dir.join(format!("{}.{}", options.filename, ext))
    };

    match format.as_str() {
        "CSV" => {
            let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;
            if options.include_headers && !data.is_empty() {
                let headers: Vec<String> = data[0].keys().cloned().collect();
                wtr.write_record(&headers).map_err(|e| e.to_string())?;
            }
            for row in &data {
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
        }
        "JSON" => {
            let content = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
            std::fs::write(&path, content).map_err(|e| e.to_string())?;
        }
        "XLSX" => {
            let mut workbook = Workbook::new();
            let worksheet = workbook.add_worksheet();
            let headers: Vec<String> = if data.is_empty() {
                vec![]
            } else {
                data[0].keys().cloned().collect()
            };
            if options.include_headers && !headers.is_empty() {
                for (col, h) in headers.iter().enumerate() {
                    worksheet.write(0u32, col as u16, h.as_str()).map_err(|e| e.to_string())?;
                }
            }
            let start_row = if options.include_headers && !headers.is_empty() { 1 } else { 0 };
            for (row_idx, row) in data.iter().enumerate() {
                let r = start_row + row_idx as u32;
                for (col_idx, key) in headers.iter().enumerate() {
                    let val = row.get(key);
                    let cell_val: String = match val {
                        None => String::new(),
                        Some(serde_json::Value::Null) => String::new(),
                        Some(serde_json::Value::String(s)) => s.clone(),
                        Some(other) => other.to_string(),
                    };
                    worksheet.write(r, col_idx as u16, cell_val.as_str()).map_err(|e| e.to_string())?;
                }
            }
            workbook.save(&path).map_err(|e| e.to_string())?;
        }
        _ => {}
    }

    if options.auto_open_after_export {
        let _ = open::that(&path);
    }

    let path_str = path.to_string_lossy().to_string();
    let _ = db::add_export(
        &app,
        &options.filename,
        &format,
        data.len() as u32,
        &path_str,
    );
    Ok(path_str)
}

#[tauri::command]
async fn list_exports(app: tauri::AppHandle) -> Result<Vec<db::ExportRecord>, String> {
    db::list_exports(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_export(id: i64, app: tauri::AppHandle) -> Result<(), String> {
    db::delete_export(&app, id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_export_file(file_path: String) -> Result<(), String> {
    open::that(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_export_folder(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if let Some(parent) = path.parent() {
        open::that(parent).map_err(|e| e.to_string())
    } else {
        Err("Invalid path".to_string())
    }
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<std::collections::HashMap<String, String>, String> {
    let keys = [
        "default_export_folder",
        "default_export_format",
        "default_delay_between_requests",
        "default_max_pages",
        "default_user_agent",
        "theme",
    ];
    let mut map = std::collections::HashMap::new();
    for k in keys {
        if let Some(v) = db::get_setting(&app, k).map_err(|e| e.to_string())? {
            map.insert(k.to_string(), v);
        }
    }
    Ok(map)
}

#[tauri::command]
async fn save_settings(
    settings: std::collections::HashMap<String, String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    for (k, v) in settings {
        db::save_setting(&app, &k, &v).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            fetch_url,
            run_scrape,
            stop_scrape,
            list_projects,
            save_project,
            export_data,
            list_exports,
            delete_export,
            open_export_file,
            open_export_folder,
            get_settings,
            save_settings,
            preview_screenshot,
            get_element_selector,
            count_selector_matches,
            get_run_history,
            compare_runs,
            export_compare_diff,
        ])
        .manage(ScrapeState {
            stop_file: Mutex::new(None),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            db::init_db(&app.handle()).ok();
            scheduler::start_scheduler(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
