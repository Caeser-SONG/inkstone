export type View = "write" | "outline" | "characters" | "library";

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
