# 架构说明

## 数据边界

`NovelProject` 是作品元数据和章节目录；正文以 `SavedChapter` 独立保存。每个作品拥有独立的章节正文和 `StoryAnalysis` 键，切换作品时同步切换这三类数据。

## Agent 流程

1. 作者点击保存，正文进入该作品的已保存章节集合。
2. `runStoryAgent` 根据保存触发、手动触发或定时触发调用 `analyzeSavedChapters`。
3. `storyAgent.ts` 要求模型只从已保存章节提取摘要、节拍、人物、关系和提醒，并验证返回 JSON 的结构。
4. 洞察面板、关系图、故事线和人物工作区读取同一份 `StoryAnalysis`。

写作搭档同样只接收已保存章节和故事分析，不读取尚未保存的草稿。

## Pi Agent 与分层记忆

`services/piAgent.ts` 是所有模型请求的统一运行时。它使用 `@earendil-works/pi-agent-core` 的 `Agent`，通过 Pi 的 OpenAI Completions 适配器连接用户配置的模型，并提供 `read_story_memory` 工具。Agent 每轮保留最近 12 条会话消息，避免长期对话无限增长。

写作搭档与续写会调用 `services/memory.ts` 生成三层有界上下文：

1. 长期层：作品名、故事摘要和一致性提醒。
2. 工作层：人物状态、故事节点和已启用 Skill。
3. 检索层：根据当前问题排序的最多 3 章已保存正文（每章最多 1,800 字）和最多 2 条资料库摘录（每条最多 700 字）。

这三层同时作为系统上下文及 Agent 可调用的只读记忆工具。故事整理仍以所有已保存章节为事实来源，以便它能更新长期层，而不是把旧摘要当成唯一事实。

## Skills

`services/skills.ts` 提供内置写作 Skills；`SkillManager.tsx` 管理启停与 JSON 导入。用户导入的 Skill 和对内置 Skill 的启停覆盖都通过 `storage.ts` 按作品 ID 保存。请求运行前只有启用的 Skill 会进入 Agent 指令。

## 模型适配

`services/model.ts` 是业务层入口；续写、故事 Agent 与写作搭档都共享 Pi 适配层，避免在组件里直接拼接 HTTP 请求。

## 已知发布边界

- API Key 当前存于 WebView 本地存储，适合原型和个人本地使用，不适合多人分发。
- 导出、细粒度版本恢复、SQLite/向量检索和流式响应是下一阶段的持久化能力。
- 生产版应将密钥保管和模型请求移入 Tauri Rust 层。
