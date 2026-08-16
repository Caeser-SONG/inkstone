import { chapters as demoChapters } from "../data/demo";
import { initializeNativeStore, removeNativeEntry, writeNativeChapter, writeNativeEntry, type StorageLocation } from "./nativeStore";
import type { ActiveWritingSession, ChapterVersion, EditorPreferences, LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WorkshopRound, WritingSession, WritingSkill } from "../types/story";

const modelConfigKey = "inkstone.model-config";
const projectsKey = "inkstone.projects";
const activeProjectKey = "inkstone.active-project";
const legacySavedChaptersKey = "inkstone.saved-chapters";
const legacyStoryAnalysisKey = "inkstone.story-analysis";
const demoProjectId = "demo-project";
const cache = new Map<string, string>();
let nativeStoreActive = false;

export const defaultModelConfig: ModelConfig = {
  provider: "Moonshot AI", model: "moonshot-k2", baseUrl: "https://api.moonshot.cn/v1", apiKey: "", agentInterval: 15,
};

function readValue(key: string) {
  return cache.get(key) ?? localStorage.getItem(key);
}

function persistEntry(key: string, value: string) {
  if (!nativeStoreActive) { localStorage.setItem(key, value); return; }
  void writeNativeEntry(key, value).catch((error) => console.error("无法写入墨舟本地数据库", error));
}

function writeValue(key: string, value: string, writeNative = true) {
  cache.set(key, value);
  if (writeNative) persistEntry(key, value);
  else if (!nativeStoreActive) localStorage.setItem(key, value);
}

