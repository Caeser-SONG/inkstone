# 架构说明

## 数据边界

`NovelProject` 是作品元数据和章节目录；正文以 `SavedChapter` 独立保存。每个作品拥有独立的章节正文和 `StoryAnalysis` 键，切换作品时同步切换这三类数据。

## Agent 流程

1. 作者点击保存，正文进入该作品的已保存章节集合。
2. `runStoryAgent` 根据保存触发、手动触发或定时触发调用 `analyzeSavedChapters`。
3. `storyAgent.ts` 要求模型只从已保存章节提取摘要、节拍、人物、关系和提醒，并验证返回 JSON 的结构。
4. 洞察面板、关系图、故事线和人物工作区读取同一份 `StoryAnalysis`。

写作搭档同样只接收已保存章节和故事分析，不读取尚未保存的草稿。

## 模型适配

`services/model.ts` 封装 OpenAI 兼容接口。续写、故事 Agent 与写作搭档共享该适配层，避免在组件里直接拼接 HTTP 请求。

## 已知发布边界

- API Key 当前存于 WebView 本地存储，适合原型和个人本地使用，不适合多人分发。
- 导出、细粒度版本恢复、SQLite/向量检索和流式响应是下一阶段的持久化能力。
- 生产版应将密钥保管和模型请求移入 Tauri Rust 层。
