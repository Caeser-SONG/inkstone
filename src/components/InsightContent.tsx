import { CaretDown, Check, CheckCircle, EyeSlash, LinkSimple, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { fallbackAnalysis } from "../services/storyAgent";
import type { ChapterGuide, SavedChapter, StoryAnalysis, StoryMemoryStatus } from "../types/story";

const memoryKindLabel = { character: "人物", relationship: "关系", setting: "设定", timeline: "时间线", foreshadowing: "伏笔" };
const checkLabels = { blocker: "需处理", attention: "待确认", suggestion: "建议" };

export function InsightContent({ analysis, agentBusy, onRunAgent, activeChapter, guide, onGuideChange, savedChapters, onMemoryStatusChange }: { analysis: StoryAnalysis | null; agentBusy: boolean; onRunAgent: () => void; activeChapter: number; guide: ChapterGuide; onGuideChange: (guide: ChapterGuide) => void; savedChapters: SavedChapter[]; onMemoryStatusChange: (memoryId: string, status: StoryMemoryStatus) => void }) {
  const display = analysis || fallbackAnalysis([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const earlierChapters = savedChapters.filter((chapter) => chapter.id < activeChapter);
  const previousChapter = earlierChapters[earlierChapters.length - 1];
  const currentMemories = (display.memories || []).filter((memory) => memory.status !== "ignored");
  const checks = display.checks || display.warnings.map((warning, index) => ({ id: `legacy-check-${index}`, severity: "attention" as const, title: "一致性待确认", detail: warning, evidence: [] }));
  const updateGuide = (key: "goal" | "conflict" | "hook", value: string) => onGuideChange({ ...guide, [key]: value });
  return <div className="insight-content">
    <section className={`chapter-console ${guideOpen ? "open" : ""}`}>
      <button className="chapter-console-trigger" onClick={() => setGuideOpen((value) => !value)} aria-expanded={guideOpen}><span><Sparkle size={15} weight="fill" />本章驾驶舱</span><CaretDown size={15} /></button>
      {guideOpen && <div className="chapter-console-body">
        <label>本章目标<textarea value={guide.goal} onChange={(event) => updateGuide("goal", event.target.value)} placeholder="这一章要让读者知道什么？" /></label>
        <label>核心冲突<textarea value={guide.conflict} onChange={(event) => updateGuide("conflict", event.target.value)} placeholder="谁想得到什么，阻力是什么？" /></label>
        <label>章末钩子<textarea value={guide.hook} onChange={(event) => updateGuide("hook", event.target.value)} placeholder="留给读者的下一页理由" /></label>
        <div className="chapter-context"><b>前情</b><p>{previousChapter ? `第${previousChapter.id}章「${previousChapter.title}」：${previousChapter.content.trim().replace(/\s+/g, " ").slice(0, 96)}${previousChapter.content.length > 96 ? "…" : ""}` : "保存前一章后，这里会显示前情摘要。"}</p></div>
      </div>}
    </section>
    <section className="summary-card"><div className="section-title"><Sparkle size={16} weight="fill" />故事 Agent <button onClick={onRunAgent} disabled={agentBusy}>{agentBusy ? "正在整理" : "立即整理"}</button></div><p>{display.summary}</p><small>{analysis ? `上次更新：${new Date(display.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "保存章节后自动更新"}</small></section>
    <section className="change-section"><div className="section-title">本次保存后的变化</div>{display.changes?.length ? display.changes.map((change) => <article className={`change-item ${change.type}`} key={change.id}><b>{change.type === "added" ? "新增" : change.type === "updated" ? "更新" : "提醒"} · {change.title}</b><p>{change.detail}</p>{change.evidence[0] && <small><LinkSimple size={12} />第{change.evidence[0].chapterId}章 · {change.evidence[0].excerpt}</small>}</article>) : <p className="empty-agent-state">保存并整理后，这里只展示相对上次分析的新事实、状态变化和风险。</p>}</section>
    <section className="beat-section"><div className="section-title">故事线</div>{display.beats.map((beat, index) => <div className={`beat-item ${beat.status === "done" ? "active" : ""}`} key={`${beat.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{beat.title}</b><p>{beat.detail}</p></div></div>)}</section>
    <section className="check-section"><div className="section-title">一致性检查 <span className={`check-ok ${checks.length ? "has-warning" : ""}`}><Check size={13} weight="bold" />{checks.length ? `${checks.length} 项待确认` : "通过"}</span></div>{checks.length ? checks.map((check) => <article className={`check-item ${check.severity}`} key={check.id}><div><WarningCircle size={16} weight="fill" /><b>{checkLabels[check.severity]} · {check.title}</b></div><p>{check.detail}</p>{check.evidence[0] && <small><LinkSimple size={12} />第{check.evidence[0].chapterId}章 · {check.evidence[0].excerpt}</small>}</article>) : <p><CheckCircle size={16} weight="fill" />未发现需要确认的设定冲突</p>}</section>
    <section className="tags-section"><div className="section-title">故事记忆 <span className="memory-count">{currentMemories.length}</span></div>{currentMemories.length ? currentMemories.map((memory) => <article className="memory-card" key={memory.id}><div className="memory-card-head"><span>{memoryKindLabel[memory.kind]}</span><b>{memory.title}</b>{memory.status === "confirmed" && <em>已确认</em>}</div><p>{memory.detail}</p>{memory.evidence[0] ? <small><LinkSimple size={12} />第{memory.evidence[0].chapterId}章 · {memory.evidence[0].excerpt}</small> : <small>未找到可验证的原文证据</small>}{memory.status === "pending" && <div className="memory-actions"><button onClick={() => onMemoryStatusChange(memory.id, "confirmed")}><Check size={13} weight="bold" />确认</button><button onClick={() => onMemoryStatusChange(memory.id, "ignored")}><EyeSlash size={13} />忽略</button></div>}</article>) : <p className="empty-agent-state">保存正文后，Agent 会提取可确认的人物、关系、设定与伏笔。</p>}</section>
  </div>;
}
