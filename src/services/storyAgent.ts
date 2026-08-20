import { requestChatCompletion } from "./model";
import type { ModelConfig, SavedChapter, StoryAnalysis, StoryBeat, StoryChange, StoryCharacter, StoryCheck, StoryEvidence, StoryMemory, StoryMemoryKind, StoryRelation } from "../types/story";

type AgentPayload = Omit<StoryAnalysis, "updatedAt" | "source" | "changes">;

const memoryKinds: StoryMemoryKind[] = ["character", "relationship", "setting", "timeline", "foreshadowing"];

function normalizeKey(value: string) { return value.trim().replace(/\s+/g, " ").toLowerCase(); }
function memoryId(kind: StoryMemoryKind, title: string) { return `memory:${kind}:${normalizeKey(title)}`; }

function evidenceFrom(chapterList: SavedChapter[], raw: unknown): StoryEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as { chapterId?: unknown; excerpt?: unknown };
    const chapter = chapterList.find((item) => item.id === Number(value.chapterId));
    const excerpt = typeof value.excerpt === "string" ? value.excerpt.trim() : "";
    if (!chapter || !excerpt || !chapter.content.includes(excerpt)) return [];
    return [{ chapterId: chapter.id, chapterTitle: chapter.title, excerpt }];
  }).slice(0, 3);
}

function sourceExcerpt(chapter?: SavedChapter): StoryEvidence[] {
  if (!chapter?.content.trim()) return [];
  const excerpt = chapter.content.trim().replace(/\s+/g, " ").slice(0, 110);
  return excerpt ? [{ chapterId: chapter.id, chapterTitle: chapter.title, excerpt }] : [];
}

function parseMemories(raw: unknown, chapterList: SavedChapter[], previous?: StoryAnalysis): StoryMemory[] {
  if (!Array.isArray(raw)) return [];
  const previousById = new Map((previous?.memories || []).map((memory) => [memory.id, memory]));
  return raw.flatMap((entry): StoryMemory[] => {
    if (!entry || typeof entry !== "object") return [];
    const memory = entry as { kind?: unknown; title?: unknown; detail?: unknown; evidence?: unknown };
    if (!memoryKinds.includes(memory.kind as StoryMemoryKind) || typeof memory.title !== "string" || typeof memory.detail !== "string") return [];
    const id = memoryId(memory.kind as StoryMemoryKind, memory.title);
    const existing = previousById.get(id);
    if (existing?.origin === "author") return [{ ...existing, updatedAt: existing.updatedAt }];
    return [{ id, kind: memory.kind as StoryMemoryKind, title: memory.title.trim(), detail: memory.detail.trim(), status: existing?.status || "pending", evidence: evidenceFrom(chapterList, memory.evidence), updatedAt: new Date().toISOString() }];
  }).filter((memory, index, list) => Boolean(memory.title && memory.detail) && list.findIndex((candidate) => candidate.id === memory.id) === index).slice(0, 30);
}

function parseChecks(raw: unknown, chapterList: SavedChapter[]): StoryCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): StoryCheck[] => {
    if (!entry || typeof entry !== "object") return [];
    const check = entry as { severity?: unknown; title?: unknown; detail?: unknown; evidence?: unknown };
    if (!(["blocker", "attention", "suggestion"] as const).includes(check.severity as StoryCheck["severity"]) || typeof check.title !== "string" || typeof check.detail !== "string") return [];
    return [{ id: `check:${normalizeKey(check.title)}`, severity: check.severity as StoryCheck["severity"], title: check.title.trim(), detail: check.detail.trim(), evidence: evidenceFrom(chapterList, check.evidence) }];
  }).filter((check) => Boolean(check.title && check.detail)).slice(0, 8);
}

function deriveChanges(memories: StoryMemory[], checks: StoryCheck[], previous?: StoryAnalysis): StoryChange[] {
  const previousById = new Map((previous?.memories || []).map((memory) => [memory.id, memory]));
  const memoryChanges: StoryChange[] = [];
  memories.forEach((memory) => {
    const prior = previousById.get(memory.id);
    if (!prior) memoryChanges.push({ id: `change:added:${memory.id}`, type: "added", title: `新增${memory.title}`, detail: memory.detail, evidence: memory.evidence });
    else if (normalizeKey(prior.detail) !== normalizeKey(memory.detail)) memoryChanges.push({ id: `change:updated:${memory.id}`, type: "updated", title: `${memory.title}状态更新`, detail: memory.detail, evidence: memory.evidence });
  });
  const warnings: StoryChange[] = checks.map((check) => ({ id: `change:warning:${check.id}`, type: "warning", title: check.title, detail: check.detail, evidence: check.evidence }));
  return [...memoryChanges, ...warnings].slice(0, 8);
}

