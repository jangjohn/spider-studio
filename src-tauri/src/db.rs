use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::{ProjectSchedule, RunHistoryEntry, ScraperConfig, ScraperProject};

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("spider_studio.db"))
}

fn default_config() -> ScraperConfig {
    ScraperConfig {
        url: String::new(),
        method: "GET".to_string(),
        headers: vec![],
        fields: vec![],
        row_container_selector: None,
        pagination: crate::PaginationConfig {
            mode: "None".to_string(),
            next_button_selector: None,
            max_pages: None,
        },
        run_settings: crate::RunSettings {
            delay_between_requests: 1.0,
            retry_on_failure: 3,
            respect_robots_txt: true,
            user_agent: "Chrome".to_string(),
            custom_user_agent: None,
        },
    }
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            config TEXT NOT NULL,
            last_run_at TEXT,
            last_row_count INTEGER,
            field_count INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Migrate: add schedule columns if missing
    let has_schedule = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name='schedule_frequency'")
        .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
        .unwrap_or(0);
    if has_schedule == 0 {
        for col in [
            "ALTER TABLE projects ADD COLUMN schedule_frequency TEXT DEFAULT 'none'",
            "ALTER TABLE projects ADD COLUMN schedule_time TEXT",
            "ALTER TABLE projects ADD COLUMN schedule_day INTEGER",
            "ALTER TABLE projects ADD COLUMN schedule_output_folder TEXT",
            "ALTER TABLE projects ADD COLUMN schedule_enabled INTEGER DEFAULT 0",
        ] {
            let _ = conn.execute(col, []);
        }
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS run_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            rows_collected INTEGER NOT NULL,
            output_path TEXT,
            status TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_run_history_project ON run_history(project_id)",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS exports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            format TEXT NOT NULL,
            rows INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            exported_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn get_conn(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    Connection::open(path).map_err(|e| e.to_string())
}

pub fn list_projects(app: &AppHandle) -> Result<Vec<ScraperProject>, String> {
    let conn = get_conn(app)?;
    let sql = "SELECT id, name, url, config, last_run_at, last_row_count, field_count,
               schedule_frequency, schedule_time, schedule_day, schedule_output_folder, schedule_enabled
               FROM projects ORDER BY created_at DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            let config: ScraperConfig = serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_else(|_| default_config());
            let schedule = ProjectSchedule {
                frequency: row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "none".to_string()),
                time: row.get(8)?,
                day: row.get(9)?,
                output_folder: row.get(10)?,
                enabled: row.get::<_, Option<i64>>(11)?.unwrap_or(0) != 0,
            };
            Ok(ScraperProject {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                config,
                last_run_at: row.get(4)?,
                last_row_count: row.get(5)?,
                field_count: row.get(6)?,
                schedule: Some(schedule),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(projects)
}

pub fn save_project(app: &AppHandle, project: &ScraperProject) -> Result<(), String> {
    let conn = get_conn(app)?;
    let config_json = serde_json::to_string(&project.config).map_err(|e| e.to_string())?;
    let (freq, time, day, folder, enabled) = project
        .schedule
        .as_ref()
        .map(|s| {
            (
                s.frequency.as_str(),
                s.time.as_deref(),
                s.day,
                s.output_folder.as_deref(),
                if s.enabled { 1i32 } else { 0 },
            )
        })
        .unwrap_or(("none", None, None, None, 0));

    conn.execute(
        "INSERT OR REPLACE INTO projects (id, name, url, config, last_run_at, last_row_count, field_count,
          schedule_frequency, schedule_time, schedule_day, schedule_output_folder, schedule_enabled)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            &project.id,
            &project.name,
            &project.url,
            &config_json,
            project.last_run_at.as_deref(),
            project.last_row_count,
            project.field_count,
            freq,
            time,
            day,
            folder,
            enabled,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn save_project_legacy(app: &AppHandle, project: &ScraperProject) -> Result<(), String> {
    let conn = get_conn(app)?;
    let config_json = serde_json::to_string(&project.config).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO projects (id, name, url, config, last_run_at, last_row_count, field_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            &project.id,
            &project.name,
            &project.url,
            &config_json,
            project.last_run_at.as_deref(),
            project.last_row_count,
            project.field_count,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_project_last_run(
    app: &AppHandle,
    project_id: &str,
    last_run_at: &str,
    last_row_count: u32,
) -> Result<(), String> {
    let conn = get_conn(app)?;
    conn.execute(
        "UPDATE projects SET last_run_at = ?1, last_row_count = ?2 WHERE id = ?3",
        rusqlite::params![last_run_at, last_row_count as i64, project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_run_history(
    app: &AppHandle,
    project_id: &str,
    timestamp: &str,
    rows_collected: u32,
    output_path: Option<&str>,
    status: &str,
) -> Result<(), String> {
    let conn = get_conn(app)?;
    conn.execute(
        "INSERT INTO run_history (project_id, timestamp, rows_collected, output_path, status) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![project_id, timestamp, rows_collected as i64, output_path, status],
    )
    .map_err(|e| e.to_string())?;

    // Prune: keep only last 10 per project
    let to_delete: Vec<i64> = conn
        .prepare("SELECT id FROM run_history WHERE project_id = ?1 ORDER BY id DESC")
        .map_err(|e| e.to_string())?
        .query_map([project_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .skip(10)
        .collect();
    for id in to_delete {
        let _ = conn.execute("DELETE FROM run_history WHERE id = ?1", [id]);
    }
    Ok(())
}

pub fn get_run_history(app: &AppHandle, project_id: &str) -> Result<Vec<RunHistoryEntry>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT id, project_id, timestamp, rows_collected, output_path, status FROM run_history WHERE project_id = ?1 ORDER BY id DESC LIMIT 10")
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([project_id], |row| {
            Ok(RunHistoryEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                timestamp: row.get(2)?,
                rows_collected: row.get(3)?,
                output_path: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

pub fn get_projects_with_schedule(app: &AppHandle) -> Result<Vec<ScraperProject>, String> {
    let all = list_projects(app)?;
    Ok(all
        .into_iter()
        .filter(|p| {
            p.schedule
                .as_ref()
                .map(|s| s.enabled && s.frequency != "none")
                .unwrap_or(false)
        })
        .collect())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRecord {
    pub id: i64,
    pub filename: String,
    pub format: String,
    pub rows: i64,
    pub file_path: String,
    pub exported_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size: Option<u64>,
}

pub fn add_export(
    app: &AppHandle,
    filename: &str,
    format: &str,
    rows: u32,
    file_path: &str,
) -> Result<(), String> {
    let conn = get_conn(app)?;
    conn.execute(
        "INSERT INTO exports (filename, format, rows, file_path) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![filename, format, rows as i64, file_path],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_exports(app: &AppHandle) -> Result<Vec<ExportRecord>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT id, filename, format, rows, file_path, exported_at FROM exports ORDER BY exported_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ExportRecord {
                id: row.get(0)?,
                filename: row.get(1)?,
                format: row.get(2)?,
                rows: row.get(3)?,
                file_path: row.get(4)?,
                exported_at: row.get(5)?,
                file_size: None,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut records: Vec<ExportRecord> = vec![];
    for r in rows {
        let mut rec = r.map_err(|e| e.to_string())?;
        rec.file_size = std::fs::metadata(&rec.file_path).ok().map(|m| m.len());
        records.push(rec);
    }
    Ok(records)
}

pub fn delete_export(app: &AppHandle, id: i64) -> Result<(), String> {
    let conn = get_conn(app)?;
    conn.execute("DELETE FROM exports WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_setting(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let v: String = row.get(0).map_err(|e| e.to_string())?;
        return Ok(Some(v));
    }
    Ok(None)
}

pub fn save_setting(app: &AppHandle, key: &str, value: &str) -> Result<(), String> {
    let conn = get_conn(app)?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
