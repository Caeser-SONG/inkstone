import { CaretDown, ChatCircleDots, Check, ListBullets, MagicWand, Sparkle, TextAa } from "@phosphor-icons/react";
import { ChatPanel } from "./ChatPanel";
import { ComfortableEditor } from "./ComfortableEditor";
import { InsightContent } from "./InsightContent";
import { RelationshipGraph } from "./RelationshipGraph";
import { ToolButton } from "./ToolButton";
import type { LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, WritingSkill } from "../types/story";

export function WritingView({ activeChapter, chapterTitle, draft, setDraft, wordCount, aiBusy, generateContinuation, setChatOpen, chatOpen, rightPanel, setRightPanel, storyAnalysis, agentBusy, onRunAgent, modelConfig, savedChapters, project, library, skills }: { activeChapter: number; chapterTitle: string; draft: string; setDraft: (value: string) => void; wordCount: number; aiBusy: boolean; generateContinuation: () => void; setChatOpen: (value: boolean) => void; chatOpen: boolean; rightPanel: "insight" | "graph"; setRightPanel: (value: "insight" | "graph") => void; storyAnalysis: StoryAnalysis | null; agentBusy: boolean; onRunAgent: () => void; modelConfig: ModelConfig; savedChapters: SavedChapter[]; project?: NovelProject; library: LibraryItem[]; skills: WritingSkill[] }) {
  return <div className="writing-layout">
    <section className="editor-zone">
      <div className="editor-breadcrumb"><span>第一卷 · 回城</span><span>/</span><strong>第{activeChapter || "—"}章 {chapterTitle}</strong><span className="saved-indicator"><Check size={13} />已保存</span></div>
      <div className="editor-toolbar"><div className="editor-tools"><ToolButton icon={TextAa} label="文字样式" /><span className="tool-divider" /><button className="font-control">正文 <CaretDown size={13} /></button><button className="font-control">17 <CaretDown size={13} /></button><ToolButton icon={ListBullets} label="段落列表" /></div><div className="editor-meta">{wordCount.toLocaleString()} 字 <span>·</span> 预计阅读 8 分钟</div></div>
      <ComfortableEditor activeChapter={activeChapter} chapterTitle={chapterTitle} draft={draft} setDraft={setDraft} />
      <div className="editor-footer"><span><Sparkle size={15} weight="fill" />AI 会参考本章设定、前情和人物状态</span><button className="generate-button" onClick={generateContinuation} disabled={aiBusy}>{aiBusy ? <span className="loading-mark" /> : <MagicWand size={17} weight="fill" />}{aiBusy ? "正在续写" : "续写 800 字"}</button></div>
    </section>
    <aside className="insight-panel"><div className="panel-tabs"><button className={rightPanel === "insight" ? "selected" : ""} onClick={() => setRightPanel("insight")}>本章洞察</button><button className={rightPanel === "graph" ? "selected" : ""} onClick={() => setRightPanel("graph")}>关系图</button><ToolButton icon={ChatCircleDots} label="打开 AI 对话" active={chatOpen} onClick={() => setChatOpen(!chatOpen)} /></div>{rightPanel === "insight" ? <InsightContent analysis={storyAnalysis} agentBusy={agentBusy} onRunAgent={onRunAgent} /> : <RelationshipGraph analysis={storyAnalysis} />}{chatOpen && <ChatPanel onClose={() => setChatOpen(false)} config={modelConfig} project={project} chapters={savedChapters} analysis={storyAnalysis} library={library} skills={skills} />}</aside>
  </div>;
}
