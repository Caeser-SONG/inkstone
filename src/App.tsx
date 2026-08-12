import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CaretDown, Check, CheckCircle, ClockCounterClockwise, Compass, Export, FolderOpen, GearSix, NotePencil, Plus, Sparkle, UsersThree, X } from "@phosphor-icons/react";
import { ModelSettings } from "./components/ModelSettings";
import { SkillManager } from "./components/SkillManager";
import { ToolButton } from "./components/ToolButton";
import { WorkspaceView } from "./components/WorkspaceView";
import { WritingView } from "./components/WritingView";
import { initialDraft } from "./data/demo";
import { generateNovelContinuation } from "./services/model";
import { analyzeSavedChapters } from "./services/storyAgent";
import { readActiveProjectId, readChapterHistory, readLibrary, readModelConfig, readProjects, readSavedChapters, readSkills, readStoryAnalysis, saveActiveProjectId, saveChapterVersion, saveModelConfig, saveProjects, saveSavedChapters, saveSkills, saveStoryAnalysis } from "./services/storage";
import { availableSkills } from "./services/skills";
import type { Chapter, ChapterVersion, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, View, WritingSkill } from "./types/story";
import "./App.css";

type IconType = typeof BookOpen;
type CreationMode = "project" | "chapter" | null;

const navItems: { label: string; icon: IconType; view: View }[] = [
  { label: "写作", icon: NotePencil, view: "write" }, { label: "故事线", icon: Compass, view: "outline" }, { label: "人物", icon: UsersThree, view: "characters" }, { label: "资料库", icon: FolderOpen, view: "library" },
];

