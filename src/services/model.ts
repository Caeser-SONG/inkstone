import { runPiAgent } from "./piAgent";
import type {
  CreativeCharter,
  LibraryItem,
  ModelConfig,
  NovelProject,
  SavedChapter,
  StoryAnalysis,
  WritingSkill,
} from "../types/story";

type ChatMessage = { role: "system" | "user"; content: string };

type CompletionRequest = {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse?: boolean;
  charter?: CreativeCharter;
};

export async function requestChatCompletion(
  config: ModelConfig,
  request: CompletionRequest,
) {
  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const prompt = request.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
  const jsonInstruction = request.jsonResponse
    ? "\n必须只返回合法 JSON 对象，不要使用 Markdown 代码块。"
    : "";
  return runPiAgent(config, {
    system: system + jsonInstruction,
    prompt,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    jsonResponse: request.jsonResponse,
    charter: request.charter,
  });
}

export async function testModelConnection(
  config: Pick<ModelConfig, "baseUrl" | "apiKey">,
) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!response.ok) throw new Error(`服务返回 ${response.status}`);
}

export type AgentContext = {
  project?: NovelProject;
  chapters: SavedChapter[];
  analysis: StoryAnalysis | null;
  library: LibraryItem[];
  skills: WritingSkill[];
  charter?: CreativeCharter;
};

export async function generateNovelContinuation(
  config: ModelConfig,
  draft: string,
  context?: AgentContext,
) {
  return runPiAgent(config, {
    system:
      "你是中文长篇小说写作助手。延续用户提供的正文，保持人物、叙事视角和文风一致。只输出可直接插入的正文。",
    prompt: draft,
    temperature: 0.8,
    maxTokens: 900,
    ...context,
  });
}

/** Produces a decision-oriented reading of the current draft without changing it. */
export async function analyzePlot(
  config: ModelConfig,
  draft: string,
  context: AgentContext,
) {
  return runPiAgent(config, {
    system:
      "你是中文长篇小说的剧情编辑。只依据当前草稿、已保存章节与墨舟故事记忆分析，不得杜撰既有事实，也不要直接续写正文。用清晰的小标题输出：当前承接、核心冲突与人物动机、节奏或逻辑风险、三个有取舍的后续推进方向、推荐的章末钩子。每项建议都应能让作者自行决定。",
    prompt: `请分析这段当前草稿：\n\n${draft}`,
    temperature: 0.45,
    maxTokens: 1200,
    ...context,
  });
}

/** Creates a scene-level continuation plan so the author can review it before prose is written. */
export async function createContinuationPlan(
  config: ModelConfig,
  draft: string,
  instruction: string,
  context: AgentContext,
) {
  return runPiAgent(config, {
    system:
      "你是中文长篇小说的场景策划 Agent。只能基于当前草稿、已保存正文和故事记忆提出续写方案，不得把推测当作既有事实，也不要直接写正文。输出：场景目标、人物动作与动机、冲突升级、信息揭示、章末钩子；每项具体、可执行、简洁。",
    prompt: `当前草稿：\n\n${draft}\n\n作者的续写要求：${instruction.trim() || "延续当前场景并推动一个明确的冲突。"}`,
    temperature: 0.6,
    maxTokens: 900,
    ...context,
  });
}

/** Writes prose only after the author has reviewed or edited a continuation plan. */
export async function writeFromContinuationPlan(
  config: ModelConfig,
  draft: string,
  plan: string,
  context: AgentContext,
) {
  return runPiAgent(config, {
    system:
      "你是中文长篇小说写作助手。根据作者确认的续写方案延续当前草稿，严格遵守已保存事实、创作宪章和人物状态。只输出约 800 字、可直接插入的小说正文；不要标题、说明或 Markdown。",
    prompt: `当前草稿：\n\n${draft}\n\n作者确认的续写方案：\n${plan}`,
    temperature: 0.78,
    maxTokens: 1000,
    ...context,
  });
}

export async function askWritingAgent(
  config: ModelConfig,
  question: string,
  context: AgentContext,
) {
  return runPiAgent(config, {
    system:
      "你是中文长篇小说的写作搭档。只能基于墨舟提供的已保存章节、故事整理和资料库回答；若信息不足，直接说明缺少什么。回答务实、具体，可给出结构或改写建议，不要编造既有剧情。",
    prompt: question,
    temperature: 0.65,
    maxTokens: 1000,
    ...context,
  });
}
