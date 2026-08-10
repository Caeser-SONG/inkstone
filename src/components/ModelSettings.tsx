import { useState } from "react";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { testModelConnection } from "../services/model";
import type { ModelConfig } from "../types/story";

export function ModelSettings({ config, onClose, onSaved }: { config: ModelConfig; onClose: () => void; onSaved: (config: ModelConfig) => void }) {
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [agentInterval, setAgentInterval] = useState(config.agentInterval);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const testConnection = async () => {
    if (!baseUrl || !apiKey) { setTestState("error"); setTestMessage("请填写接口地址和 API Key。"); return; }
    setTestState("testing"); setTestMessage("");
    try {
      await testModelConnection({ baseUrl, apiKey });
      setTestState("success"); setTestMessage("连接成功");
    } catch (error) {
      setTestState("error"); setTestMessage(error instanceof Error ? error.message : "连接失败");
    }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>AI 能力</span><h2 id="settings-title">模型配置</h2><p>模型参数和密钥仅保存在本机应用数据中。</p></div><button onClick={onClose} aria-label="关闭模型配置"><X size={19} /></button></header><div className="settings-body"><label>服务商<select value={provider} onChange={(event) => setProvider(event.target.value)}><option>Moonshot AI</option><option>OpenAI 兼容接口</option><option>DeepSeek</option><option>本地 Ollama</option></select></label><label>模型名称<input value={model} onChange={(event) => setModel(event.target.value)} /></label><label>接口地址<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label><label>API Key <input type="password" placeholder="粘贴 API Key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label><label>自动整理频率<select value={agentInterval} onChange={(event) => setAgentInterval(Number(event.target.value))}><option value={0}>仅在保存时整理</option><option value={5}>每 5 分钟</option><option value={15}>每 15 分钟</option><option value={30}>每 30 分钟</option></select></label><div className="settings-toggle"><div><b>生成时引用本书记忆</b><span>自动检索人物卡、故事线和相关章节</span></div><button className="switch enabled" aria-label="已启用本书记忆"><i /></button></div><div className="settings-toggle"><div><b>先生成提纲，再写正文</b><span>让每次生成都保留作者可控的结构节点</span></div><button className="switch" aria-label="未启用先生成提纲"><i /></button></div></div><footer>{testState === "success" && <span className="connection-ok"><CheckCircle size={17} weight="fill" />{testMessage}</span>}{testState === "error" && <span className="connection-error"><WarningCircle size={17} weight="fill" />{testMessage}</span>}<button className="secondary-action" onClick={testConnection} disabled={testState === "testing"}>{testState === "testing" ? "正在测试" : "测试连接"}</button><button className="primary-action" onClick={() => onSaved({ provider, model, baseUrl, apiKey, agentInterval })}>保存配置</button></footer></section></div>;
}
