import { runPiAgent } from "./piAgent";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WorkshopMessage, WorkshopRound, WritingSkill } from "../types/story";

type WorkshopContext = { project?: NovelProject; chapters: SavedChapter[]; analysis: StoryAnalysis | null; library: LibraryItem[]; skills: WritingSkill[] };

async function speak(config: ModelConfig, system: string, prompt: string, context: WorkshopContext) {
  return runPiAgent(config, { system, prompt, temperature: 0.62, maxTokens: 620, ...context });
}

/** Runs a bounded, sequential debate. Each later role receives the earlier statements. */
export async function runCreativeWorkshop(config: ModelConfig, brief: string, context: WorkshopContext): Promise<WorkshopRound> {
  if (!config.apiKey) throw new Error("请先在模型设置中配置 API Key，才能启动圆桌工作组。");
  if (!context.chapters.length) throw new Error("请先保存至少一章正文，工作组只会依据已保存内容讨论。");
  const task = brief.trim() || "围绕最新已保存章节，决定下一幕最值得落笔的冲突与推进方式。";
  const writerProposal = await speak(config, "你是中文网文项目的写手 Agent。你和编辑、读者正在圆桌协作。只基于墨舟提供的已保存正文、故事记忆和用户任务提出方案，不要篡改既有事实，不要直接续写正文。输出清晰、具体、可执行的创作判断。", `本轮任务：${task}\n\n请先给圆桌提交：\n1. 当前承接点\n2. 三个可选推进\n3. 你推荐的一项及落笔重点`, context);
  const editorReview = await speak(config, "你是严谨的中文小说编辑 Agent。审阅写手的提案，检查人物动机、因果、节奏、伏笔和信息控制。只基于已保存正文与圆桌内容，不要编造事实。给出能直接采纳或拒绝的编辑意见。", `本轮任务：${task}\n\n写手 Agent 的提案：\n${writerProposal}\n\n请提交：\n1. 必须保留\n2. 风险与修改建议\n3. 推荐方案与理由`, context);
  const readerResponse = await speak(config, "你是目标读者 Agent，代表追读中文网文的真实阅读体验。结合已保存正文、写手提案与编辑意见，指出最想看什么、哪里会出戏、章末该留下什么钩子。只评价阅读效果，不要编造已发生剧情。", `本轮任务：${task}\n\n写手提案：\n${writerProposal}\n\n编辑意见：\n${editorReview}\n\n请提交：\n1. 最有吸引力的点\n2. 可能流失读者的点\n3. 读者期待的章末钩子`, context);
  const revision = await speak(config, "你是写手 Agent，正在接收编辑和读者的反馈。你必须作出取舍，并产出一份作者可执行的修订落笔方案；不要直接写出正文，不要虚构事实。", `本轮任务：${task}\n\n你先前的提案：\n${writerProposal}\n\n编辑意见：\n${editorReview}\n\n读者反馈：\n${readerResponse}\n\n请给出最终修订方案：场景目标、冲突升级、人物动作、信息揭示和章末钩子。`, context);
  const now = new Date();
  const messages: WorkshopMessage[] = [
    { id: `${now.getTime()}-writer-proposal`, role: "writer", phase: "proposal", content: writerProposal },
    { id: `${now.getTime()}-editor`, role: "editor", phase: "edit", content: editorReview },
    { id: `${now.getTime()}-reader`, role: "reader", phase: "response", content: readerResponse },
    { id: `${now.getTime()}-writer-revision`, role: "writer", phase: "revision", content: revision },
  ];
  return { id: `workshop-${now.getTime()}`, brief: task, createdAt: now.toISOString(), messages };
}
