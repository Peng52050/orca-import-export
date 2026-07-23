# Orca Note Import/Export Plugin

一个支持多格式文件导入导出的 Orca Note 插件，具备完整的高亮语法转换和交互式 UI。

## 功能特性

### 导入功能
- **支持格式**: `.md` / `.txt` / `.HTML` / `.OPML` / `.json`
- **自动检测**: 根据文件内容自动识别格式
- **导入选项**:
  - 无序列表大纲（`-` 符号缩进）
  - 有序列表大纲（`1.` 编号缩进）
  - 标准 Markdown（`#` 标题层级）
- **高亮语法自动转换**: 导入时自动将 Logseq/Obsidian/HTML 高亮语法转换为 Orca 原生高亮
- **实时预览**: 导入前可预览解析结果

### 导出功能
- **支持格式**: `.md` / `.txt` / `.HTML` / `.OPML` / `.doc` / `.json`
- **导出样式**: Logseq / Obsidian / Orca Note / SiYuan

#### Obsidian 模式
- **Obsidian Markdown**: 带 Obsidian 高亮语法
- 大纲（无序列表/有序列表/任务列表/树形）
- HTML（大纲）
- 纯文本（大纲）

#### Logseq 模式
- **Logseq Markdown**: 带 Logseq 高亮语法
- 大纲类格式
- HTML / JSON / OPML / 纯文本

#### Orca Note 模式
- **Orca Markdown**: 带 Orca 原生高亮语法
- 大纲类格式
- HTML / Word（支持传统标签/Orca 原生两种模式）
- JSON / OPML / 纯文本

#### SiYuan 模式
- **SiYuan Markdown**: 带思源笔记高亮语法
- 大纲类格式
- HTML / JSON / OPML / 纯文本

### 高亮语法支持

| 平台 | 背景高亮 | 文字高亮 | 挖空 |
|------|---------|---------|------|
| Logseq | `[[#red]]==text==` | `[[$red]]==text==` | `[[#cloze]]==text==` |
| Obsidian | `<span style="background:#ff4d4f">text</span>` | `<span style="color:#F36208;font-weight:600;">text</span>` | `==text==` |
| Orca | `bc bcc-red` | `fc fcc-red` | `h` |
| SiYuan | `<span data-type="backgroundColor">text</span>` | `<span data-type="color">text</span>` | `==text==` |

## UI 交互

- **工具栏按钮**: 导入(↑)和导出(↓)按钮
- **斜杠命令**: `/import` 或 `/export`
- **导入对话框**: 文件拖拽/选择 → 格式自动检测 → 选项选择 → 实时预览 → 导入
- **导出对话框**: 格式卡片选择（大纲类/Markdown 类/文档类分组）→ 最大深度选择(H1~H10) → Word 标签模式 → 富文本开关 → 挖空选项 → 实时预览 → 导出

## 安装

1. 找到 Orca Note 的数据目录（设置 → 高级 → 数据目录）
2. 将 `orca-import-export` 文件夹放入 `{dataDir}/plugins/` 目录
3. 在 Orca Note 设置 → 插件中启用插件

## 构建

```bash
cd orca-import-export
npm install
npm run build
```

构建完成后会自动生成 `orca-import-export_v{version}_{date}_{time}.zip` 压缩包。

## 文件结构

```
orca-import-export/
├── src/
│   ├── main.ts           # 插件入口
│   ├── orca.d.ts         # Orca API 类型定义
│   ├── highlight.ts      # 高亮语法转换
│   ├── parser.ts         # 文件解析
│   ├── formatter.ts      # 格式生成与导出
│   ├── renderer.ts       # Fragment 渲染器
│   ├── fold.ts           # 折叠状态处理
│   ├── settings.ts       # 设置管理
│   └── ui/
│       └── Dialog.tsx    # 导入/导出对话框
├── dist/
│   └── index.js          # 编译后的插件
├── scripts/
│   └── zip.mjs           # 自动打包脚本
├── icon.png
├── icon.svg
├── package.json
├── tsconfig.json
├── vite.config.js
├── README.md
├── CHANGELOG.md
└── 使用说明.md
```

## 依赖

- React ^18.2.0 (peer dependency)
- Valtio ^1.13.2 (peer dependency)

## 版本记录

查看 [CHANGELOG.md](CHANGELOG.md) 获取完整版本更新历史。
