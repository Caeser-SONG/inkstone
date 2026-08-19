import { CaretDown, ChatCircleDots, Check, ListBullets, MagicWand, Sparkle, TextAa } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { ComfortableEditor } from "./ComfortableEditor";
import { InsightContent } from "./InsightContent";
import { RelationshipGraph } from "./RelationshipGraph";
import { ToolButton } from "./ToolButton";
import type { ChapterGuide, EditorPreferences, LibraryItem, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, StoryMemoryStatus, WritingSkill } from "../types/story";

const fontLabels: Record<EditorPreferences["fontFamily"], string> = { songti: "宋体", songtiLight: "细宋", kaiti: "楷体", fangsong: "仿宋", heiti: "苹方", hiragino: "冬青黑体", system: "系统字体" };
const paragraphLabels: Record<EditorPreferences["paragraphStyle"], string> = { compact: "紧凑", body: "正文", relaxed: "舒展" };
const fontOptions: Array<{ value: EditorPreferences["fontFamily"]; label: string; note: string }> = [
  { value: "songti", label: "宋体", note: "端正、适合常规叙事" },
  { value: "songtiLight", label: "细宋", note: "更轻盈，适合安静的阅读界面" },
  { value: "kaiti", label: "楷体", note: "手写感更强，标点为楷书字形" },
  { value: "fangsong", label: "仿宋", note: "清晰克制，长文阅读负担低" },
  { value: "heiti", label: "苹方", note: "现代无衬线，适合快节奏校稿" },
  { value: "hiragino", label: "冬青黑体", note: "紧凑清爽，适合较小字号" },
  { value: "system", label: "系统字体", note: "跟随当前系统的默认字体" },
];
const sizeOptions: EditorPreferences["fontSize"][] = [15, 16, 17, 18, 19, 20];

export function WritingView({ activeChapter, chapterTitle, draft, setDraft, wordCount, aiBusy, generateContinuation, setChatOpen, chatOpen, rightPanel, setRightPanel, storyAnalysis, agentBusy, onRunAgent, modelConfig, savedChapters, project, library, skills, editorPreferences, onEditorPreferencesChange, chapterGuide, onChapterGuideChange, onMemoryStatusChange }: { activeChapter: number; chapterTitle: string; draft: string; setDraft: (value: string) => void; wordCount: number; aiBusy: boolean; generateContinuation: () => void; setChatOpen: (value: boolean) => void; chatOpen: boolean; rightPanel: "insight" | "graph"; setRightPanel: (value: "insight" | "graph") => void; storyAnalysis: StoryAnalysis | null; agentBusy: boolean; onRunAgent: () => void; modelConfig: ModelConfig; savedChapters: SavedChapter[]; project?: NovelProject; library: LibraryItem[]; skills: WritingSkill[]; editorPreferences: EditorPreferences; onEditorPreferencesChange: (next: EditorPreferences) => void; chapterGuide: ChapterGuide; onChapterGuideChange: (guide: ChapterGuide) => void; onMemoryStatusChange: (memoryId: string, status: StoryMemoryStatus) => void }) {
  const [openMenu, setOpenMenu] = useState<"style" | "font" | "size" | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!toolbarRef.current?.contains(event.target as Node)) setOpenMenu(null); };
    window.addEventListener("mousedown", close); return () => window.removeEventListener("mousedown", close);
  }, []);
  const updatePreference = <K extends keyof EditorPreferences>(key: K, value: EditorPreferences[K]) => { onEditorPreferencesChange({ ...editorPreferences, [key]: value }); setOpenMenu(null); };
  return <div className="writing-layout">
    <section className="editor-zone">
      <div className="editor-breadcrumb"><span>第一卷 · 回城</span><span>/</span><strong>第{activeChapter || "—"}章 {chapterTitle}</strong><span className="saved-indicator"><Check size={13} />已保存</span></div>
      <div className="editor-toolbar"><div className="editor-tools" ref={toolbarRef}><div className="toolbar-menu"><ToolButton icon={TextAa} label="文字样式" active={openMenu === "style"} onClick={() => setOpenMenu(openMenu === "style" ? null : "style")} />{openMenu === "style" && <div className="format-menu style-menu" role="menu"><p>段落间距</p>{(["compact", "body", "relaxed"] as const).map((style) => <button key={style} className={editorPreferences.paragraphStyle === style ? "selected" : ""} onClick={() => updatePreference("paragraphStyle", style)}>{paragraphLabels[style]}<small>{style === "compact" ? "1.75 倍行距" : style === "body" ? "2.05 倍行距" : "2.35 倍行距"}</small></button>)}</div>}</div><span className="tool-divider" /><div className="toolbar-menu"><button className={`font-control ${openMenu === "font" ? "active" : ""}`} onClick={() => setOpenMenu(openMenu === "font" ? null : "font")}>{fontLabels[editorPreferences.fontFamily]} <CaretDown size={13} /></button>{openMenu === "font" && <div className="format-menu" role="menu"><p>正文字体</p>{fontOptions.map((option) => <button key={option.value} className={editorPreferences.fontFamily === option.value ? "selected" : ""} onClick={() => updatePreference("fontFamily", option.value)}>{option.label}</button>)}</div>}</div><div className="toolbar-menu"><button className={`font-control ${openMenu === "size" ? "active" : ""}`} onClick={() => setOpenMenu(openMenu === "size" ? null : "size")}>{editorPreferences.fontSize} <CaretDown size={13} /></button>{openMenu === "size" && <div className="format-menu size-menu" role="menu"><p>字号</p>{sizeOptions.map((size) => <button key={size} className={editorPreferences.fontSize === size ? "selected" : ""} onClick={() => updatePreference("fontSize", size)}>{size} px</button>)}</div>}</div><ToolButton icon={ListBullets} label="段落间距" active={openMenu === "style"} onClick={() => setOpenMenu(openMenu === "style" ? null : "style")} /></div><div className="editor-meta">{wordCount.toLocaleString()} 字 <span>·</span> {paragraphLabels[editorPreferences.paragraphStyle]}排版</div></div>
      <ComfortableEditor activeChapter={activeChapter} chapterTitle={chapterTitle} draft={draft} setDraft={setDraft} preferences={editorPreferences} />
      <div className="editor-footer"><span><Sparkle size={15} weight="fill" />AI 会参考本章设定、前情和人物状态</span><button className="generate-button" onClick={generateContinuation} disabled={aiBusy}>{aiBusy ? <span className="loading-mark" /> : <MagicWand size={17} weight="fill" />}{aiBusy ? "正在续写" : "续写 800 字"}</button></div>
    </section>
    <aside className="insight-panel"><div className="panel-tabs"><button className={rightPanel === "insight" ? "selected" : ""} onClick={() => setRightPanel("insight")}>本章洞察</button><button className={rightPanel === "graph" ? "selected" : ""} onClick={() => setRightPanel("graph")}>关系图</button><ToolButton icon={ChatCircleDots} label="打开 AI 对话" active={chatOpen} onClick={() => setChatOpen(!chatOpen)} /></div>{rightPanel === "insight" ? <InsightContent analysis={storyAnalysis} agentBusy={agentBusy} onRunAgent={onRunAgent} activeChapter={activeChapter} guide={chapterGuide} onGuideChange={onChapterGuideChange} savedChapters={savedChapters} onMemoryStatusChange={onMemoryStatusChange} /> : <RelationshipGraph analysis={storyAnalysis} />}{chatOpen && <ChatPanel onClose={() => setChatOpen(false)} config={modelConfig} project={project} chapters={savedChapters} analysis={storyAnalysis} library={library} skills={skills} />}</aside>
  </div>;
}
