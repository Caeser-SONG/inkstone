import type { ModelConfig, SavedChapter, StoryAnalysis } from "../types/story";

type ChatMessage = { role: "system" | "user"; content: string };

type CompletionRequest = {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse?: boolean;
};

function endpoint(config: ModelConfig, path: string) {
  return `${config.baseUrl.replace(/\/$/, "")}${path}`;
}

export async function requestChatCompletion(config: ModelConfig, request: CompletionRequest) {
  const response = await fetch(endpoint(config, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      ...(request.jsonResponse ? { response_format: { type: "json_object" } } : {}),
      messages: request.messages,
    }),
  });
  if (!response.ok) throw new Error(`服务返回 ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("服务没有返回内容");
  return content;
}

export async function testModelConnection(config: Pick<ModelConfig, "baseUrl" | "apiKey">) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
  if (!response.ok) throw new Error(`服务返回 ${response.status}`);
}

export async function generateNovelContinuation(config: ModelConfig, draft: string) {
  return requestChatCompletion(config, {
    temperature: 0.8,
    maxTokens: 900,
    messages: [
      { role: "system", content: "你是中文长篇小说写作助手。延续用户提供的正文，保持人物、叙事视角和文风一致。只输出可直接插入的正文。" },
      { role: "user", content: draft },
    ],
  });
}

export async function askWritingAgent(config: ModelConfig, question: string, chapters: SavedChapter[], analysis: StoryAnalysis | null) {
  const context = chapters.map((chapter) => `【第${chapter.id}章 ${chapter.title}】\n${chapter.content}`).join("\n\n");
  const summary = analysis ? `已有故事整理：${analysis.summary}\n人物：${analysis.characters.map((person) => `${person.name}（${person.role}，${person.state}）`).join("；")}` : "尚未生成故事整理。";
  return requestChatCompletion(config, {
    temperature: 0.65,
    maxTokens: 1000,
    messages: [
      { role: "system", content: "你是中文长篇小说的写作搭档。只能基于用户提供的已保存章节与故事整理回答；若信息不足，直接说明缺少什么。回答务实、具体，可给出结构或改写建议，不要编造既有剧情。" },
      { role: "user", content: `${summary}\n\n已保存章节：\n${context || "尚无已保存章节"}\n\n作者的问题：${question}` },
    ],
  });
}