function App() {
  const initialProjects = readProjects();
  const initialProjectId = readActiveProjectId(initialProjects);
  const [projects, setProjects] = useState<NovelProject[]>(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const [view, setView] = useState<View>("write");
  const [activeChapter, setActiveChapter] = useState(activeProject?.chapters[0]?.id || 0);
  const [draft, setDraft] = useState(initialDraft);
  const [chatOpen, setChatOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<"insight" | "graph">("insight");
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChapterVersion[]>([]);
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [creationTitle, setCreationTitle] = useState("");
  const [modelConfig, setModelConfig] = useState<ModelConfig>(readModelConfig);
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>(() => readSavedChapters(initialProjectId));
  const [storyAnalysis, setStoryAnalysis] = useState<StoryAnalysis | null>(() => readStoryAnalysis(initialProjectId));
  const [skills, setSkills] = useState<WritingSkill[]>(() => readSkills(initialProjectId));
  const [agentBusy, setAgentBusy] = useState(false);
  const agentBusyRef = useRef(false);
  const wordCount = useMemo(() => draft.replace(/\s/g, "").length, [draft]);
  const currentChapter = activeProject?.chapters.find((chapter) => chapter.id === activeChapter);

  const runStoryAgent = async (chapterList: SavedChapter[], trigger: "save" | "timer" | "manual") => {
    if (!chapterList.length) { if (trigger === "manual") setNotice("请先保存至少一章正文，再整理故事线。"); return; }
    if (agentBusyRef.current || !activeProject) return;
    agentBusyRef.current = true; setAgentBusy(true);
    try {
      const analysis = await analyzeSavedChapters(modelConfig, chapterList);
      saveStoryAnalysis(activeProject.id, analysis); setStoryAnalysis(analysis);
      if (trigger === "save" && !modelConfig.apiKey) setNotice("已保存。未配置模型，已更新本地文本索引。");
      if (trigger === "manual" && !modelConfig.apiKey) setNotice("尚未配置模型，已更新本地文本索引。");
      if (trigger !== "timer" && modelConfig.apiKey) setNotice("故事 Agent 已根据已保存内容更新摘要、人物和故事线。");
    } catch (error) { if (trigger !== "timer") setNotice(`故事 Agent 更新失败：${error instanceof Error ? error.message : "未知错误"}`); }
    finally { agentBusyRef.current = false; setAgentBusy(false); }
  };

  useEffect(() => {
    if (!savedChapters.length || modelConfig.agentInterval <= 0) return;
    const timer = window.setInterval(() => { void runStoryAgent(savedChapters, "timer"); }, modelConfig.agentInterval * 60_000);
    return () => window.clearInterval(timer);
  }, [savedChapters, modelConfig]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId); if (!project) return;
    saveActiveProjectId(projectId); setActiveProjectId(projectId); setActiveChapter(project.chapters[0]?.id || 0);
    setDraft(project.chapters[0] ? (readSavedChapters(projectId).find((chapter) => chapter.id === project.chapters[0].id)?.content || (projectId === "demo-project" ? initialDraft : "")) : "");
    setSavedChapters(readSavedChapters(projectId)); setStoryAnalysis(readStoryAnalysis(projectId)); setSkills(readSkills(projectId)); setView("write");
  };

  const updateChapters = (nextChapters: Chapter[]) => {
    if (!activeProject) return;
    const nextProjects = projects.map((project) => project.id === activeProject.id ? { ...project, chapters: nextChapters } : project);
    setProjects(nextProjects); saveProjects(nextProjects);
  };

  const selectChapter = (chapter: Chapter) => {
    setActiveChapter(chapter.id); setDraft(savedChapters.find((item) => item.id === chapter.id)?.content || (activeProject?.id === "demo-project" && chapter.id === 1 ? initialDraft : "")); setView("write");
  };

  const generateContinuation = async () => {
    setAiBusy(true);
    try {
      if (!modelConfig.apiKey) {
        const continuation = "\n\n林见山的目光落在那半枚铜钱上，终于松开了紧攥着抽屉的手。\n\n“南渡口今晚会来一班不该靠岸的船。”他说，“如果你还想知道沈舟去了哪里，就别让任何人看见这枚铜钱。”";
        window.setTimeout(() => { setDraft((current) => current + continuation); setNotice("未填写 API Key，已插入演示续写。"); setAiBusy(false); }, 620); return;
      }
      const continuation = await generateNovelContinuation(modelConfig, draft, { project: activeProject, chapters: savedChapters, analysis: storyAnalysis, library: readLibrary(activeProject?.id || "demo-project"), skills: availableSkills(skills) }); setDraft((current) => `${current}\n\n${continuation}`); setNotice("已将模型续写插入正文，可继续编辑或撤销。");
    } catch (error) { setNotice(`续写失败：${error instanceof Error ? error.message : "未知错误"}`); } finally { if (modelConfig.apiKey) setAiBusy(false); }
  };

  const saveDraft = () => {
    if (!activeProject || !currentChapter) { setNotice("请先添加一个章节。 "); return; }
    const nextChapter: SavedChapter = { id: activeChapter, title: currentChapter.title, content: draft, savedAt: new Date().toISOString() };
    const nextSaved = [...savedChapters.filter((item) => item.id !== activeChapter), nextChapter].sort((a, b) => a.id - b.id);
    saveSavedChapters(activeProject.id, nextSaved); saveChapterVersion(activeProject.id, { ...nextChapter, wordCount }); setSavedChapters(nextSaved); updateChapters(activeProject.chapters.map((chapter) => chapter.id === activeChapter ? { ...chapter, words: wordCount.toLocaleString(), status: "ready" } : chapter));
    setNotice("已保存。故事 Agent 正在整理已保存内容。"); void runStoryAgent(nextSaved, "save");
  };

  const openHistory = () => {
    if (!activeProject || !currentChapter) { setNotice("请先添加并保存一个章节。"); return; }
    setHistory(readChapterHistory(activeProject.id, currentChapter.id)); setHistoryOpen(true);
  };

  const restoreVersion = (version: ChapterVersion) => { setDraft(version.content); setHistoryOpen(false); setNotice("已恢复历史版本到编辑器，请确认后点击保存。"); };

  const exportProject = () => {
    if (!activeProject) return;
    const chaptersForExport = activeProject.chapters.map((chapter) => ({ ...chapter, content: savedChapters.find((item) => item.id === chapter.id)?.content || "" }));
    const markdown = `# ${activeProject.title}\n\n${chaptersForExport.map((chapter) => `## 第${chapter.id}章 ${chapter.title}\n\n${chapter.content || "（尚未保存正文）"}`).join("\n\n")}`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" })); link.download = `${activeProject.title}.md`; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 0); setNotice("已导出 Markdown 文件。");
  };

  const createItem = () => {
    const title = creationTitle.trim(); if (!title) return;
    if (creationMode === "project") {
      const project: NovelProject = { id: `project-${Date.now()}`, title, createdAt: new Date().toISOString(), chapters: [] };
      const nextProjects = [...projects, project]; setProjects(nextProjects); saveProjects(nextProjects); saveActiveProjectId(project.id); setActiveProjectId(project.id); setActiveChapter(0); setDraft(""); setSavedChapters([]); setStoryAnalysis(null); setSkills([]); setView("write"); setCreationMode(null); setCreationTitle(""); setNotice(`已新建作品「${title}」，现在添加第一章。`); return;
    }
    if (creationMode === "chapter" && activeProject) {
      const chapter: Chapter = { id: Math.max(0, ...activeProject.chapters.map((item) => item.id)) + 1, title, words: "草稿", status: "draft" };
      updateChapters([...activeProject.chapters, chapter]); setActiveChapter(chapter.id); setDraft(""); setCreationMode(null); setCreationTitle(""); setView("write"); setNotice(`已添加第${chapter.id}章「${title}」。`);
    }
  };

  const currentSkills = availableSkills(skills);
  const persistSkills = (next: WritingSkill[]) => { if (!activeProject) return; saveSkills(activeProject.id, next); setSkills(next); };

  return <main className="app-shell">
    <header className="topbar"><div className="window-controls" aria-hidden="true"><span /><span /><span /></div><div className="workspace-name"><BookOpen size={19} weight="fill" /><span>墨舟</span><span className="workspace-separator">/</span><strong>{activeProject?.title}</strong><CaretDown size={14} /></div><div className="topbar-actions"><button className="quiet-action" onClick={saveDraft}><Check size={17} weight="bold" />保存</button><button className="quiet-action" onClick={openHistory}><ClockCounterClockwise size={17} />历史</button><button className="quiet-action" onClick={() => setSkillsOpen(true)}><Sparkle size={16} weight="fill" />Skills</button><button className="export-action" onClick={exportProject}><Export size={16} />导出</button><ToolButton icon={GearSix} label="模型与偏好设置" onClick={() => setSettingsOpen(true)} /></div></header>
    <div className="workbench"><aside className="sidebar"><button className="new-project" onClick={() => { setCreationMode("project"); setCreationTitle(""); }}><Plus size={17} weight="bold" />新建作品</button><select className="project-switcher" value={activeProject?.id} onChange={(event) => selectProject(event.target.value)} aria-label="切换作品">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><nav aria-label="工作区导航">{navItems.map(({ label, icon: Icon, view: itemView }) => <button key={label} className={`nav-item ${view === itemView ? "selected" : ""}`} onClick={() => setView(itemView)}><Icon size={19} weight={view === itemView ? "fill" : "regular"} />{label}</button>)}</nav><div className="sidebar-rule" /><div className="project-label">本书结构</div><button className="tree-row open"><CaretDown size={15} /><BookOpen size={16} weight="fill" />{activeProject?.title}<span className="tree-count">{activeProject?.chapters.length || 0}</span></button><button className="tree-row indent"><CaretDown size={15} /><span>第一卷 · 回城</span><span className="tree-count">{activeProject?.chapters.length || 0}</span></button>{activeProject?.chapters.map((chapter) => <button className={`chapter-row ${chapter.id === activeChapter ? "selected" : ""}`} key={chapter.id} onClick={() => selectChapter(chapter)}><span className={`chapter-state ${chapter.status}`} /><span>第{chapter.id}章 {chapter.title}</span></button>)}<button className="add-chapter" onClick={() => { setCreationMode("chapter"); setCreationTitle(""); }}><Plus size={15} />添加章节</button><div className="sidebar-bottom"><button className="model-pill" onClick={() => setSettingsOpen(true)}><span className="status-dot" />{modelConfig.model}<CaretDown size={13} /></button><button className="profile-button" aria-label="账户">陆</button></div></aside><section className="content-pane">{view === "write" ? <WritingView {...{ activeChapter, chapterTitle: currentChapter?.title || "未命名章节", draft, setDraft, wordCount, aiBusy, generateContinuation, setChatOpen, chatOpen, rightPanel, setRightPanel, storyAnalysis, agentBusy, modelConfig, savedChapters, project: activeProject, library: readLibrary(activeProject?.id || "demo-project"), skills: currentSkills, onRunAgent: () => void runStoryAgent(savedChapters, "manual") }} /> : <WorkspaceView view={view} onWrite={() => setView("write")} analysis={storyAnalysis} projectId={activeProject?.id || "demo-project"} />}</section>{notice && <div className="toast"><CheckCircle size={18} weight="fill" />{notice}</div>}{settingsOpen && <ModelSettings config={modelConfig} onClose={() => setSettingsOpen(false)} onSaved={(nextConfig) => { saveModelConfig(nextConfig); setModelConfig(nextConfig); setSettingsOpen(false); setNotice("模型配置已保存到本地。"); }} />}{skillsOpen && <SkillManager skills={skills} onChange={persistSkills} onClose={() => setSkillsOpen(false)} />}{historyOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setHistoryOpen(false)}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>章节版本</span><h2 id="history-title">{currentChapter?.title}</h2></div><button onClick={() => setHistoryOpen(false)} aria-label="关闭"><X size={19} /></button></header><div className="history-list">{history.length ? history.map((version, index) => <button key={`${version.savedAt}-${index}`} onClick={() => restoreVersion(version)}><b>{new Date(version.savedAt).toLocaleString("zh-CN")}</b><span>{version.wordCount.toLocaleString()} 字 · 点击恢复到编辑器</span></button>) : <p>保存正文后，这里会保留最近 30 个版本。</p>}</div></section></div>}{creationMode && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreationMode(null)}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>{creationMode === "project" ? "新作品" : "新章节"}</span><h2 id="create-title">{creationMode === "project" ? "给作品取个名字" : "给章节取个名字"}</h2></div><button onClick={() => setCreationMode(null)} aria-label="关闭"><X size={19} /></button></header><label>名称<input autoFocus value={creationTitle} onChange={(event) => setCreationTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createItem(); }} placeholder={creationMode === "project" ? "例如：长安夜航" : "例如：旧信与铜钱"} /></label><footer><button className="secondary-action" onClick={() => setCreationMode(null)}>取消</button><button className="primary-action" onClick={createItem} disabled={!creationTitle.trim()}>{creationMode === "project" ? "创建作品" : "添加章节"}</button></footer></section></div>}</div>
  </main>;
}

export default App;
