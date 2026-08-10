import { requestChatCompletion } from "./model";
import type { ModelConfig, SavedChapter, StoryAnalysis, StoryBeat, StoryCharacter, StoryRelation } from "../types/story";

type AgentPayload = Omit<StoryAnalysis, "updatedAt" | "source">;

export function fallbackAnalysis(chapterList: SavedChapter[]): StoryAnalysis {
  const latest = chapterList[chapterList.length - 1];
  const fullText = chapterList.map((chapter) => chapter.content).join("\n");
  const names = Array.from(new Set((fullText.match(/[\u4e00-\u9fa5]{2,4}/g) || []).filter((name) => name.length >= 2))).slice(0, 4);
  return {
    summary: latest ? `已保存「${latest.title}」。配置模型后，故事 Agent 会把已保存章节归纳为完整剧情摘要。` : "尚未保存章节。",
    beats: latest ? [{ title: latest.title, detail: `已保存 ${latest.content.replace(/\s/g, "").length.toLocaleString()} 字，等待语义整理。`, status: "done" }] : [],
    characters: names.map((name) => ({ name, role: "待模型识别", state: "已在保存内容中出现" })),
    relations: [],
    warnings: ["未配置模型，当前仅建立本地文本索引。"],
    updatedAt: new Date().toISOString(),
    source: "local",
  };
}

function parseAgentAnalysis(raw: string): AgentPayload {
  const json = raw.replace(/^```json\s*|^```|```$/gim, "").trim();
  const parsed = JSON.parse(json) as Partial<AgentPayload>;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "模型未返回可用摘要。",
    beats: Array.isArray(parsed.beats) ? parsed.beats.filter((beat): beat is StoryBeat => Boolean(beat && typeof beat.title === "string" && typeof beat.detail === "string" && (beat.status === "done" || beat.status === "next"))) : [],
    characters: Array.isArray(parsed.characters) ? parsed.characters.filter((person): person is StoryCharacter => Boolean(person && typeof person.name === "string" && typeof person.role === "string" && typeof person.state === "string")) : [],
    relations: Array.isArray(parsed.relations) ? parsed.relations.filter((relation): relation is StoryRelation => Boolean(relation && typeof relation.from === "string" && typeof relation.to === "string" && typeof relation.label === "string")) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((warning): warning is string => typeof warning === "string") : [],
  };
}

export async function analyzeSavedChapters(config: ModelConfig, chapterList: SavedChapter[]): Promise<StoryAnalysis> {
  if (!config.apiKey) return fallbackAnalysis(chapterList);
  const corpus = chapterList.map((chapter) => `【第${chapter.id}章 ${chapter.title}】\n${chapter.content}`).join("\n\n");
  const content = await requestChatCompletion(config, {
    temperature: 0.25,
    maxTokens: 1800,
    jsonResponse: true,
    messages: [
      { role: "system", content: "你是长篇中文小说的故事编辑 Agent。只能根据提供的已保存章节做整理，不得编造。返回 JSON：summary(string), beats([{title,detail,status:done|next}]), characters([{name,role,state}]), relations([{from,to,label}]), warnings(string[])。summary 简洁描述已发生剧情；next 仅在文本明确指向后续行动时使用。" },
      { role: "user", content: corpus },
    ],
  });
  return { ...parseAgentAnalysis(content), updatedAt: new Date().toISOString(), source: "agent" };
}
