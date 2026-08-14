import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CaretDown, Check, CheckCircle, ClockCounterClockwise, Compass, Export, FileArrowUp, FolderOpen, GearSix, NotePencil, Plus, Sparkle, UsersThree, UsersFour, X } from "@phosphor-icons/react";
import { CreativeWorkshop } from "./components/CreativeWorkshop";
import { ModelSettings } from "./components/ModelSettings";
import { SkillManager } from "./components/SkillManager";
import { ToolButton } from "./components/ToolButton";
import { WorkspaceView } from "./components/WorkspaceView";
import { WritingView } from "./components/WritingView";
import { initialDraft } from "./data/demo";
import { generateNovelContinuation } from "./services/model";
import { importTextFile } from "./services/importText";
import { analyzeSavedChapters } from "./services/storyAgent";
import { readActiveProjectId, readActiveWritingSession, readChapterHistory, readEditorPreferences, readLibrary, readModelConfig, readProjects, readSavedChapters, readSkills, readStoryAnalysis, readWritingSessions, saveActiveProjectId, saveActiveWritingSession, saveChapterVersion, saveEditorPreferences, saveModelConfig, saveProjects, saveSavedChapters, saveSkills, saveStoryAnalysis, saveWritingSessions } from "./services/storage";
import { availableSkills } from "./services/skills";
import type { ActiveWritingSession, Chapter, ChapterVersion, EditorPreferences, ModelConfig, NovelProject, SavedChapter, StoryAnalysis, View, WritingSession, WritingSkill } from "./types/story";
import "./App.css";

type IconType = typeof BookOpen;
type CreationMode = "project" | "chapter" | null;

const navItems: { label: string; icon: IconType; view: View }[] = [
  { label: "写作", icon: NotePencil, view: "write" }, { label: "故事线", icon: Compass, view: "outline" }, { label: "人物", icon: UsersThree, view: "characters" }, { label: "工作组", icon: UsersFour, view: "workshop" }, { label: "资料库", icon: FolderOpen, view: "library" },
];

