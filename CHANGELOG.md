# Changelog

## [2.4.8] - 2026-07-23

### Changed
- 更名：统一 markdown label 命名为 `{样式名} Markdown`（obsidian="Obsidian Markdown"、orca="Orca Markdown"、logseq="Logseq Markdown"、siyuan="SiYuan Markdown"）
- 修复：obsidian 样式下 markdown 格式采用 Obsidian markdown 语法 + 兼容富文本
- 优化：`OBSIDIAN_CONFIG.fg` 从旧式 `<font color>` 改为现代 `<span style="color:hex;font-weight:600">`
- 优化：预览与导出配置一致化
- 优化：`fragsToText` 新增 txt 全局判断，obsidian 分支按 format 分流
- 优化：4 个列表函数参数化为 `toHierarchyListBase` + `ListSpec`，消除约 65 行重复代码
- 优化：格式下拉新增 `<optgroup>` 分组（大纲类 / Markdown 类 / 文档类）
- 优化：最大深度选项补齐 5/7/8/10（原仅 2/3/4/6）
- 优化：Word 标签模式控件从设置面板移至导出对话框，仅在 orca+doc 时上下文显示
- 优化：富文本开关从 subTabs 移至 configBar
- 优化：折叠按钮 title 明确提示"将修改笔记中实际块的折叠状态"

### Added
- obsidian 样式新增 `html` 格式
- 所有样式（logseq/obsidian/siyuan）新增 `txt` 纯文本格式

### Removed
- 移除死控件 `bodyMode`

## [2.4.7] - 2026-07-14

### Changed
- 版本号显示方式优化：从设置面板顶部徽章改为插件名旁边蓝色胶囊
- 解决`findPanel`要求元素同时满足`Orca`实际`DOM`两个文本的严苛要求，导致的错误

## [2.4.6] - 2026-07-08

### Fixed
- 修复版本号显示位置：findPanel 匹配策略放宽
- 修复 `Array(0)` 空面板诊断问题
- 优化 5s 诊断日志

### Changed
- UI 布局优化：去掉 "样式设置" section label
- 挖空语法选项改为单行排列
- 富文本开关移至预览/源码标签同一行
- 导入/导出对话框去掉 `{{c1::内容}}`（cloze-idx-brace）语法支持

## [2.4.5] - 2026-07-08

### Fixed
- 修复版本号 DOM 徽章无法显示
- 修复 `position: 'child'` 导致 orphan 块问题
- 修复 `insertBatchSiblings` 匹配条件逻辑错误

### Changed
- UI 布局优化：富文本/挖空并排两列
- 挖空语法选项移除 `cloze-idx-brace`
- 版本号显示改为纯文本展示

## [2.4.4] - 2026-07-08

### Changed
- P1 优化：拆分 `handleImport`，提取 `ImportContext` 类
- P2 优化：补充 `Block` 接口 `_repr` 字段类型
- P3 优化：清理死代码

## [2.4.3] - 2026-07-08

### Added
- 新增 `waitForNewChildren` 自适应轮询机制
- 新增 `insertWithRetry` 失败重试机制
- 新增进度遮罩层取消机制

## [2.4.2] - 2026-07-08

### Added
- 首次实现版本号 DOM 徽章注入
- 支持暗色主题适配

## [2.4.1] - 2026-07-07

### Fixed
- 修复 `position: 'child'` 创建 orphan 块问题
- 修复递归子块插入的 parent 引用混用问题
- 修复子块插入轮询超时问题

## [2.4.0] - 2026-07-07

### Added
- 多格式导入支持：.md / .txt / .html / .opml / .json
- 多格式导出支持：Markdown / HTML / Word / OPML / JSON
- 多种导出样式：Logseq / Obsidian / Orca Note / SiYuan
- 高亮语法转换
- 挖空语法支持
- 图片块检测
- 文件下载多级策略
- 拖拽导入区域视觉反馈
- 导入/导出对话框实时预览
