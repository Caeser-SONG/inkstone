import { invoke } from "@tauri-apps/api/core";

export type WebSearchResult = { title: string; url: string; snippet: string };

/** Uses the local Tauri command so search stays out of the webview and can be used by Pi tools. */
export async function searchPublicWeb(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [] as WebSearchResult[];
  return invoke<WebSearchResult[]>("web_search", { query: trimmed });
}