export function fallbackAnalysis(chapterList: SavedChapter[]): StoryAnalysis {
  const latest = chapterList[chapterList.length - 1];
  // Chinese prose cannot be safely treated as named entities with a short regex.
  // Until a model is configured, prefer an empty index over incorrect character facts.
  const names: string[] = [];
  const evidence = sourceExcerpt(latest);
  const memories: StoryMemory[] = names.map((name) => ({ id: memoryId("character", name), kind: "character", title: name, detail: "已在保存内容中出现，等待模型识别角色与状态。", status: "pending", evidence, updatedAt: new Date().toISOString() }));
  const checks: StoryCheck[] = [{ id: "check:local-model", severity: "suggestion", title: "尚未进行语义检查", detail: "配置模型后，可根据已保存章节检查人物、时间线与设定一致性。", evidence: [] }];
  return {
    summary: latest ? `已保存「${latest.title}」。配置模型后，故事 Agent 会把已保存章节归纳为完整剧情摘要。` : "尚未保存章节。",
    beats: latest ? [{ title: latest.title, detail: `已保存 ${latest.content.replace(/\s/g, "").length.toLocaleString()} 字，等待语义整理。`, status: "done" }] : [],
    characters: names.map((name) => ({ name, role: "待模型识别", state: "已在保存内容中出现" })),
    relations: [],
    warnings: ["未配置模型，当前仅建立本地文本索引。"],
    memories,
    changes: memories.map((memory) => ({ id: `change:added:${memory.id}`, type: "added" as const, title: `发现人物「${memory.title}」`, detail: memory.detail, evidence: memory.evidence })),
    checks,
    updatedAt: new Date().toISOString(),
    source: "local",
  };
}

function parseAgentAnalysis(raw: string, chapterList: SavedChapter[], previous?: StoryAnalysis): AgentPayload {
  const json = raw.replace(/^```json\s*|^```|```$/gim, "").trim();
  const parsed = JSON.parse(json) as Partial<AgentPayload>;
  const memories = parseMemories(parsed.memories, chapterList, previous);
  const checks = parseChecks(parsed.checks, chapterList);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "模型未返回可用摘要。",
    beats: Array.isArray(parsed.beats) ? parsed.beats.filter((beat): beat is StoryBeat => Boolean(beat && typeof beat.title === "string" && typeof beat.detail === "string" && (beat.status === "done" || beat.status === "next"))) : [],
    characters: Array.isArray(parsed.characters) ? parsed.characters.filter((person): person is StoryCharacter => Boolean(person && typeof person.name === "string" && typeof person.role === "string" && typeof person.state === "string")) : [],
    relations: Array.isArray(parsed.relations) ? parsed.relations.filter((relation): relation is StoryRelation => Boolean(relation && typeof relation.from === "string" && typeof relation.to === "string" && typeof relation.label === "string")) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((warning): warning is string => typeof warning === "string") : [],
    memories,
    checks,
  };
}

export async function analyzeSavedChapters(config: ModelConfig, chapterList: SavedChapter[], previous?: StoryAnalysis): Promise<StoryAnalysis> {
  if (!config.apiKey) return fallbackAnalysis(chapterList);
  const corpus = chapterList.map((chapter) => `【第${chapter.id}章 ${chapter.title}】\n${chapter.content}`).join("\n\n");
  const content = await requestChatCompletion(config, {
    temperature: 0.25,
    maxTokens: 1800,
    jsonResponse: true,
    messages: [
      { role: "system", content: "你是长篇中文小说的故事编辑 Agent。只能根据提供的已保存章节做整理，不得编造。返回 JSON：summary(string), beats([{title,detail,status:done|next}]), characters([{name,role,state}]), relations([{from,to,label}]), warnings(string[]), memories([{kind:character|relationship|setting|timeline|foreshadowing,title,detail,evidence:[{chapterId,excerpt}]}]), checks([{severity:blocker|attention|suggestion,title,detail,evidence:[{chapterId,excerpt}]}])。evidence.excerpt 必须逐字摘自对应章节，无法提供证据时不要输出该 memory 或 check。summary 简洁描述已发生剧情；next 仅在文本明确指向后续行动时使用。" },
      { role: "user", content: corpus },
    ],
  });
  const parsed = parseAgentAnalysis(content, chapterList, previous);
  return { ...parsed, changes: deriveChanges(parsed.memories || [], parsed.checks || [], previous), dismissedCheckIds: previous?.dismissedCheckIds || [], updatedAt: new Date().toISOString(), source: "agent" };
}
