# 架构说明

## 数据边界

`NovelProject` 是作品元数据和章节目录；正文以 `SavedChapter` 独立保存。桌面版启动时通过 `nativeStore.ts` 调用 Tauri 原生命令，将原有 WebView 数据一次性迁移到 SQLite。SQLite 位于 macOS 应用数据目录，使用 WAL 模式；`chapters` 表以 `(project_id, chapter_id)` 为主键，每次保存只更新当前章节，而不是重写整部作品。

运行时会保留一份内存缓存供 React 同步读取，但数据库才是持久化主副本。每次保存还会写入 `~/Documents/墨舟作品/<作品ID>/chapters/0001.md` 这样的 Markdown 镜像，并在同目录 `backups/` 中保留每章最近 20 份版本。旧 `localStorage` 不会被自动删除，避免迁移失败时丢失数据。

## 正文导入

顶栏导入入口接受 `.txt`、`.md`、`.doc` 和 `.docx`。纯文本文件在 WebView 中本地读取；Word 文件的二进制内容只暂存到系统临时目录，交由 macOS `textutil` 转成纯文本后立即删除临时文件。解析结果先在界面预览，用户明确选择“替换当前正文”或“追加到末尾”才会改动编辑器；之后仍需用户点击保存才会写入章节版本。

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

## 公开网络搜索

`src-tauri/src/lib.rs` 中的 `web_search` 命令通过 macOS 自带 `curl` 获取公开搜索结果页，并只返回搜索结果卡片的标题、链接和摘要。`services/webSearch.ts` 是前端调用入口：资料库展示结果并可一键收藏；`piAgent.ts` 则把同一入口提供为 Pi 的 `web_search` 工具。该工具不打开结果页、不下载文本，也不返回小说全文。

## 模型适配

`services/model.ts` 是业务层入口；续写、故事 Agent 与写作搭档都共享 Pi 适配层，避免在组件里直接拼接 HTTP 请求。

## 已知发布边界

- API Key 当前仍保存在本机 SQLite 条目中；生产分发前应迁移到 macOS Keychain。
- 当前已具备 SQLite 主存储、章节级写入和 Markdown 自动镜像；全文检索与向量检索仍是后续能力。
- 生产版应将密钥保管和模型请求移入 Tauri Rust 层。
