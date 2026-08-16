use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const MIGRATION_MARKER: &str = "web-storage-migrated-v1";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStoreSnapshot {
    pub migrated: bool,
    pub entries: HashMap<String, String>,
    pub database_path: String,
    pub workspace_path: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredChapter {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub saved_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredChapterRow {
    project_id: String,
    id: i64,
    title: String,
    content: String,
    saved_at: String,
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(directory.join("inkstone.sqlite3"))
}

fn workspace_path() -> Result<PathBuf, String> {
    let base = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "无法定位用户目录。".to_string())?;
    let path = base.join("Documents").join("墨舟作品");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建作品目录：{error}"))?;
    Ok(path)
}

fn sqlite_path(path: &Path) -> Result<&str, String> {
    path.to_str()
        .ok_or_else(|| "数据库路径包含无效字符。".to_string())
}
fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\0', "").replace('\'', "''"))
}

fn run_sql(path: &Path, sql: &str, as_json: bool) -> Result<String, String> {
    let mut command = Command::new("/usr/bin/sqlite3");
    command.arg("-bail");
    if as_json {
        command.arg("-json");
    }
    let mut child = command
        .arg(sqlite_path(path)?)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("无法启动 SQLite：{error}"))?;
    child
        .stdin
        .take()
        .ok_or_else(|| "无法写入 SQLite。".to_string())?
        .write_all(sql.as_bytes())
        .map_err(|error| format!("无法写入 SQLite：{error}"))?;
    let output = child
        .wait_with_output()
        .map_err(|error| format!("无法读取 SQLite：{error}"))?;
    if !output.status.success() {
        return Err(format!(
            "本地数据库操作失败：{}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    String::from_utf8(output.stdout).map_err(|_| "本地数据库返回了无效文本。".to_string())
}

fn execute(path: &Path, sql: &str) -> Result<(), String> {
    run_sql(path, sql, false).map(|_| ())
}
fn query(path: &Path, sql: &str) -> Result<Vec<Value>, String> {
    let output = run_sql(path, sql, true)?;
    serde_json::from_str(&output).map_err(|error| format!("无法读取本地数据库：{error}"))
}

fn open_database(app: &AppHandle) -> Result<PathBuf, String> {
    let path = database_path(app)?;
    execute(&path, "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS chapters (project_id TEXT NOT NULL, chapter_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY (project_id, chapter_id)); CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id, chapter_id);")?;
    Ok(path)
}

fn has_migrated(path: &Path) -> Result<bool, String> {
    Ok(!query(
        path,
        &format!(
            "SELECT value FROM metadata WHERE key = {}",
            quote(MIGRATION_MARKER)
        ),
    )?
    .is_empty())
}

fn chapter_key_project_id(key: &str) -> Option<String> {
    key.strip_prefix("inkstone.project.")?
        .strip_suffix(".saved-chapters")
        .map(str::to_owned)
}
fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn entry_map(path: &Path) -> Result<HashMap<String, String>, String> {
    let mut entries = HashMap::new();
    for row in query(path, "SELECT key, value FROM entries")? {
        let key = row
            .get("key")
            .and_then(Value::as_str)
            .ok_or_else(|| "本地数据键无效。".to_string())?;
        let value = row
            .get("value")
            .and_then(Value::as_str)
            .ok_or_else(|| "本地数据值无效。".to_string())?;
        entries.insert(key.to_owned(), value.to_owned());
    }
    let rows = query(path, "SELECT project_id AS projectId, chapter_id AS id, title, content, saved_at AS savedAt FROM chapters ORDER BY project_id, chapter_id")?;
    let mut groups: HashMap<String, Vec<StoredChapter>> = HashMap::new();
    for row in rows {
        let row: StoredChapterRow =
            serde_json::from_value(row).map_err(|error| format!("章节数据无效：{error}"))?;
        groups
            .entry(row.project_id)
            .or_default()
            .push(StoredChapter {
                id: row.id,
                title: row.title,
                content: row.content,
                saved_at: row.saved_at,
            });
    }
    for (project_id, chapters) in groups {
        entries.insert(
            format!("inkstone.project.{project_id}.saved-chapters"),
            serde_json::to_string(&chapters).map_err(|error| format!("无法编码章节：{error}"))?,
        );
    }
    Ok(entries)
}

fn project_titles(entries: &HashMap<String, String>) -> HashMap<String, String> {
    entries
        .get("inkstone.projects")
        .and_then(|value| serde_json::from_str::<Value>(value).ok())
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|project| {
            Some((
                project.get("id")?.as_str()?.to_owned(),
                project.get("title")?.as_str()?.to_owned(),
            ))
        })
        .collect()
}

fn write_text_atomic(path: PathBuf, text: String) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, text).map_err(|error| format!("无法写入作品文件：{error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("无法完成作品保存：{error}"))
}

fn project_directory(project_id: &str) -> Result<PathBuf, String> {
    let directory = workspace_path()?.join(project_id.replace(['/', '\\', ':'], "_"));
    fs::create_dir_all(directory.join("chapters"))
        .map_err(|error| format!("无法创建章节目录：{error}"))?;
    fs::create_dir_all(directory.join("backups"))
        .map_err(|error| format!("无法创建备份目录：{error}"))?;
    Ok(directory)
}

fn chapter_markdown(chapter: &StoredChapter) -> String {
    format!(
        "# 第{}章 {}\n\n{}\n",
        chapter.id,
        chapter.title,
        chapter.content.trim_end()
    )
}
fn mirror_chapter(
    project_id: &str,
    project_title: &str,
    chapter: &StoredChapter,
) -> Result<(), String> {
    let directory = project_directory(project_id)?;
    write_text_atomic(
        directory.join("project.json"),
        serde_json::to_string_pretty(
            &json!({ "id": project_id, "title": project_title, "updatedAt": chapter.saved_at }),
        )
        .map_err(|error| format!("无法编码作品信息：{error}"))?
            + "\n",
    )?;
    let markdown = chapter_markdown(chapter);
    write_text_atomic(
        directory
            .join("chapters")
            .join(format!("{:04}.md", chapter.id)),
        markdown.clone(),
    )?;
    write_text_atomic(
        directory
            .join("backups")
            .join(format!("{:04}-{}.md", chapter.id, now_millis())),
        markdown,
    )?;
    prune_chapter_backups(&directory.join("backups"), chapter.id, 20)
}

fn prune_chapter_backups(directory: &Path, chapter_id: i64, limit: usize) -> Result<(), String> {
    let prefix = format!("{:04}-", chapter_id);
    let mut backups = fs::read_dir(directory)
        .map_err(|error| format!("无法整理章节备份：{error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().starts_with(&prefix))
        .collect::<Vec<_>>();
    backups.sort_by_key(|entry| std::cmp::Reverse(entry.file_name()));
    for backup in backups.into_iter().skip(limit) {
        fs::remove_file(backup.path()).map_err(|error| format!("无法整理章节备份：{error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_native_store(app: AppHandle) -> Result<NativeStoreSnapshot, String> {
    let path = open_database(&app)?;
    Ok(NativeStoreSnapshot {
        migrated: has_migrated(&path)?,
        entries: entry_map(&path)?,
        database_path: path.display().to_string(),
        workspace_path: workspace_path()?.display().to_string(),
    })
}

#[tauri::command]
pub fn migrate_web_store(
    app: AppHandle,
    entries: HashMap<String, String>,
) -> Result<NativeStoreSnapshot, String> {
    let path = open_database(&app)?;
    if has_migrated(&path)? {
        return load_native_store(app);
    }
    let titles = project_titles(&entries);
    let mut groups = Vec::new();
    let mut sql = String::from("BEGIN IMMEDIATE;");
    for (key, value) in &entries {
        if let Some(project_id) = chapter_key_project_id(key) {
            groups.push((
                project_id,
                serde_json::from_str::<Vec<StoredChapter>>(value)
                    .map_err(|error| format!("无法迁移章节数据：{error}"))?,
            ));
        } else {
            sql.push_str(&format!(
                "INSERT OR REPLACE INTO entries (key, value, updated_at) VALUES ({}, {}, {});",
                quote(key),
                quote(value),
                now_millis()
            ));
        }
    }
    for (project_id, chapters) in &groups {
        sql.push_str(&format!(
            "DELETE FROM chapters WHERE project_id = {};",
            quote(project_id)
        ));
        for chapter in chapters {
            sql.push_str(&format!("INSERT INTO chapters (project_id, chapter_id, title, content, saved_at) VALUES ({}, {}, {}, {}, {});", quote(project_id), chapter.id, quote(&chapter.title), quote(&chapter.content), quote(&chapter.saved_at)));
        }
    }
    sql.push_str(&format!(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ({}, '1'); COMMIT;",
        quote(MIGRATION_MARKER)
    ));
    execute(&path, &sql)?;
    for (project_id, chapters) in groups {
        for chapter in chapters {
            mirror_chapter(
                &project_id,
                titles
                    .get(&project_id)
                    .map(String::as_str)
                    .unwrap_or("未命名作品"),
                &chapter,
            )?;
        }
    }
    Ok(NativeStoreSnapshot {
        migrated: true,
        entries: entry_map(&path)?,
        database_path: path.display().to_string(),
        workspace_path: workspace_path()?.display().to_string(),
    })
}

#[tauri::command]
pub fn put_native_entry(app: AppHandle, key: String, value: String) -> Result<(), String> {
    if chapter_key_project_id(&key).is_some() {
        return Err("章节必须通过章节仓储保存。".into());
    }
    let path = open_database(&app)?;
    execute(
        &path,
        &format!(
            "INSERT OR REPLACE INTO entries (key, value, updated_at) VALUES ({}, {}, {});",
            quote(&key),
            quote(&value),
            now_millis()
        ),
    )
}

#[tauri::command]
pub fn remove_native_entry(app: AppHandle, key: String) -> Result<(), String> {
    let path = open_database(&app)?;
    execute(
        &path,
        &format!("DELETE FROM entries WHERE key = {};", quote(&key)),
    )
}

#[tauri::command]
pub fn save_native_chapter(
    app: AppHandle,
    project_id: String,
    project_title: String,
    chapter: StoredChapter,
) -> Result<(), String> {
    let path = open_database(&app)?;
    execute(&path, &format!("INSERT INTO chapters (project_id, chapter_id, title, content, saved_at) VALUES ({}, {}, {}, {}, {}) ON CONFLICT(project_id, chapter_id) DO UPDATE SET title = excluded.title, content = excluded.content, saved_at = excluded.saved_at;", quote(&project_id), chapter.id, quote(&chapter.title), quote(&chapter.content), quote(&chapter.saved_at)))?;
    mirror_chapter(&project_id, &project_title, &chapter)
}
