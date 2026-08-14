import { runPiAgent } from "./piAgent";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WorkshopAgentRole, WorkshopMessage, WorkshopPhase, WritingSkill } from "../types/story";

export type WorkshopContext = { project?: NovelProject; chapters: SavedChapter[]; analysis: StoryAnalysis | null; library: LibraryItem[]; skills: WritingSkill[] };

const phaseRoles: Record<WorkshopPhase, WorkshopAgentRole> = { proposal: "writer", edit: "editor", response: "reader", revision: "writer" };
const roleNames: Record<WorkshopAgentRole | "author", string> = { writer: "写手", editor: "编辑", reader: "读者", author: "作者" };

function transcript(messages: WorkshopMessage[]) {
  return messages.slice(-8).map((message) => `【${roleNames[message.role]} · ${message.phase}】\n${message.content}`).join("\n\n");
}

function assertRunnable(config: ModelConfig, context: WorkshopContext) {
  if (!config.apiKey) throw new Error("请先在模型设置中配置 API Key，才能启动圆桌工作组。");
  if (!context.chapters.length) throw new Error("请先保存至少一章正文，工作组只会依据已保存内容讨论。");
}

async function speak(config: ModelConfig, system: string, prompt: string, context: WorkshopContext) {
  return runPiAgent(config, { system, prompt, temperature: 0.62, maxTokens: 620, ...context });
}

export function nextWorkshopPhase(phase: WorkshopPhase): WorkshopPhase | undefined {
  const next: Record<WorkshopPhase, WorkshopPhase | undefined> = { proposal: "edit", edit: "response", response: "revision", revision: undefined };
  return next[phase];
}

/** Executes exactly one phase so the author can interrupt between every handoff. */
export async function runWorkshopStep(config: ModelConfig, brief: string, phase: WorkshopPhase, messages: WorkshopMessage[], context: WorkshopContext): Promise<WorkshopMessage> {
  assertRunnable(config, context);
  const task = brief.trim() || "围绕最新已保存章节，决定下一幕最值得落笔的冲突与推进方式。";
  const earlier = transcript(messages) || "（这是圆桌的第一段发言。）";
  const instructions: Record<WorkshopPhase, { system: string; request: string }> = {
    proposal: { system: "你是中文网文项目的写手 Agent。只基于墨舟提供的已保存正文、故事记忆和作者任务提出方案，不篡改既有事实，不直接续写正文。", request: "提交：当前承接点、三个可选推进、推荐方案与落笔重点。" },
    edit: { system: "你是严谨的中文小说编辑 Agent。你审阅圆桌已有意见，检查人物动机、因果、节奏、伏笔与信息控制。只基于已保存正文与圆桌记录，不编造事实。", request: "提交：必须保留、风险与修改建议、推荐方案与理由。" },
    response: { system: "你是目标读者 Agent，代表追读中文网文的阅读体验。结合已保存正文和圆桌已有意见，指出吸引力、出戏风险和章末期待。只评价阅读效果，不编造剧情。", request: "提交：最有吸引力的点、可能流失读者的点、读者期待的章末钩子。" },
    revision: { system: "你是写手 Agent，正在接收编辑、读者和作者插话。你必须明确取舍，产出一份作者可执行的修订落笔方案；不要直接写正文，不要虚构事实。", request: "给出最终修订方案：场景目标、冲突升级、人物动作、信息揭示和章末钩子。" },
  };
  const item = instructions[phase];
  const content = await speak(config, item.system, `本轮任务：${task}\n\n当前圆桌记录：\n${earlier}\n\n${item.request}`, context);
  return { id: `${Date.now()}-${phase}`, role: phaseRoles[phase], phase, content };
}

/** Lets the author talk to a specific agent without advancing the workflow. */
export async function talkToWorkshopAgent(config: ModelConfig, target: WorkshopAgentRole, question: string, brief: string, messages: WorkshopMessage[], context: WorkshopContext): Promise<WorkshopMessage> {
  assertRunnable(config, context);
  const content = await speak(config, `你是圆桌中的${roleNames[target]} Agent。作者正在打断流程向你追问。只依据已保存正文与完整圆桌记录回答，不要推进到下一阶段；回答后等待作者继续工作流。`, `本轮任务：${brief}\n\n圆桌记录：\n${transcript(messages)}\n\n作者的问题：${question}`, context);
  return { id: `${Date.now()}-${target}-conversation`, role: target, phase: "conversation", content };
}
