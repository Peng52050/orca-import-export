# Changelog

## [2.4.7] - 2026-07-14

### Changed
- 版本号显示方式优化：从设置面板顶部徽章改为插件名旁边蓝色胶囊
- 解决`findPanel`要求元素同时满足`Orca`实际`DOM`两个文本的严苛要求，导致的错误

## [2.4.6] - 2026-07-08

### Fixed
- 修复版本号显示位置：findPanel 匹配策略放宽，支持任一设置标签匹配 + 插件名匹配
- 修复 `Array(0)` 空面板诊断问题：改进 5s 超时日志，输出候选元素列表
- 优化 5s 诊断日志，显示包含"调试开关"或插件名的可见元素详情

### Changed
- UI 布局优化：去掉 "样式设置" section label，挖空配置直接跟在格式卡片下方
- 挖空语法选项改为单行排列（flex-wrap: nowrap）
- 富文本开关移至预览/源码标签同一行
- 导入/导出对话框去掉 `{{c1::内容}}`（cloze-idx-brace）语法支持

## [2.4.5] - 2026-07-08

### Fixed
- 修复版本号 DOM 徽章无法显示：增强 findPanel 探测逻辑（增加尺寸兜底、5s 诊断日志）
- 修复 `position: 'child'` 导致 orphan 块问题：回退到 `'lastChild'` 并手动建立父子关系
- 修复 `insertBatchSiblings` 匹配条件逻辑错误：移除恒真条件 `|| j < newChildren.length`

### Changed
- UI 布局优化：富文本/挖空并排两列，窄屏回退单列
- 挖空语法选项移除 `cloze-idx-brace`（{{c1::xx}}）
- 版本号显示改为纯文本展示（不可编辑/复制），移除点击复制功能
- 去掉可编辑的 version 输入框，仅保留 DOM 徽章注入

## [2.4.4] - 2026-07-08

### Changed
- P1 优化：拆分 `handleImport`，提取 `ImportContext` 类封装导入状态与方法
- P2 优化：补充 `Block` 接口 `_repr` 字段类型，修复 `getBlockTextPrefix` 参数类型
- P3 优化：清理死代码（`scrollToBlock`、`isSimpleTextBlock`、`countPageBlocks` 等未使用函数）
- 提取模块级纯函数：`parseInlineMarkdownLite`、`convertClozeSyntaxInFrags`、`fragsToOrcaMarkdown`

## [2.4.3] - 2026-07-08

### Added
- 新增 `waitForNewChildren` 自适应轮询机制（50ms 间隔，1500ms 超时）
- 新增 `insertWithRetry` 失败重试机制
- 新增进度遮罩层取消机制（AbortSignal 支持）

### Changed
- 挖空语法解析优先级提升：先于 inline Markdown 解析
- 非纯文本路径下 `convertSyntaxToCloze` 添加 `tortoise` case
- 导入/导出对话框增加高亮转换开关（未勾选时仅导入/导出纯文本）
- 进度遮罩层显示标题、状态文本、进度条和计数（X/Y），完成时淡出动画

## [2.4.2] - 2026-07-08

### Added
- 首次实现版本号 DOM 徽章注入（设置面板顶部）
- 支持暗色主题适配（`body[data-theme="dark"]` 检测）
- 插件设置显示版本信息（标题 + 版本号 + 描述）

## [2.4.1] - 2026-07-07

### Fixed
- 修复 `position: 'child'` 创建 orphan 块问题（parent 为 null，children 未加入）
- 修复递归子块插入的 parent 引用混用问题（使用新鲜 block 引用）
- 修复子块插入轮询超时问题（50ms 间隔，最大 2000ms）

## [2.4.0] - 2026-07-07

### Added
- 多格式导入支持：.md / .txt / .html / .opml / .json
- 多格式导出支持：Markdown / HTML / Word / OPML / JSON
- 多种导出样式：Logseq / Obsidian / Orca Note / SiYuan
- 高亮语法转换（导入/导出双向）
- 挖空语法支持（导入识别、导出转换）
- 图片块检测（集中式 `getImageUrl()` helper）
- 文件下载多级策略（File System Access API → Blob → Clipboard）
- 拖拽导入区域视觉反馈
- 导入/导出对话框实时预览（120ms debounce）
