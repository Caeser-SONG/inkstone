import type { WritingSkill } from "../types/story";

const builtin = (id: string, name: string, description: string, instructions: string): WritingSkill => ({ id, name, description, instructions, enabled: true, source: "builtin", installedAt: "2026-08-12T00:00:00.000Z" });

export const builtInWritingSkills: WritingSkill[] = [
  builtin("continuity-check", "伏笔与一致性", "检查人物、时间线、物件和因果是否与已保存内容冲突。", "先核对已保存事实，再给出具体风险与可执行修正；不要把推测写成既有剧情。"),
  builtin("character-motivation", "人物动机", "从人物目标、恐惧和关系变化推演下一步。", "分析人物时先分辨事实和推断；每个建议都说明对应角色的动机与代价。"),
  builtin("webnovel-rhythm", "网文节奏", "面向连载阅读优化冲突、信息揭示和章末钩子。", "保持作者现有题材与文风。建议以场景、冲突、转折、钩子组织，避免空泛套路。"),
];

export function availableSkills(installed: WritingSkill[]) {
  const custom = installed.filter((skill) => skill.source === "installed");
  const overrides = new Map(installed.filter((skill) => skill.source === "builtin").map((skill) => [skill.id, skill]));
  return [...builtInWritingSkills.map((skill) => overrides.get(skill.id) || skill), ...custom];
}

export function parseSkillManifest(raw: string): Omit<WritingSkill, "id" | "enabled" | "source" | "installedAt"> {
  const parsed = JSON.parse(raw) as Partial<WritingSkill>;
  if (!parsed.name?.trim() || !parsed.description?.trim() || !parsed.instructions?.trim()) throw new Error("Skill 需要 name、description 和 instructions 三个非空字段。");
  return { name: parsed.name.trim(), description: parsed.description.trim(), instructions: parsed.instructions.trim() };
}
