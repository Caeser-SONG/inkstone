import { runPiAgent } from "./piAgent";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WritingSkill } from "../types/story";

type ChatMessage = { role: "system" | "user"; content: string };

type CompletionRequest = {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse?: boolean;
};

export async function requestChatCompletion(config: ModelConfig, request: CompletionRequest) {
  const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const prompt = request.messages.filter((message) => message.role === "user").map((message) => message.content).join("\n\n");
  const jsonInstruction = request.jsonResponse ? "\n必须只返回合法 JSON 对象，不要使用 Markdown 代码块。" : "";
  return runPiAgent(config, { system: system + jsonInstruction, prompt, temperature: request.temperature, maxTokens: request.maxTokens, jsonResponse: request.jsonResponse });
}

export async function testModelConnection(config: Pick<ModelConfig, "baseUrl" | "apiKey">) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
  if (!response.ok) throw new Error(`服务返回 ${response.status}`);
}

export async function generateNovelContinuation(config: ModelConfig, draft: string, context?: { project?: NovelProject; chapters: SavedChapter[]; analysis: StoryAnalysis | null; library: LibraryItem[]; skills: WritingSkill[] }) {
  return runPiAgent(config, { system: "你是中文长篇小说写作助手。延续用户提供的正文，保持人物、叙事视角和文风一致。只输出可直接插入的正文。", prompt: draft, temperature: 0.8, maxTokens: 900, ...context });
}

export async function askWritingAgent(config: ModelConfig, question: string, context: { project?: NovelProject; chapters: SavedChapter[]; analysis: StoryAnalysis | null; library: LibraryItem[]; skills: WritingSkill[] }) {
  return runPiAgent(config, {
    system: "你是中文长篇小说的写作搭档。只能基于墨舟提供的已保存章节、故事整理和资料库回答；若信息不足，直接说明缺少什么。回答务实、具体，可给出结构或改写建议，不要编造既有剧情。",
    prompt: question,
    temperature: 0.65,
    maxTokens: 1000,
    ...context,
  });
}
