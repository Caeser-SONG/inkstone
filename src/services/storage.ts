import { chapters as demoChapters } from "../data/demo";
import type { ChapterVersion, LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis } from "../types/story";

const modelConfigKey = "inkstone.model-config";
const projectsKey = "inkstone.projects";
const activeProjectKey = "inkstone.active-project";
const legacySavedChaptersKey = "inkstone.saved-chapters";
const legacyStoryAnalysisKey = "inkstone.story-analysis";
const demoProjectId = "demo-project";

export const defaultModelConfig: ModelConfig = {
  provider: "Moonshot AI",
  model: "moonshot-k2",
  baseUrl: "https://api.moonshot.cn/v1",
  apiKey: "",
  agentInterval: 15,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function readModelConfig(): ModelConfig {
  return { ...defaultModelConfig, ...readJson<Partial<ModelConfig>>(modelConfigKey, {}) };
}

export function saveModelConfig(config: ModelConfig) {
  localStorage.setItem(modelConfigKey, JSON.stringify(config));
}

const defaultProject: NovelProject = { id: demoProjectId, title: "归舟书局", createdAt: "2026-08-08T00:00:00.000Z", chapters: demoChapters };

export function readProjects(): NovelProject[] {
  return readJson<NovelProject[]>(projectsKey, [defaultProject]);
}

export function saveProjects(projects: NovelProject[]) {
  localStorage.setItem(projectsKey, JSON.stringify(projects));
}

export function readActiveProjectId(projects: NovelProject[]) {
  return localStorage.getItem(activeProjectKey) || projects[0]?.id || demoProjectId;
}

export function saveActiveProjectId(projectId: string) {
  localStorage.setItem(activeProjectKey, projectId);
}

const savedChaptersKey = (projectId: string) => `inkstone.project.${projectId}.saved-chapters`;
const storyAnalysisKey = (projectId: string) => `inkstone.project.${projectId}.story-analysis`;
const chapterHistoryKey = (projectId: string, chapterId: number) => `inkstone.project.${projectId}.chapter.${chapterId}.history`;
const libraryKey = (projectId: string) => `inkstone.project.${projectId}.library`;

export function readSavedChapters(projectId: string): SavedChapter[] {
  const scoped = readJson<SavedChapter[] | null>(savedChaptersKey(projectId), null);
  return scoped || (projectId === demoProjectId ? readJson<SavedChapter[]>(legacySavedChaptersKey, []) : []);
}

export function saveSavedChapters(projectId: string, chapters: SavedChapter[]) {
  localStorage.setItem(savedChaptersKey(projectId), JSON.stringify(chapters));
}

export function readStoryAnalysis(projectId: string): StoryAnalysis | null {
  const scoped = readJson<StoryAnalysis | null>(storyAnalysisKey(projectId), null);
  return scoped || (projectId === demoProjectId ? readJson<StoryAnalysis | null>(legacyStoryAnalysisKey, null) : null);
}

export function saveStoryAnalysis(projectId: string, analysis: StoryAnalysis) {
  localStorage.setItem(storyAnalysisKey(projectId), JSON.stringify(analysis));
}

export function readChapterHistory(projectId: string, chapterId: number): ChapterVersion[] {
  return readJson<ChapterVersion[]>(chapterHistoryKey(projectId, chapterId), []);
}

export function saveChapterVersion(projectId: string, version: ChapterVersion) {
  const history = readChapterHistory(projectId, version.id);
  const next = [version, ...history].slice(0, 30);
  localStorage.setItem(chapterHistoryKey(projectId, version.id), JSON.stringify(next));
}

export function readLibrary(projectId: string) { return readJson<LibraryItem[]>(libraryKey(projectId), []); }
export function saveLibrary(projectId: string, items: LibraryItem[]) { localStorage.setItem(libraryKey(projectId), JSON.stringify(items)); }