function getActiveWritingSeconds(session: ActiveWritingSession, now = Date.now()) {
  if (session.status !== "running" || !session.resumedAt) return session.accruedSeconds;
  return session.accruedSeconds + Math.max(0, Math.floor((now - Date.parse(session.resumedAt)) / 1000));
}

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
  const [writingHistoryOpen, setWritingHistoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState<ChapterVersion[]>([]);
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [creationTitle, setCreationTitle] = useState("");
  const [modelConfig, setModelConfig] = useState<ModelConfig>(readModelConfig);
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>(() => readSavedChapters(initialProjectId));
  const [storyAnalysis, setStoryAnalysis] = useState<StoryAnalysis | null>(() => readStoryAnalysis(initialProjectId));
  const [skills, setSkills] = useState<WritingSkill[]>(() => readSkills(initialProjectId));
  const [editorPreferences, setEditorPreferences] = useState<EditorPreferences>(() => readEditorPreferences(initialProjectId));
  const [activeWritingSession, setActiveWritingSession] = useState<ActiveWritingSession | null>(() => readActiveWritingSession(initialProjectId));
  const [writingSessions, setWritingSessions] = useState<WritingSession[]>(() => readWritingSessions(initialProjectId));
  const [sessionClock, setSessionClock] = useState(() => Date.now());
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

  useEffect(() => {
    if (activeWritingSession?.status !== "running") return;
    const timer = window.setInterval(() => setSessionClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeWritingSession?.status]);

  useEffect(() => {
    const pauseWritingSession = () => {
      if (activeWritingSession?.status !== "running" || !activeProject) return;
      const paused = { ...activeWritingSession, accruedSeconds: getActiveWritingSeconds(activeWritingSession), resumedAt: undefined, status: "paused" as const };
      saveActiveWritingSession(activeProject.id, paused); setActiveWritingSession(paused);
    };
    const pauseWhenHidden = () => { if (document.visibilityState === "hidden") pauseWritingSession(); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("pagehide", pauseWritingSession);
    return () => { document.removeEventListener("visibilitychange", pauseWhenHidden); window.removeEventListener("pagehide", pauseWritingSession); };
  }, [activeProject, activeWritingSession]);

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId); if (!project) return;
    if (activeWritingSession?.status === "running" && activeProject) {
      const paused = { ...activeWritingSession, accruedSeconds: getActiveWritingSeconds(activeWritingSession), resumedAt: undefined, status: "paused" as const };
      saveActiveWritingSession(activeProject.id, paused);
    }
    saveActiveProjectId(projectId); setActiveProjectId(projectId); setActiveChapter(project.chapters[0]?.id || 0);
    setDraft(project.chapters[0] ? (readSavedChapters(projectId).find((chapter) => chapter.id === project.chapters[0].id)?.content || (projectId === "demo-project" ? initialDraft : "")) : "");
    setSavedChapters(readSavedChapters(projectId)); setStoryAnalysis(readStoryAnalysis(projectId)); setSkills(readSkills(projectId)); setEditorPreferences(readEditorPreferences(projectId)); setActiveWritingSession(readActiveWritingSession(projectId)); setWritingSessions(readWritingSessions(projectId)); setSessionClock(Date.now()); setView("write");
  };

  const updateChapters = (nextChapters: Chapter[]) => {
    if (!activeProject) return;
    const nextProjects = projects.map((project) => project.id === activeProject.id ? { ...project, chapters: nextChapters } : project);
    setProjects(nextProjects); saveProjects(nextProjects);
  };

  const selectChapter = (chapter: Chapter) => {
    if (activeWritingSession?.status === "running") {
      const paused = { ...activeWritingSession, accruedSeconds: getActiveWritingSeconds(activeWritingSession), resumedAt: undefined, status: "paused" as const };
      if (activeProject) saveActiveWritingSession(activeProject.id, paused);
      setActiveWritingSession(paused); setNotice("已暂停当前码字会话，返回本章后可继续。");
    }
    setActiveChapter(chapter.id); setDraft(savedChapters.find((item) => item.id === chapter.id)?.content || (activeProject?.id === "demo-project" && chapter.id === 1 ? initialDraft : "")); setView("write");
  };

  const toggleWritingSession = () => {
    if (!activeProject || !currentChapter) { setNotice("请先添加一个章节，再开始码字。 "); return; }
    const now = new Date();
    if (!activeWritingSession) {
      const session: ActiveWritingSession = { id: `writing-${Date.now()}`, chapterId: activeChapter, startedAt: now.toISOString(), startWordCount: wordCount, accruedSeconds: 0, resumedAt: now.toISOString(), status: "running" };
      saveActiveWritingSession(activeProject.id, session); setActiveWritingSession(session); setSessionClock(now.getTime()); return;
    }
    if (activeWritingSession.chapterId !== activeChapter) { setNotice(`第${activeWritingSession.chapterId}章的码字会话仍在暂停中，请先回到该章节结束它。`); return; }
    const next = activeWritingSession.status === "running"
      ? { ...activeWritingSession, accruedSeconds: getActiveWritingSeconds(activeWritingSession, now.getTime()), resumedAt: undefined, status: "paused" as const }
      : { ...activeWritingSession, resumedAt: now.toISOString(), status: "running" as const };
    saveActiveWritingSession(activeProject.id, next); setActiveWritingSession(next); setSessionClock(now.getTime());
  };

  const endWritingSession = () => {
    if (!activeProject || !activeWritingSession || activeWritingSession.chapterId !== activeChapter) return;
    const endedAt = new Date();
    const session: WritingSession = { id: activeWritingSession.id, chapterId: activeWritingSession.chapterId, startedAt: activeWritingSession.startedAt, endedAt: endedAt.toISOString(), startWordCount: activeWritingSession.startWordCount, endWordCount: wordCount, activeSeconds: getActiveWritingSeconds(activeWritingSession, endedAt.getTime()) };
    const nextSessions = [session, ...writingSessions].slice(0, 60);
    saveWritingSessions(activeProject.id, nextSessions); saveActiveWritingSession(activeProject.id, null); setWritingSessions(nextSessions); setActiveWritingSession(null); setSessionClock(endedAt.getTime());
    const netWords = session.endWordCount - session.startWordCount;
    setNotice(`本次码字已记录：${netWords >= 0 ? "+" : ""}${netWords.toLocaleString()} 字。`);
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

  const chooseImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setImporting(true); setImportError("");
    try { const text = await importTextFile(file); setImportText(text); setImportFileName(file.name); setImportOpen(true); }
    catch (error) { setImportError(error instanceof Error ? error.message : "导入失败。"); setImportOpen(true); }
    finally { setImporting(false); }
  };

  const applyImport = (mode: "replace" | "append") => {
    if (!importText) return;
    setDraft((current) => mode === "replace" ? importText : `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${importText}`);
    setImportOpen(false); setImportText(""); setImportFileName(""); setNotice(mode === "replace" ? "已导入并替换当前编辑器内容，请确认后保存。" : "已将导入内容追加到编辑器末尾，请确认后保存。");
  };

  const createItem = () => {
    const title = creationTitle.trim(); if (!title) return;
    if (creationMode === "project") {
      const project: NovelProject = { id: `project-${Date.now()}`, title, createdAt: new Date().toISOString(), chapters: [] };
      const nextProjects = [...projects, project]; setProjects(nextProjects); saveProjects(nextProjects); saveActiveProjectId(project.id); setActiveProjectId(project.id); setActiveChapter(0); setDraft(""); setSavedChapters([]); setStoryAnalysis(null); setSkills([]); setEditorPreferences(readEditorPreferences(project.id)); setActiveWritingSession(null); setWritingSessions([]); setSessionClock(Date.now()); setView("write"); setCreationMode(null); setCreationTitle(""); setNotice(`已新建作品「${title}」，现在添加第一章。`); return;
    }
    if (creationMode === "chapter" && activeProject) {
      const chapter: Chapter = { id: Math.max(0, ...activeProject.chapters.map((item) => item.id)) + 1, title, words: "草稿", status: "draft" };
      updateChapters([...activeProject.chapters, chapter]); setActiveChapter(chapter.id); setDraft(""); setCreationMode(null); setCreationTitle(""); setView("write"); setNotice(`已添加第${chapter.id}章「${title}」。`);
    }
  };

  const currentSkills = availableSkills(skills);
  const persistSkills = (next: WritingSkill[]) => { if (!activeProject) return; saveSkills(activeProject.id, next); setSkills(next); };
  const persistEditorPreferences = (next: EditorPreferences) => { if (!activeProject) return; saveEditorPreferences(activeProject.id, next); setEditorPreferences(next); };

  return <main className="app-shell">
    <header className="topbar"><div className="window-controls" aria-hidden="true"><span /><span /><span /></div><div className="workspace-name"><BookOpen size={19} weight="fill" /><span>墨舟</span><span className="workspace-separator">/</span><strong>{activeProject?.title}</strong><CaretDown size={14} /></div><div className="topbar-actions"><button className="quiet-action" onClick={saveDraft}><Check size={17} weight="bold" />保存</button><label className={`quiet-action import-action ${importing ? "disabled" : ""}`}><FileArrowUp size={16} />{importing ? "正在导入" : "导入"}<input type="file" accept=".txt,.md,.doc,.docx,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void chooseImport(event)} disabled={importing} /></label><button className="quiet-action" onClick={openHistory}><ClockCounterClockwise size={17} />历史</button><button className="quiet-action" onClick={() => setSkillsOpen(true)}><Sparkle size={16} weight="fill" />Skills</button><button className="export-action" onClick={exportProject}><Export size={16} />导出</button><ToolButton icon={GearSix} label="模型与偏好设置" onClick={() => setSettingsOpen(true)} /></div></header>
    <div className="workbench"><aside className="sidebar"><button className="new-project" onClick={() => { setCreationMode("project"); setCreationTitle(""); }}><Plus size={17} weight="bold" />新建作品</button><select className="project-switcher" value={activeProject?.id} onChange={(event) => selectProject(event.target.value)} aria-label="切换作品">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><nav aria-label="工作区导航">{navItems.map(({ label, icon: Icon, view: itemView }) => <button key={label} className={`nav-item ${view === itemView ? "selected" : ""}`} onClick={() => setView(itemView)}><Icon size={19} weight={view === itemView ? "fill" : "regular"} />{label}</button>)}</nav><div className="sidebar-rule" /><div className="project-label">本书结构</div><button className="tree-row open"><CaretDown size={15} /><BookOpen size={16} weight="fill" />{activeProject?.title}<span className="tree-count">{activeProject?.chapters.length || 0}</span></button><button className="tree-row indent"><CaretDown size={15} /><span>第一卷 · 回城</span><span className="tree-count">{activeProject?.chapters.length || 0}</span></button>{activeProject?.chapters.map((chapter) => <button className={`chapter-row ${chapter.id === activeChapter ? "selected" : ""}`} key={chapter.id} onClick={() => selectChapter(chapter)}><span className={`chapter-state ${chapter.status}`} /><span>第{chapter.id}章 {chapter.title}</span></button>)}<button className="add-chapter" onClick={() => { setCreationMode("chapter"); setCreationTitle(""); }}><Plus size={15} />添加章节</button><div className="sidebar-bottom"><button className="model-pill" onClick={() => setSettingsOpen(true)}><span className="status-dot" />{modelConfig.model}<CaretDown size={13} /></button><button className="profile-button" aria-label="账户">陆</button></div></aside><section className="content-pane">{view === "write" ? <WritingView {...{ activeChapter, chapterTitle: currentChapter?.title || "未命名章节", draft, setDraft, wordCount, aiBusy, generateContinuation, setChatOpen, chatOpen, rightPanel, setRightPanel, storyAnalysis, agentBusy, modelConfig, savedChapters, project: activeProject, library: readLibrary(activeProject?.id || "demo-project"), skills: currentSkills, editorPreferences, onEditorPreferencesChange: persistEditorPreferences, writingSession: activeWritingSession?.chapterId === activeChapter ? activeWritingSession : null, writingSessionSeconds: activeWritingSession?.chapterId === activeChapter ? getActiveWritingSeconds(activeWritingSession, sessionClock) : 0, lastWritingSession: writingSessions[0], onToggleWritingSession: toggleWritingSession, onEndWritingSession: endWritingSession, onOpenWritingHistory: () => setWritingHistoryOpen(true), onRunAgent: () => void runStoryAgent(savedChapters, "manual") }} /> : view === "workshop" ? <CreativeWorkshop projectId={activeProject?.id || "demo-project"} config={modelConfig} project={activeProject} chapters={savedChapters} analysis={storyAnalysis} library={readLibrary(activeProject?.id || "demo-project")} skills={currentSkills} onWrite={() => setView("write")} /> : <WorkspaceView view={view} onWrite={() => setView("write")} analysis={storyAnalysis} projectId={activeProject?.id || "demo-project"} />}</section>{notice && <div className="toast"><CheckCircle size={18} weight="fill" />{notice}</div>}{settingsOpen && <ModelSettings config={modelConfig} onClose={() => setSettingsOpen(false)} onSaved={(nextConfig) => { saveModelConfig(nextConfig); setModelConfig(nextConfig); setSettingsOpen(false); setNotice("模型配置已保存到本地。"); }} />}{skillsOpen && <SkillManager skills={skills} onChange={persistSkills} onClose={() => setSkillsOpen(false)} />}{historyOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setHistoryOpen(false)}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>章节版本</span><h2 id="history-title">{currentChapter?.title}</h2></div><button onClick={() => setHistoryOpen(false)} aria-label="关闭"><X size={19} /></button></header><div className="history-list">{history.length ? history.map((version, index) => <button key={`${version.savedAt}-${index}`} onClick={() => restoreVersion(version)}><b>{new Date(version.savedAt).toLocaleString("zh-CN")}</b><span>{version.wordCount.toLocaleString()} 字 · 点击恢复到编辑器</span></button>) : <p>保存正文后，这里会保留最近 30 个版本。</p>}</div></section></div>}{writingHistoryOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setWritingHistoryOpen(false)}><section className="history-modal writing-history-modal" role="dialog" aria-modal="true" aria-labelledby="writing-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>码字记录</span><h2 id="writing-history-title">{activeProject?.title}</h2></div><button onClick={() => setWritingHistoryOpen(false)} aria-label="关闭"><X size={19} /></button></header><div className="history-list">{writingSessions.length ? writingSessions.map((session) => { const netWords = session.endWordCount - session.startWordCount; const speed = session.activeSeconds > 0 ? Math.max(0, Math.round(netWords / (session.activeSeconds / 60))) : 0; return <div className="writing-history-row" key={session.id}><b>{new Date(session.endedAt).toLocaleString("zh-CN")}</b><span>第{session.chapterId}章 · {netWords >= 0 ? "+" : ""}{netWords.toLocaleString()} 字 · {Math.floor(session.activeSeconds / 3600).toString().padStart(2, "0")}:{Math.floor(session.activeSeconds % 3600 / 60).toString().padStart(2, "0")}:{(session.activeSeconds % 60).toString().padStart(2, "0")} · {speed.toLocaleString()} 字/分</span></div>; }) : <p>结束一次码字后，这里会保留最近 60 次记录。</p>}</div></section></div>}{importOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setImportOpen(false)}><section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>导入正文</span><h2 id="import-title">{importError ? "无法导入文件" : importFileName}</h2><p>{importError || `已提取 ${importText.replace(/\s/g, "").length.toLocaleString()} 字，将写入当前章节。`}</p></div><button onClick={() => setImportOpen(false)} aria-label="关闭"><X size={19} /></button></header>{!importError && <div className="import-preview">{importText.slice(0, 800)}{importText.length > 800 ? "…" : ""}</div>}<footer><button className="secondary-action" onClick={() => setImportOpen(false)}>取消</button>{!importError && <><button className="secondary-action" onClick={() => applyImport("append")}>追加到末尾</button><button className="primary-action" onClick={() => applyImport("replace")}>替换当前正文</button></>}</footer></section></div>}{creationMode && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreationMode(null)}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>{creationMode === "project" ? "新作品" : "新章节"}</span><h2 id="create-title">{creationMode === "project" ? "给作品取个名字" : "给章节取个名字"}</h2></div><button onClick={() => setCreationMode(null)} aria-label="关闭"><X size={19} /></button></header><label>名称<input autoFocus value={creationTitle} onChange={(event) => setCreationTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createItem(); }} placeholder={creationMode === "project" ? "例如：长安夜航" : "例如：旧信与铜钱"} /></label><footer><button className="secondary-action" onClick={() => setCreationMode(null)}>取消</button><button className="primary-action" onClick={createItem} disabled={!creationTitle.trim()}>{creationMode === "project" ? "创建作品" : "添加章节"}</button></footer></section></div>}</div>
  </main>;
}

export default App;
