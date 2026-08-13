use regex::Regex;
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WebSearchResult {
    title: String,
    url: String,
    snippet: String,
}

fn compact_text(value: String, limit: usize) -> String {
    let compact = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.chars().count() > limit { format!("{}…", compact.chars().take(limit).collect::<String>()) } else { compact }
}

fn decode_html(value: &str) -> String {
    value.replace("&amp;", "&").replace("&quot;", "\"").replace("&#x27;", "'").replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">")
}

fn strip_html(value: &str) -> String {
    let tag_re = Regex::new(r"<[^>]*>").expect("valid tag regex");
    decode_html(&tag_re.replace_all(value, " "))
}

fn encode_query(value: &str) -> String {
    value.bytes().flat_map(|byte| match byte {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => vec![byte as char],
        b' ' => vec!['+'],
        _ => format!("%{byte:02X}").chars().collect(),
    }).collect()
}

/// Searches public result metadata only; result pages and article bodies are never fetched.
#[tauri::command]
async fn web_search(query: String) -> Result<Vec<WebSearchResult>, String> {
    let query = query.trim();
    if query.is_empty() { return Ok(Vec::new()); }
    if query.chars().count() > 180 { return Err("搜索词过长，请控制在 180 个字符以内。".into()); }
    let output = Command::new("/usr/bin/curl")
        .args(["--fail", "--silent", "--show-error", "--location", "--max-time", "15", "--user-agent", "Inkstone/0.1"])
        .arg(format!("https://www.bing.com/search?q={}", encode_query(query)))
        .output().map_err(|error| format!("无法启动网络搜索：{error}"))?;
    if !output.status.success() { return Err(format!("网络搜索失败：{}", String::from_utf8_lossy(&output.stderr).trim())); }
    let body = String::from_utf8(output.stdout).map_err(|_| "搜索服务返回了无效内容。".to_string())?;
    let result_re = Regex::new(r#"(?s)<li[^>]*class=\"b_algo\"[^>]*>(.*?)(?=<li[^>]*class=\"b_algo\"|<li[^>]*class=\"b_pag\"|$)"#).map_err(|_| "无法解析搜索结果。".to_string())?;
    let title_re = Regex::new(r#"(?s)<h2[^>]*>\s*<a[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>\s*</h2>"#).map_err(|_| "无法解析搜索标题。".to_string())?;
    let snippet_re = Regex::new(r#"(?s)<p[^>]*>(.*?)</p>"#).map_err(|_| "无法解析搜索摘要。".to_string())?;
    let mut results = Vec::new();
    for capture in result_re.captures_iter(&body).take(8) {
        let item = capture.get(1).map(|match_| match_.as_str()).unwrap_or_default();
        let Some(title_capture) = title_re.captures(item) else { continue };
        let url = decode_html(title_capture.get(1).map(|match_| match_.as_str()).unwrap_or_default());
        if !url.starts_with("http") { continue; }
        let title = compact_text(strip_html(title_capture.get(2).map(|match_| match_.as_str()).unwrap_or_default()), 120);
        if title.is_empty() { continue; }
        let snippet = snippet_re.captures(item).and_then(|snippet| snippet.get(1)).map(|match_| compact_text(strip_html(match_.as_str()), 300)).unwrap_or_default();
        results.push(WebSearchResult { title, url, snippet });
    }
    Ok(results)
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, web_search])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
