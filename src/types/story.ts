export type View = "write" | "outline" | "characters" | "library" | "workshop";

export type Chapter = {
  id: number;
  title: string;
  words: string;
  status: "writing" | "ready" | "draft";
};

export type NovelProject = {
  id: string;
  title: string;
  createdAt: string;
  chapters: Chapter[];
};

export type ModelConfig = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  agentInterval: number;
};

export type SavedChapter = {
  id: number;
  title: string;
  content: string;
  savedAt: string;
};

export type ChapterVersion = SavedChapter & { wordCount: number };

export type LibraryItem = { id: string; title: string; url: string; notes: string; sourceText?: string; addedAt: string };

export type WritingSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: boolean;
  source: "builtin" | "installed";
  installedAt: string;
};

export type LayeredMemory = {
  project: string;
  working: string;
  retrieved: string;
};

export type EditorPreferences = {
  paragraphStyle: "body" | "compact" | "relaxed";
  fontFamily: "songti" | "songtiLight" | "kaiti" | "fangsong" | "heiti" | "hiragino" | "system";
  fontSize: 15 | 16 | 17 | 18 | 19 | 20;
};

export type ActiveWritingSession = {
  id: string;
  chapterId: number;
  startedAt: string;
  startWordCount: number;
  accruedSeconds: number;
  resumedAt?: string;
  status: "running" | "paused";
};

export type WritingSession = {
  id: string;
  chapterId: number;
  startedAt: string;
  endedAt: string;
  startWordCount: number;
  endWordCount: number;
  activeSeconds: number;
};

export type WorkshopAgentRole = "writer" | "editor" | "reader";
export type WorkshopParticipant = WorkshopAgentRole | "author";
export type WorkshopPhase = "proposal" | "edit" | "response" | "revision";

export type WorkshopMessage = {
  id: string;
  role: WorkshopParticipant;
  phase: WorkshopPhase | "author-note" | "conversation";
  content: string;
};

export type WorkshopRound = {
  id: string;
  brief: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed" | "abandoned";
  nextPhase?: WorkshopPhase;
  messages: WorkshopMessage[];
};

export type StoryBeat = {
  title: string;
  detail: string;
  status: "done" | "next";
};

export type StoryCharacter = {
  name: string;
  role: string;
  state: string;
};

export type StoryRelation = {
  from: string;
  to: string;
  label: string;
};

export type StoryAnalysis = {
  summary: string;
  beats: StoryBeat[];
  characters: StoryCharacter[];
  relations: StoryRelation[];
  warnings: string[];
  updatedAt: string;
  source: "agent" | "local";
};
