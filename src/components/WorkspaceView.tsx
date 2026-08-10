import { BookOpen, Compass, FolderOpen, UsersThree } from "@phosphor-icons/react";
import type { StoryAnalysis, View } from "../types/story";

type IconType = typeof BookOpen;

export function WorkspaceView({ view, onWrite, analysis }: { view: Exclude<View, "write">; onWrite: () => void; analysis: StoryAnalysis | null }) {
  const content: Record<Exclude<View, "write">, { icon: IconType; title: string; detail: string; action: string }> = {
    outline: { icon: Compass, title: "让故事线保持向前", detail: "从卷到场景拆解叙事目标，AI 会在章节完成后标记推进、冲突与待回收伏笔。", action: "查看第一卷故事线" },
    characters: { icon: UsersThree, title: "角色不是散落的名字", detail: "将人物动机、秘密、关系和状态放在同一张可检索的关系网中。", action: "打开人物关系图" },
    library: { icon: FolderOpen, title: "为世界观建立可靠资料库", detail: "收集地点、设定、灵感和参考文本。生成时只召回与你正在写的章节有关的内容。", action: "新建资料卡" },
  };
  const item = content[view]; const Icon = item.icon;
  const outlineItems = analysis?.beats.length ? analysis.beats : [{ title: "尚未生成故事线", detail: "保存正文后由故事 Agent 整理" }];
  const characterItems = analysis?.characters.length ? analysis.characters : [];
  return <div className="empty-workspace"><div className="empty-icon"><Icon size={34} weight="duotone" /></div><span>演示项目 · 归舟书局</span><h2>{item.title}</h2><p>{item.detail}</p><button className="primary-action" onClick={view === "outline" || view === "characters" ? undefined : onWrite}>{item.action}</button>{view === "outline" && <div className="outline-preview">{outlineItems.map((beat, index) => <div key={`${beat.title}-${index}`}><b>{beat.title}</b><span>{beat.detail}</span></div>)}</div>}{view === "characters" && <div className="outline-preview">{characterItems.length ? characterItems.map((person) => <div key={person.name}><b>{person.name}</b><span>{person.role} · {person.state}</span></div>) : <div><b>尚未识别人物</b><span>保存正文后由故事 Agent 整理</span></div>}</div>}</div>;
}
