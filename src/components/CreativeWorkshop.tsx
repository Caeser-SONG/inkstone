import { useEffect, useState } from "react";
import { BookOpen, Eye, NotePencil, PencilSimpleLine, Play, SealCheck } from "@phosphor-icons/react";
import { readWorkshopRounds, saveWorkshopRounds } from "../services/storage";
import { runCreativeWorkshop } from "../services/creativeWorkshop";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WorkshopAgentRole, WorkshopRound, WritingSkill } from "../types/story";

const agents: Array<{ role: WorkshopAgentRole; name: string; label: string; icon: typeof NotePencil }> = [
  { role: "writer", name: "写手", label: "提出与修订", icon: NotePencil },
  { role: "editor", name: "编辑", label: "审稿与把关", icon: PencilSimpleLine },
  { role: "reader", name: "读者", label: "阅读反馈", icon: Eye },
];
const phaseLabels = { proposal: "写手提案", edit: "编辑审稿", response: "读者反馈", revision: "修订方案" };

export function CreativeWorkshop({ projectId, config, project, chapters, analysis, library, skills, onWrite }: { projectId: string; config: ModelConfig; project?: NovelProject; chapters: SavedChapter[]; analysis: StoryAnalysis | null; library: LibraryItem[]; skills: WritingSkill[]; onWrite: () => void }) {
  const [brief, setBrief] = useState("");
  const [rounds, setRounds] = useState<WorkshopRound[]>(() => readWorkshopRounds(projectId));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setRounds(readWorkshopRounds(projectId)); setBrief(""); setError(""); }, [projectId]);
  const startRound = async () => {
    if (running) return;
    setRunning(true); setError("");
    try {
      const round = await runCreativeWorkshop(config, brief, { project, chapters, analysis, library, skills });
      const next = [round, ...rounds]; setRounds(next); saveWorkshopRounds(projectId, next); setBrief("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "工作组启动失败。"); }
    finally { setRunning(false); }
  };
  const latest = rounds[0];
  return <div className="workshop-workspace"><header className="workshop-header"><div><span>Pi Agent 创作工作组</span><h2>围绕同一章，先讨论，再动笔</h2><p>每位成员只读取已保存正文和前一位的圆桌发言；结论不会自动改写正文。</p></div><button className="secondary-action" onClick={onWrite}><BookOpen size={16} />返回写作</button></header><section className="roundtable" aria-label="创作工作组圆桌"><div className="roundtable-ring" aria-hidden="true" /><div className="roundtable-core"><SealCheck size={21} weight="fill" /><b>圆桌</b><span>4 个阶段</span></div>{agents.map(({ role, name, label, icon: Icon }) => <article className={`roundtable-agent ${role}`} key={role}><div className="agent-avatar"><Icon size={21} weight="fill" /></div><div><b>{name}</b><span>{label}</span></div></article>)}</section><section className="workshop-flow"><span className="flow-step active">1 写手提案</span><i /> <span className="flow-step">2 编辑审稿</span><i /> <span className="flow-step">3 读者反馈</span><i /> <span className="flow-step">4 写手修订</span></section><section className="workshop-start"><label>本轮工作任务<textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="例如：第 3 章如何让主角必须前往南渡口，并在章末留下悬念？留空则由工作组根据最新章节决定。" /></label><button className="primary-action" onClick={() => void startRound()} disabled={running}><Play size={16} weight="fill" />{running ? "圆桌讨论中…" : "启动一轮圆桌"}</button>{error && <p className="workshop-error">{error}</p>}</section>{latest ? <section className="workshop-transcript"><header><div><span>最新一轮</span><h3>{latest.brief}</h3></div><time>{new Date(latest.createdAt).toLocaleString("zh-CN")}</time></header><div className="transcript-list">{latest.messages.map((message) => <article className={`transcript-message ${message.role}`} key={message.id}><div className="message-role">{agents.find((agent) => agent.role === message.role)?.name}<span>{phaseLabels[message.phase]}</span></div><p>{message.content}</p></article>)}</div></section> : <section className="workshop-empty"><SealCheck size={24} weight="duotone" /><p>还没有圆桌记录。启动后，写手、编辑与读者会依次交换意见，最后由写手给出可执行修订方案。</p></section>}</div>;
}
