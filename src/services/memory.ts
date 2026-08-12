import type { LayeredMemory, LibraryItem, NovelProject, SavedChapter, StoryAnalysis, WritingSkill } from "../types/story";

const excerpt = (text: string, length: number) => text.replace(/\s+/g, " ").trim().slice(0, length);

function score(text: string, query: string) {
  const terms = Array.from(new Set((query.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]{3,}/g) || []).map((term) => term.toLowerCase())));
  return terms.reduce((total, term) => total + (text.toLowerCase().includes(term) ? 4 : 0), 0);
}

/** Creates a bounded three-layer context: durable project facts, working story state, and retrieved source excerpts. */
export function buildLayeredMemory({ project, question, chapters, analysis, library, skills }: { project?: NovelProject; question: string; chapters: SavedChapter[]; analysis: StoryAnalysis | null; library: LibraryItem[]; skills: WritingSkill[] }): LayeredMemory {
  const projectLayer = [
    `作品：${project?.title || "未命名作品"}`,
    analysis?.summary ? `故事总览：${analysis.summary}` : "故事总览：尚未生成，不能把推测当作既有事实。",
    analysis?.warnings.length ? `一致性提醒：${analysis.warnings.join("；")}` : "一致性提醒：暂无。",
  ].join("\n");
  const working = [
    analysis?.characters.length ? `人物状态：${analysis.characters.map((item) => `${item.name}（${item.role}；${item.state}）`).join("；")}` : "人物状态：暂无结构化人物卡。",
    analysis?.beats.length ? `情节节点：${analysis.beats.map((item) => `${item.status === "next" ? "后续" : "已发生"}·${item.title}：${item.detail}`).join("；")}` : "情节节点：暂无。",
    skills.filter((skill) => skill.enabled).length ? `当前 Skills：${skills.filter((skill) => skill.enabled).map((skill) => `《${skill.name}》`).join("、")}` : "当前 Skills：无。",
  ].join("\n");
  const relevantChapters = [...chapters].sort((a, b) => score(`${b.title}\n${b.content}`, question) - score(`${a.title}\n${a.content}`, question) || b.savedAt.localeCompare(a.savedAt)).slice(0, 3);
  const relevantLibrary = [...library].sort((a, b) => score(`${b.title}\n${b.notes}\n${b.sourceText || ""}`, question) - score(`${a.title}\n${a.notes}\n${a.sourceText || ""}`, question)).slice(0, 2);
  const retrieved = [
    ...relevantChapters.map((chapter) => `【已保存章节·${chapter.title}】\n${excerpt(chapter.content, 1800)}`),
    ...relevantLibrary.filter((item) => item.notes || item.sourceText).map((item) => `【资料库·${item.title}】\n${excerpt(item.notes || item.sourceText || "", 700)}`),
  ].join("\n\n") || "没有与当前问题直接相关的已保存片段。";
  return { project: projectLayer, working, retrieved };
}

export function enabledSkillInstructions(skills: WritingSkill[]) {
  return skills.filter((skill) => skill.enabled).map((skill) => `### Skill：${skill.name}\n${skill.instructions}`).join("\n\n");
}
