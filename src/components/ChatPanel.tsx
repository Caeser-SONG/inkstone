import { useState } from "react";
import { CaretRight, Robot, X } from "@phosphor-icons/react";
import { askWritingAgent } from "../services/model";
import type { ModelConfig, SavedChapter, StoryAnalysis } from "../types/story";

export function ChatPanel({ onClose, config, chapters, analysis }: { onClose: () => void; config: ModelConfig; chapters: SavedChapter[]; analysis: StoryAnalysis | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: "我已读取本章、人物卡和前情。你想推演下一幕，还是先检查某个设定？" }]);
  const send = async () => { const question = message.trim(); if (!question || busy) return; setMessages((all) => [...all, { role: "user", text: question }]); setMessage(""); if (!config.apiKey) { setMessages((all) => [...all, { role: "assistant", text: "请先在模型设置中配置 API Key。配置后，我会基于已保存章节和故事整理回答，而不是使用演示回复。" }]); return; } setBusy(true); try { const answer = await askWritingAgent(config, question, chapters, analysis); setMessages((all) => [...all, { role: "assistant", text: answer }]); } catch (error) { setMessages((all) => [...all, { role: "assistant", text: `回答失败：${error instanceof Error ? error.message : "未知错误"}` }]); } finally { setBusy(false); } };
  return <section className="chat-panel"><header><div><Robot size={18} weight="fill" /><strong>写作搭档</strong><span>读取已保存章节与故事记忆</span></div><button aria-label="关闭对话" onClick={onClose}><X size={17} /></button></header><div className="chat-messages">{messages.map((item, index) => <div className={`message ${item.role}`} key={index}>{item.text}</div>)}{busy && <div className="message">正在思考…</div>}</div><div className="quick-prompts"><button onClick={() => setMessage("给我三个下一幕冲突方案")}>推演冲突</button><button onClick={() => setMessage("检查人物动机")}>检查动机</button></div><div className="chat-input"><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="问问故事、角色或正文…" aria-label="与写作搭档对话" /><button onClick={() => void send()} disabled={busy} aria-label="发送消息"><CaretRight size={20} weight="bold" /></button></div></section>;
}