function removeValue(key: string) {
  cache.delete(key);
  if (!nativeStoreActive) { localStorage.removeItem(key); return; }
  void removeNativeEntry(key).catch((error) => console.error("无法更新墨舟本地数据库", error));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = readValue(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

/** Starts the native SQLite repository and makes the in-memory cache authoritative for this app session. */
export async function initializePersistentStorage(): Promise<StorageLocation> {
  const { location, entries } = await initializeNativeStore();
  cache.clear();
  Object.entries(entries).forEach(([key, value]) => cache.set(key, value));
  nativeStoreActive = location.mode === "native";
  return location;
}

export function readModelConfig(): ModelConfig { return { ...defaultModelConfig, ...readJson<Partial<ModelConfig>>(modelConfigKey, {}) }; }
export function saveModelConfig(config: ModelConfig) { writeValue(modelConfigKey, JSON.stringify(config)); }

const defaultProject: NovelProject = { id: demoProjectId, title: "归舟书局", createdAt: "2026-08-08T00:00:00.000Z", chapters: demoChapters };

export function readProjects(): NovelProject[] { return readJson<NovelProject[]>(projectsKey, [defaultProject]); }
export function saveProjects(projects: NovelProject[]) { writeValue(projectsKey, JSON.stringify(projects)); }
export function readActiveProjectId(projects: NovelProject[]) { return readValue(activeProjectKey) || projects[0]?.id || demoProjectId; }
export function saveActiveProjectId(projectId: string) { writeValue(activeProjectKey, projectId); }

const savedChaptersKey = (projectId: string) => `inkstone.project.${projectId}.saved-chapters`;
const storyAnalysisKey = (projectId: string) => `inkstone.project.${projectId}.story-analysis`;
const chapterHistoryKey = (projectId: string, chapterId: number) => `inkstone.project.${projectId}.chapter.${chapterId}.history`;
const libraryKey = (projectId: string) => `inkstone.project.${projectId}.library`;
const skillsKey = (projectId: string) => `inkstone.project.${projectId}.skills`;
const editorPreferencesKey = (projectId: string) => `inkstone.project.${projectId}.editor-preferences`;
const activeWritingSessionKey = (projectId: string) => `inkstone.project.${projectId}.active-writing-session`;
const writingSessionsKey = (projectId: string) => `inkstone.project.${projectId}.writing-sessions`;
const workshopRoundsKey = (projectId: string) => `inkstone.project.${projectId}.workshop-rounds`;
const defaultEditorPreferences: EditorPreferences = { paragraphStyle: "body", fontFamily: "songti", fontSize: 17 };

export function readSavedChapters(projectId: string): SavedChapter[] {
  const scoped = readJson<SavedChapter[] | null>(savedChaptersKey(projectId), null);
  return scoped || (projectId === demoProjectId ? readJson<SavedChapter[]>(legacySavedChaptersKey, []) : []);
}

/** Updates the in-memory chapter index. Native saves are intentionally per-chapter to scale to long works. */
export function saveSavedChapters(projectId: string, chapters: SavedChapter[]) { writeValue(savedChaptersKey(projectId), JSON.stringify(chapters), false); }
export async function saveSavedChapter(projectId: string, projectTitle: string, chapter: SavedChapter) { await writeNativeChapter(projectId, projectTitle, chapter); }

export function readStoryAnalysis(projectId: string): StoryAnalysis | null {
  const scoped = readJson<StoryAnalysis | null>(storyAnalysisKey(projectId), null);
  return scoped || (projectId === demoProjectId ? readJson<StoryAnalysis | null>(legacyStoryAnalysisKey, null) : null);
}
export function saveStoryAnalysis(projectId: string, analysis: StoryAnalysis) { writeValue(storyAnalysisKey(projectId), JSON.stringify(analysis)); }

export function readChapterHistory(projectId: string, chapterId: number) { return readJson<ChapterVersion[]>(chapterHistoryKey(projectId, chapterId), []); }
export function saveChapterVersion(projectId: string, version: ChapterVersion) {
  const next = [version, ...readChapterHistory(projectId, version.id)].slice(0, 30);
  writeValue(chapterHistoryKey(projectId, version.id), JSON.stringify(next));
}

export function readLibrary(projectId: string) { return readJson<LibraryItem[]>(libraryKey(projectId), []); }
export function saveLibrary(projectId: string, items: LibraryItem[]) { writeValue(libraryKey(projectId), JSON.stringify(items)); }
export function readSkills(projectId: string) { return readJson<WritingSkill[]>(skillsKey(projectId), []); }
export function saveSkills(projectId: string, skills: WritingSkill[]) { writeValue(skillsKey(projectId), JSON.stringify(skills)); }
export function readEditorPreferences(projectId: string) { return { ...defaultEditorPreferences, ...readJson<Partial<EditorPreferences>>(editorPreferencesKey(projectId), {}) }; }
export function saveEditorPreferences(projectId: string, preferences: EditorPreferences) { writeValue(editorPreferencesKey(projectId), JSON.stringify(preferences)); }
export function readActiveWritingSession(projectId: string) {
  const session = readJson<ActiveWritingSession | null>(activeWritingSessionKey(projectId), null);
  return session?.status === "running" ? { ...session, resumedAt: undefined, status: "paused" as const } : session;
}
export function saveActiveWritingSession(projectId: string, session: ActiveWritingSession | null) { if (session) writeValue(activeWritingSessionKey(projectId), JSON.stringify(session)); else removeValue(activeWritingSessionKey(projectId)); }
export function readWritingSessions(projectId: string) { return readJson<WritingSession[]>(writingSessionsKey(projectId), []); }
export function saveWritingSessions(projectId: string, sessions: WritingSession[]) { writeValue(writingSessionsKey(projectId), JSON.stringify(sessions.slice(0, 60))); }
export function readWorkshopRounds(projectId: string) {
  return readJson<WorkshopRound[]>(workshopRoundsKey(projectId), []).map((round) => ({ ...round, updatedAt: round.updatedAt || round.createdAt, status: round.status || "completed" }));
}
export function saveWorkshopRounds(projectId: string, rounds: WorkshopRound[]) { writeValue(workshopRoundsKey(projectId), JSON.stringify(rounds.slice(0, 12))); }
