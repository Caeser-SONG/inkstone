import { Check, CheckCircle, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { fallbackAnalysis } from "../services/storyAgent";
import type { StoryAnalysis } from "../types/story";

export function InsightContent({ analysis, agentBusy, onRunAgent }: { analysis: StoryAnalysis | null; agentBusy: boolean; onRunAgent: () => void }) {
  const display = analysis || fallbackAnalysis([]);
  return <div className="insight-content">
    <section className="summary-card"><div className="section-title"><Sparkle size={16} weight="fill" />故事 Agent <button onClick={onRunAgent} disabled={agentBusy}>{agentBusy ? "正在整理" : "立即整理"}</button></div><p>{display.summary}</p><small>{analysis ? `上次更新：${new Date(display.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "保存章节后自动更新"}</small></section>
    <section className="beat-section"><div className="section-title">故事线</div>{display.beats.map((beat, index) => <div className={`beat-item ${beat.status === "done" ? "active" : ""}`} key={`${beat.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{beat.title}</b><p>{beat.detail}</p></div></div>)}</section>
    <section className="check-section"><div className="section-title">一致性检查 <span className={`check-ok ${display.warnings.length ? "has-warning" : ""}`}><Check size={13} weight="bold" />{display.warnings.length ? `${display.warnings.length} 项待确认` : "通过"}</span></div>{display.warnings.length ? display.warnings.map((warning) => <p key={warning}><WarningCircle size={16} weight="fill" />{warning}</p>) : <p><CheckCircle size={16} weight="fill" />未发现需要确认的设定冲突</p>}</section>
    <section className="tags-section"><div className="section-title">人物记忆</div>{display.characters.length ? display.characters.map((character) => <button className="memory-tag" key={character.name}>{character.name} · {character.state}</button>) : <p className="empty-agent-state">保存正文后，Agent 会提取人物、关系与状态。</p>}</section>
  </div>;
}
