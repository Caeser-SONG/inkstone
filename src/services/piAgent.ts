import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Model } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { buildLayeredMemory, enabledSkillInstructions } from "./memory";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WritingSkill } from "../types/story";

type PiRequest = {
  system: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  jsonResponse?: boolean;
  project?: NovelProject;
  chapters?: SavedChapter[];
  analysis?: StoryAnalysis | null;
  library?: LibraryItem[];
  skills?: WritingSkill[];
};

const emptyCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function createModel(config: ModelConfig, request: Pick<PiRequest, "temperature" | "maxTokens" | "jsonResponse">): Model<"openai-completions"> {
  return { id: config.model, name: config.model, api: "openai-completions", provider: "inkstone-openai-compatible", baseUrl: config.baseUrl.replace(/\/$/, ""), reasoning: false, input: ["text"], cost: emptyCost, contextWindow: 32_768, maxTokens: request.maxTokens, samplingParams: { temperature: request.temperature, ...(request.jsonResponse ? { response_format: { type: "json_object" } } : {}) } };
}

function textOf(message: unknown) {
  if (!message || typeof message !== "object" || !("content" in message)) return "";
  const content = (message as { content?: Array<{ type?: string; text?: string }> }).content;
  return Array.isArray(content) ? content.filter((item) => item.type === "text").map((item) => item.text || "").join("") : "";
}

function memoryTools(memory: ReturnType<typeof buildLayeredMemory>): AgentTool[] {
  return [
    {
      name: "read_story_memory", label: "读取故事记忆", description: "读取作品总览、人物与情节工作记忆，或相关已保存章节摘录。",
      parameters: Type.Object({ layer: Type.Optional(Type.Union([Type.Literal("project"), Type.Literal("working"), Type.Literal("retrieved")])) }),
      async execute(_id, params) {
        const layer = ((params as { layer?: keyof typeof memory }).layer || "working") as keyof typeof memory;
        return { content: [{ type: "text", text: memory[layer] }], details: { layer } };
      },
    },
  ];
}

/** Pi Agent Core runtime for all OpenAI-compatible writing operations. */
export async function runPiAgent(config: ModelConfig, request: PiRequest) {
  const skills = request.skills || [];
  const memory = buildLayeredMemory({ project: request.project, question: request.prompt, chapters: request.chapters || [], analysis: request.analysis || null, library: request.library || [], skills });
  const systemPrompt = [
    request.system,
    "\n你运行在墨舟的 Pi Agent Core 中。已保存正文才是事实来源；不确定时明确标注，不得虚构既有剧情。",
    "\n## 分层记忆 / 长期层\n" + memory.project,
    "\n## 分层记忆 / 工作层\n" + memory.working,
    "\n## 分层记忆 / 检索层\n" + memory.retrieved,
    enabledSkillInstructions(skills) ? "\n## 已启用的写作 Skills\n" + enabledSkillInstructions(skills) : "",
  ].join("\n");
  const agent = new Agent({
    initialState: { systemPrompt, model: createModel(config, request), tools: memoryTools(memory), thinkingLevel: "off" },
    streamFn: (model, context, options) => streamSimple(model as Model<"openai-completions">, context, options),
    getApiKey: () => config.apiKey,
    transformContext: async (messages) => messages.slice(-12),
    shouldStopAfterTurn: () => true,
  });
  await agent.prompt(request.prompt);
  const answer = [...agent.state.messages].reverse().find((message) => (message as { role?: string }).role === "assistant");
  const content = textOf(answer).trim();
  if (!content) throw new Error(agent.state.errorMessage || "服务没有返回内容");
  return content;
}
