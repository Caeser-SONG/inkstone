import { Fragment, useEffect, useRef, useState } from "react";
import { BookOpen, ChatCircleDots, Eye, NotePencil, PaperPlaneTilt, Pause, PencilSimpleLine, Play, SealCheck, X } from "@phosphor-icons/react";
import { nextWorkshopPhase, runWorkshopStep, talkToWorkshopAgent } from "../services/creativeWorkshop";
import { readWorkshopRounds, saveWorkshopRounds } from "../services/storage";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WorkshopAgentRole, WorkshopMessage, WorkshopPhase, WorkshopRound, WritingSkill } from "../types/story";

const agents: Array<{ role: WorkshopAgentRole; name: string; label: string; icon: typeof NotePencil }> = [
  { role: "writer", name: "写手", label: "提出与修订", icon: NotePencil },
  { role: "editor", name: "编辑", label: "审稿与把关", icon: PencilSimpleLine },
  { role: "reader", name: "读者", label: "阅读反馈", icon: Eye },
];

const phases: WorkshopPhase[] = ["proposal", "edit", "response", "revision"];
const phaseLabels: Record<WorkshopPhase | "author-note" | "conversation", string> = {
  proposal: "写手提案", edit: "编辑审稿", response: "读者反馈", revision: "修订方案", "author-note": "作者插话", conversation: "追问回应",
};

type WorkshopProps = {
  projectId: string;
  config: ModelConfig;
  project?: NovelProject;
  chapters: SavedChapter[];
  analysis: StoryAnalysis | null;
  library: LibraryItem[];
  skills: WritingSkill[];
  onWrite: () => void;
  onAdoptDecision: (round: WorkshopRound) => string;
};

