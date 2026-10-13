import { useState } from "react";
import {
  CheckCircle,
  Compass,
  MagicWand,
  NotePencil,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  analyzePlot,
  createContinuationPlan,
  writeFromContinuationPlan,
  type AgentContext,
} from "../services/model";
import type { ModelConfig } from "../types/story";

type AssistantMode = "analysis" | "continuation";
type BusyTask = "analysis" | "plan" | "prose" | null;

type Props = {
  config: ModelConfig;
  draft: string;
  context: AgentContext;
  initialMode: AssistantMode;
  onClose: () => void;
  onInsert: (content: string) => void;
};

export function WritingAssistantModal({
  config,
  draft,
  context,
  initialMode,
  onClose,
  onInsert,
}: Props) {
  const [mode, setMode] = useState<AssistantMode>(initialMode);
  const [busy, setBusy] = useState<BusyTask>(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState("");
  const [prose, setProse] = useState("");

  const requireModel = () => {
    if (config.apiKey) return true;
    setError(
      "请先在模型与偏好设置中填写 API Key，才能使用剧情分析与续写帮助。",
    );
    return false;
  };
  const run = async (
    task: Exclude<BusyTask, null>,
    callback: () => Promise<string>,
    update: (value: string) => void,
  ) => {
    if (!draft.trim()) {
      setError("请先写入一些正文，再让 Agent 分析或续写。");
      return;
    }
    if (!requireModel()) return;
    setBusy(task);
    setError("");
    try {
      update(await callback());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "这次请求没有完成，请检查模型设置后重试。",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="writing-assistant-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="writing-assistant-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>
              <Sparkle size={15} weight="fill" />
              AI 写作辅助
            </span>
            <h2 id="writing-assistant-title">先判断，再落笔</h2>
            <p>
              Agent
              只读取当前草稿、已保存正文与已确认故事信息；结果不会自动改写正文。
            </p>
          </div>
          <button onClick={onClose} aria-label="关闭写作辅助">
            <X size={19} />
          </button>
        </header>
        <div
          className="writing-assistant-tabs"
          role="tablist"
          aria-label="写作辅助方式"
        >
          <button
            role="tab"
            aria-selected={mode === "analysis"}
            className={mode === "analysis" ? "selected" : ""}
            onClick={() => setMode("analysis")}
          >
            <Compass size={16} weight="fill" />
            分析剧情
          </button>
          <button
            role="tab"
            aria-selected={mode === "continuation"}
            className={mode === "continuation" ? "selected" : ""}
            onClick={() => setMode("continuation")}
          >
            <MagicWand size={16} weight="fill" />
            帮助续写
          </button>
        </div>
        <div className="writing-assistant-body">
          {mode === "analysis" ? (
            <section className="assistant-workspace" role="tabpanel">
              <div className="assistant-brief">
                <b>剧情分析</b>
                <p>
                  检查本章如何承接前情、人物动机是否成立，以及下一步有哪些不同代价的推进方向。
                </p>
              </div>
              <button
                className="primary-action assistant-run"
                onClick={() =>
                  void run(
                    "analysis",
                    () => analyzePlot(config, draft, context),
                    setAnalysis,
                  )
                }
                disabled={busy !== null}
              >
                {busy === "analysis" ? (
                  "正在分析剧情…"
                ) : (
                  <>
                    <Compass size={16} weight="fill" />
                    分析当前剧情
                  </>
                )}
              </button>
              {analysis ? (
                <div className="assistant-result">
                  <header>
                    <b>剧情分析结果</b>
                    <span>可复制或带入续写方案</span>
                  </header>
                  <article>{analysis}</article>
                </div>
              ) : (
                <div className="assistant-empty">
                  <Compass size={23} weight="duotone" />
                  <p>
                    点击“分析当前剧情”后，会在这里显示承接、冲突、风险和三种推进方向。
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section className="assistant-workspace" role="tabpanel">
              <div className="assistant-brief">
                <b>续写帮助</b>
                <p>
                  先生成场景级方案。你可以修改方案，再决定是否让 Agent
                  写成正文。
                </p>
              </div>
              <label className="assistant-instruction">
                本次续写要求
                <textarea
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder="例如：让沈砚发现铜钱来源，但不要立刻揭露父亲去向。留空则根据当前冲突推进。"
                />
              </label>
              <button
                className="primary-action assistant-run"
                onClick={() =>
                  void run(
                    "plan",
                    () =>
                      createContinuationPlan(
                        config,
                        draft,
                        instruction,
                        context,
                      ),
                    setPlan,
                  )
                }
                disabled={busy !== null}
              >
                {busy === "plan" ? (
                  "正在规划续写…"
                ) : (
                  <>
                    <NotePencil size={16} weight="fill" />
                    生成续写方案
                  </>
                )}
              </button>
              {plan ? (
                <div className="assistant-result continuation-plan">
                  <header>
                    <b>续写方案</b>
                    <span>可直接修改，再写成正文</span>
                  </header>
                  <textarea
                    aria-label="续写方案"
                    value={plan}
                    onChange={(event) => setPlan(event.target.value)}
                  />
                  <button
                    className="secondary-action assistant-write"
                    onClick={() =>
                      void run(
                        "prose",
                        () =>
                          writeFromContinuationPlan(
                            config,
                            draft,
                            plan,
                            context,
                          ),
                        setProse,
                      )
                    }
                    disabled={busy !== null || !plan.trim()}
                  >
                    {busy === "prose" ? (
                      "正在写成正文…"
                    ) : (
                      <>
                        <MagicWand size={15} weight="fill" />
                        按方案写 800 字
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="assistant-empty">
                  <NotePencil size={23} weight="duotone" />
                  <p>
                    方案会明确场景目标、动作动机、冲突升级、信息揭示和章末钩子。
                  </p>
                </div>
              )}
              {prose ? (
                <div className="assistant-result prose-preview">
                  <header>
                    <b>可插入正文</b>
                    <span>插入前仍可修改</span>
                  </header>
                  <textarea
                    aria-label="续写正文预览"
                    value={prose}
                    onChange={(event) => setProse(event.target.value)}
                  />
                  <button
                    className="primary-action assistant-insert"
                    onClick={() => onInsert(prose)}
                    disabled={!prose.trim()}
                  >
                    <CheckCircle size={16} weight="fill" />
                    插入到正文末尾
                  </button>
                </div>
              ) : null}
            </section>
          )}
          {error && (
            <p className="assistant-error" role="alert">
              <WarningCircle size={16} weight="fill" />
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
