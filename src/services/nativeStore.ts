import { invoke } from "@tauri-apps/api/core";
import type { SavedChapter } from "../types/story";

type NativeStoreSnapshot = {
  migrated: boolean;
  entries: Record<string, string>;
  databasePath: string;
  workspacePath: string;
};

export type StorageLocation = {
  mode: "native" | "browser";
  databasePath?: string;
  workspacePath?: string;
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function localInkstoneEntries() {
  return Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith("inkstone.")).map((key) => [key, localStorage.getItem(key) || ""]));
}

export async function initializeNativeStore(): Promise<{ location: StorageLocation; entries: Record<string, string> }> {
  if (!isTauriRuntime()) return { location: { mode: "browser" }, entries: localInkstoneEntries() };
  const snapshot = await invoke<NativeStoreSnapshot>("load_native_store");
  const hydrated = snapshot.migrated
    ? snapshot
    : await invoke<NativeStoreSnapshot>("migrate_web_store", { entries: localInkstoneEntries() });
  return { location: { mode: "native", databasePath: hydrated.databasePath, workspacePath: hydrated.workspacePath }, entries: hydrated.entries };
}

export async function writeNativeEntry(key: string, value: string) {
  if (!isTauriRuntime()) return;
  await invoke("put_native_entry", { key, value });
}

export async function removeNativeEntry(key: string) {
  if (!isTauriRuntime()) return;
  await invoke("remove_native_entry", { key });
}

export async function writeNativeChapter(projectId: string, projectTitle: string, chapter: SavedChapter) {
  if (!isTauriRuntime()) return;
  await invoke("save_native_chapter", { projectId, projectTitle, chapter });
}