export function CreativeWorkshop({ projectId, config, project, chapters, analysis, library, skills, onWrite, onAdoptDecision }: WorkshopProps) {
  const [brief, setBrief] = useState("");
  const [rounds, setRounds] = useState<WorkshopRound[]>(() => readWorkshopRounds(projectId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [target, setTarget] = useState<WorkshopAgentRole>("writer");
  const requestToken = useRef(0);
  const context = { project, chapters, analysis, library, skills };

  useEffect(() => {
    setRounds(readWorkshopRounds(projectId));
    setBrief(""); setError(""); setQuestion(""); setTarget("writer");
  }, [projectId]);

  const saveRounds = (next: WorkshopRound[]) => {
    setRounds(next);
    saveWorkshopRounds(projectId, next);
  };
  const replaceRound = (round: WorkshopRound) => setRounds((current) => {
    const next = current.map((item) => item.id === round.id ? round : item);
    saveWorkshopRounds(projectId, next);
    return next;
  });

  const activeRound = rounds.find((round) => round.status === "active");
  const visibleRound = activeRound || rounds[0];
  const currentPhase = activeRound?.nextPhase;
  const phaseDone = (phase: WorkshopPhase) => Boolean(activeRound?.messages.some((message) => message.phase === phase));

  const runPhase = async (round: WorkshopRound, phase: WorkshopPhase) => {
    if (busy) return;
    const token = ++requestToken.current;
    setBusy(true); setError("");
    try {
      const message = await runWorkshopStep(config, round.brief, phase, round.messages, context);
      if (token !== requestToken.current) return;
      const nextPhase = nextWorkshopPhase(phase);
      replaceRound({ ...round, messages: [...round.messages, message], updatedAt: new Date().toISOString(), status: nextPhase ? "active" : "completed", nextPhase });
    } catch (reason) {
      if (token === requestToken.current) setError(reason instanceof Error ? reason.message : "工作组未能完成本阶段。");
    } finally {
      if (token === requestToken.current) setBusy(false);
    }
  };

  const startRound = () => {
    const now = new Date();
    const round: WorkshopRound = {
      id: `workshop-${now.getTime()}`,
      brief: brief.trim() || "围绕最新已保存章节，决定下一幕最值得落笔的冲突与推进方式。",
      createdAt: now.toISOString(), updatedAt: now.toISOString(), status: "active", nextPhase: "proposal", messages: [],
    };
    saveRounds([round, ...rounds]);
    setBrief("");
    void runPhase(round, "proposal");
  };

  const askAgent = async () => {
    if (!activeRound || !question.trim() || busy) return;
    const authorNote: WorkshopMessage = { id: `${Date.now()}-author-note`, role: "author", phase: "author-note", content: question.trim() };
    const interruptedRound = { ...activeRound, messages: [...activeRound.messages, authorNote], updatedAt: new Date().toISOString() };
    replaceRound(interruptedRound);
    setQuestion("");
    const token = ++requestToken.current;
    setBusy(true); setError("");
    try {
      const reply = await talkToWorkshopAgent(config, target, authorNote.content, interruptedRound.brief, interruptedRound.messages, context);
      if (token !== requestToken.current) return;
      replaceRound({ ...interruptedRound, messages: [...interruptedRound.messages, reply], updatedAt: new Date().toISOString() });
    } catch (reason) {
      if (token === requestToken.current) setError(reason instanceof Error ? reason.message : "Agent 没有回应这次追问。");
    } finally {
      if (token === requestToken.current) setBusy(false);
    }
  };

  const interruptCurrentTurn = () => {
    requestToken.current += 1;
    setBusy(false);
    setError("已打断当前发言，这次结果不会写入圆桌记录。现在可以插话或重新继续本阶段。");
  };
  const abandonRound = () => {
    if (!activeRound) return;
    replaceRound({ ...activeRound, status: "abandoned", nextPhase: undefined, updatedAt: new Date().toISOString() });
  };
  const adoptDecision = (round: WorkshopRound) => {
    const decisionId = onAdoptDecision(round);
    if (!decisionId || round.decisionId) return;
    replaceRound({ ...round, decisionId, updatedAt: new Date().toISOString() });
  };

  return <div className="workshop-workspace">
    <header className="workshop-header"><div><span>Pi Agent 创作工作组</span><h2>围绕同一章，先讨论，再动笔</h2><p>作者掌握节奏：每步都可暂停、插话，之后再继续；结论不会自动改写正文。</p></div><button className="secondary-action" onClick={onWrite}><BookOpen size={16} />返回写作</button></header>
    <Roundtable active={Boolean(activeRound)} target={target} busy={busy} onTargetChange={setTarget} currentPhase={currentPhase} />
    <section className="workshop-flow">{phases.map((phase, index) => <Fragment key={phase}>{index > 0 && <i />}{<span className={`flow-step ${currentPhase === phase ? "active" : ""} ${phaseDone(phase) ? "done" : ""}`}>{index + 1} {phaseLabels[phase]}</span>}</Fragment>)}</section>
    {!activeRound && <StartPanel brief={brief} busy={busy} onBriefChange={setBrief} onStart={startRound} />}
    {activeRound && <ActiveControls phase={currentPhase} busy={busy} onContinue={() => currentPhase && void runPhase(activeRound, currentPhase)} onInterrupt={interruptCurrentTurn} onAbandon={abandonRound} />}
    {activeRound && <InterruptPanel target={target} busy={busy} question={question} onTargetChange={setTarget} onQuestionChange={setQuestion} onSend={askAgent} />}
    {error && <p className="workshop-error">{error}</p>}
    {visibleRound ? <Transcript round={visibleRound} onAdoptDecision={adoptDecision} /> : <section className="workshop-empty"><SealCheck size={24} weight="duotone" /><p>还没有圆桌记录。启动后，写手先提交提案；每一步都会停下来，等你决定是追问、补充，还是继续。</p></section>}
  </div>;
}

function Roundtable({ active, target, busy, onTargetChange, currentPhase }: { active: boolean; target: WorkshopAgentRole; busy: boolean; onTargetChange: (role: WorkshopAgentRole) => void; currentPhase?: WorkshopPhase }) {
  return <section className="roundtable" aria-label="创作工作组圆桌"><div className="roundtable-ring" aria-hidden="true" /><div className="roundtable-core"><SealCheck size={21} weight="fill" /><b>{active ? "进行中" : "圆桌"}</b><span>{active ? `待${phaseLabels[currentPhase || "revision"]}` : "4 个阶段"}</span></div>{agents.map(({ role, name, label, icon: Icon }) => <button className={`roundtable-agent ${role} ${target === role ? "selected" : ""}`} key={role} onClick={() => active && onTargetChange(role)} disabled={!active || busy}><div className="agent-avatar"><Icon size={21} weight="fill" /></div><div><b>{name}</b><span>{label}</span></div></button>)}</section>;
}

function StartPanel({ brief, busy, onBriefChange, onStart }: { brief: string; busy: boolean; onBriefChange: (value: string) => void; onStart: () => void }) {
  return <section className="workshop-start"><label>本轮工作任务<textarea value={brief} onChange={(event) => onBriefChange(event.target.value)} placeholder="例如：第 3 章如何让主角必须前往南渡口，并在章末留下悬念？留空则由工作组根据最新章节决定。" /></label><button className="primary-action" onClick={onStart} disabled={busy}><Play size={16} weight="fill" />{busy ? "写手正在准备…" : "启动圆桌"}</button></section>;
}

function ActiveControls({ phase, busy, onContinue, onInterrupt, onAbandon }: { phase?: WorkshopPhase; busy: boolean; onContinue: () => void; onInterrupt: () => void; onAbandon: () => void }) {
  return <section className="workshop-control"><div><b>当前停在：{phaseLabels[phase || "revision"]}</b><span>可以先追问任一 Agent，或继续让下一位发言。</span></div><div>{busy ? <button className="secondary-action" onClick={onInterrupt}><X size={15} />打断当前发言</button> : <button className="secondary-action" onClick={onAbandon}><Pause size={15} />结束本轮</button>}<button className="primary-action" onClick={onContinue} disabled={busy}>{busy ? "处理中…" : <><Play size={15} weight="fill" />继续：{phaseLabels[phase || "revision"]}</>}</button></div></section>;
}

function InterruptPanel({ target, busy, question, onTargetChange, onQuestionChange, onSend }: { target: WorkshopAgentRole; busy: boolean; question: string; onTargetChange: (role: WorkshopAgentRole) => void; onQuestionChange: (value: string) => void; onSend: () => void }) {
  const name = agents.find((agent) => agent.role === target)?.name;
  return <section className="workshop-interrupt"><header><div><ChatCircleDots size={17} weight="fill" /><b>作者插话</b><span>正在对 {name} 说话</span></div><div className="agent-picker">{agents.map((agent) => <button key={agent.role} className={target === agent.role ? "selected" : ""} onClick={() => onTargetChange(agent.role)} disabled={busy}>{agent.name}</button>)}</div></header><div><textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder="补充约束、质疑建议，或让这位 Agent 解释它的判断…" /><button onClick={onSend} disabled={!question.trim() || busy} aria-label="发送给当前 Agent"><PaperPlaneTilt size={18} weight="fill" /></button></div></section>;
}

function Transcript({ round, onAdoptDecision }: { round: WorkshopRound; onAdoptDecision: (round: WorkshopRound) => void }) {
  const label = round.status === "active" ? "当前圆桌" : round.status === "abandoned" ? "已结束的圆桌" : "已完成圆桌";
  return <section className="workshop-transcript"><header><div><span>{label}</span><h3>{round.brief}</h3></div><div className="transcript-heading-actions"><time>{new Date(round.updatedAt || round.createdAt).toLocaleString("zh-CN")}</time>{round.status === "completed" && (round.decisionId ? <b className="decision-adopted"><SealCheck size={14} weight="fill" />已采纳</b> : <button className="secondary-action adopt-decision" onClick={() => onAdoptDecision(round)}><SealCheck size={15} weight="fill" />采纳为创作决定</button>)}</div></header><div className="transcript-list">{round.messages.map((message) => <article className={`transcript-message ${message.role}`} key={message.id}><div className="message-role">{message.role === "author" ? "作者" : agents.find((agent) => agent.role === message.role)?.name}<span>{phaseLabels[message.phase]}</span></div><p>{message.content}</p></article>)}</div></section>;
}
