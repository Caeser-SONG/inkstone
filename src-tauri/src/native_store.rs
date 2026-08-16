use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
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

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(directory.join("inkstone.sqlite3"))
}

fn workspace_path() -> Result<PathBuf, String> {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| "无法定位用户文稿目录。".to_string())?;
    let path = base.join("墨舟作品");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建作品目录：{error}"))?;
    Ok(path)
}

fn open_database(app: &AppHandle) -> Result<(Connection, PathBuf), String> {
    let path = database_path(app)?;
    let connection =
        Connection::open(&path).map_err(|error| format!("无法打开本地数据库：{error}"))?;
    connection
        .busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|error| format!("无法配置数据库：{error}"))?;
    connection.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS chapters (project_id TEXT NOT NULL, chapter_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY (project_id, chapter_id)); CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id, chapter_id);").map_err(|error| format!("无法初始化本地数据库：{error}"))?;
    Ok((connection, path))
}

fn has_migrated(connection: &Connection) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT value FROM metadata WHERE key = ?1",
            [MIGRATION_MARKER],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map(|value| value.as_deref() == Some("1"))
        .map_err(|error| format!("无法读取数据库状态：{error}"))
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

fn entry_map(connection: &Connection) -> Result<HashMap<String, String>, String> {
    let mut entries = HashMap::new();
    {
        let mut statement = connection
            .prepare("SELECT key, value FROM entries")
            .map_err(|error| format!("无法读取本地数据：{error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| format!("无法读取本地数据：{error}"))?;
        for row in rows {
            let (key, value) = row.map_err(|error| format!("无法读取本地数据：{error}"))?;
            entries.insert(key, value);
        }
    }
    let mut groups: HashMap<String, Vec<StoredChapter>> = HashMap::new();
    {
        let mut statement = connection.prepare("SELECT project_id, chapter_id, title, content, saved_at FROM chapters ORDER BY project_id, chapter_id").map_err(|error| format!("无法读取章节：{error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    StoredChapter {
                        id: row.get(1)?,
                        title: row.get(2)?,
                        content: row.get(3)?,
                        saved_at: row.get(4)?,
                    },
                ))
            })
            .map_err(|error| format!("无法读取章节：{error}"))?;
        for row in rows {
            let (project_id, chapter) = row.map_err(|error| format!("无法读取章节：{error}"))?;
            groups.entry(project_id).or_default().push(chapter);
        }
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
    let (connection, path) = open_database(&app)?;
    Ok(NativeStoreSnapshot {
        migrated: has_migrated(&connection)?,
        entries: entry_map(&connection)?,
        database_path: path.display().to_string(),
        workspace_path: workspace_path()?.display().to_string(),
    })
}

#[tauri::command]
pub fn migrate_web_store(
    app: AppHandle,
    entries: HashMap<String, String>,
) -> Result<NativeStoreSnapshot, String> {
    let (mut connection, path) = open_database(&app)?;
    if has_migrated(&connection)? {
        return load_native_store(app);
    }
    let titles = project_titles(&entries);
    let mut groups = Vec::new();
    {
        let transaction = connection
            .transaction()
            .map_err(|error| format!("无法开始数据迁移：{error}"))?;
        for (key, value) in &entries {
            if let Some(project_id) = chapter_key_project_id(key) {
                groups.push((
                    project_id,
                    serde_json::from_str::<Vec<StoredChapter>>(value)
                        .map_err(|error| format!("无法迁移章节数据：{error}"))?,
                ));
            } else {
                transaction.execute("INSERT OR REPLACE INTO entries (key, value, updated_at) VALUES (?1, ?2, ?3)", params![key, value, now_millis()]).map_err(|error| format!("无法迁移作品数据：{error}"))?;
            }
        }
        for (project_id, chapters) in &groups {
            transaction
                .execute("DELETE FROM chapters WHERE project_id = ?1", [project_id])
                .map_err(|error| format!("无法迁移章节：{error}"))?;
            for chapter in chapters {
                transaction.execute("INSERT INTO chapters (project_id, chapter_id, title, content, saved_at) VALUES (?1, ?2, ?3, ?4, ?5)", params![project_id, chapter.id, &chapter.title, &chapter.content, &chapter.saved_at]).map_err(|error| format!("无法迁移章节：{error}"))?;
            }
        }
        transaction
            .execute(
                "INSERT OR REPLACE INTO metadata (key, value) VALUES (?1, '1')",
                [MIGRATION_MARKER],
            )
            .map_err(|error| format!("无法完成数据迁移：{error}"))?;
        transaction
            .commit()
            .map_err(|error| format!("无法完成数据迁移：{error}"))?;
    }
    for (project_id, chapters) in groups {
        let title = titles
            .get(&project_id)
            .map(String::as_str)
            .unwrap_or("未命名作品");
        for chapter in chapters {
            mirror_chapter(&project_id, title, &chapter)?;
        }
    }
    Ok(NativeStoreSnapshot {
        migrated: true,
        entries: entry_map(&connection)?,
        database_path: path.display().to_string(),
        workspace_path: workspace_path()?.display().to_string(),
    })
}

#[tauri::command]
pub fn put_native_entry(app: AppHandle, key: String, value: String) -> Result<(), String> {
    if chapter_key_project_id(&key).is_some() {
        return Err("章节必须通过章节仓储保存。".into());
    }
    let (connection, _) = open_database(&app)?;
    connection
        .execute(
            "INSERT OR REPLACE INTO entries (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![key, value, now_millis()],
        )
        .map_err(|error| format!("无法保存本地数据：{error}"))?;
    Ok(())
}

#[tauri::command]
pub fn remove_native_entry(app: AppHandle, key: String) -> Result<(), String> {
    let (connection, _) = open_database(&app)?;
    connection
        .execute("DELETE FROM entries WHERE key = ?1", [key])
        .map_err(|error| format!("无法更新本地数据：{error}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_native_chapter(
    app: AppHandle,
    project_id: String,
    project_title: String,
    chapter: StoredChapter,
) -> Result<(), String> {
    let (connection, _) = open_database(&app)?;
    connection.execute("INSERT INTO chapters (project_id, chapter_id, title, content, saved_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(project_id, chapter_id) DO UPDATE SET title = excluded.title, content = excluded.content, saved_at = excluded.saved_at", params![&project_id, chapter.id, &chapter.title, &chapter.content, &chapter.saved_at]).map_err(|error| format!("无法保存章节：{error}"))?;
    mirror_chapter(&project_id, &project_title, &chapter)
}
