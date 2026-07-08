// ============================================================
// 通用 Fragment 渲染器
// ============================================================
// 将 8 个 fragsTo* 函数的公共逻辑抽取为统一渲染器。
// 通过 RenderConfig 策略对象差异化处理各格式（Logseq/Obsidian/Orca/SiYuan/Markdown/HTML/Word/Preview）。
// 原 fragsTo* 函数保留为薄包装，向后兼容。

import type { ContentFragment } from './orca.d.ts';
import { HL_COLORS } from './highlight.ts';

export type ClozeStyle = 'highlight' | 'underline' | 'dashed' | 'plain';

export interface RenderConfig {
  /** 格式名称（仅用于日志） */
  readonly name: string;

  /** 背景高亮 (bc) 渲染函数 */
  bg(color: string, text: string): string;

  /** 文字高亮 (fc) 渲染函数 */
  fg(color: string, text: string): string;

  /** 挖空 (h) 渲染函数 */
  cloze(text: string): string;

  /** 加粗/斜体/删除线 (b) 渲染函数（按 fa 标志组合） */
  bold(text: string, fa: { bold?: boolean; italic?: boolean; strikethrough?: boolean }): string;

  /** 链接/图片 (a) 渲染函数 */
  anchor(url: string, displayText: string, isImage: boolean): string;

  /** 默认文本 (其他类型) 渲染函数 */
  plain(text: string): string;
}

// ------------------------------------------------------------
// 工具：从 ContentFragment 中安全获取链接/图片的显示文本
// ------------------------------------------------------------

/** 从 fragment 的 children 数组中提取显示文本（兼容多种 Orca 内部结构） */
function getDisplayText(f: ContentFragment): string {
  // 优先使用 text 字段（导出时由 formatter 设置）
  const anyF = f as any;
  if (typeof anyF.text === 'string' && anyF.text) return anyF.text;
  // fallback: 从 children 提取
  if (Array.isArray(f.children) && f.children.length > 0) {
    return f.children.map(c => String(c.v ?? '')).join('');
  }
  // 最后 fallback: 返回 URL 本身，避免链接显示为空
  return String(f.v ?? '');
}

// ------------------------------------------------------------
// 通用渲染器
// ------------------------------------------------------------

/**
 * 将 ContentFragment[] 渲染为指定格式的文本。
 * 单一入口替代 8 个独立的 fragsTo* 函数。
 */
export function renderFrags(frags: ContentFragment[], config: RenderConfig): string {
  return frags.map(f => {
    const text = String(f.v ?? '');
    switch (f.t) {
      case 'bc':
        return config.bg(f.color || 'yellow', text);
      case 'fc':
        return config.fg(f.color || 'red', text);
      case 'h':
        return config.cloze(text);
      case 'b':
        return config.bold(text, (f.fa as any) || {});
      case 'a':
        return config.anchor(text, getDisplayText(f), !!f.fa?.img);
      default:
        return config.plain(text);
    }
  }).join('');
}

// ============================================================
// 通用 HTML 工具
// ============================================================

/** HTML 实体转义 */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** XML 属性转义（保留引号转义） */
export function escapeXmlAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * 转义 HTML 但保留 markdown 图片语法 ![alt](url) 不变（用于预览/导出 HTML 时不被转义）
 */
export function escapeHtmlKeepMarkdownImages(text: string): string {
  const images: string[] = [];
  let s = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    images.push(`![${alt}](${url})`);
    return `\x00IMG${images.length - 1}\x00`;
  });
  s = escapeHtml(s);
  s = s.replace(/\x00IMG(\d+)\x00/g, (_m, i) => images[+i]);
  return s;
}

/**
 * 加粗/斜体/删除线渲染为语义化 HTML 标签（strong/em/del）
 */
export function renderBoldHtml(text: string, fa: { bold?: boolean; italic?: boolean; strikethrough?: boolean }): string {
  let result = text;
  if (fa.strikethrough) result = `<del>${result}</del>`;
  if (fa.italic) result = `<em>${result}</em>`;
  if (fa.bold) result = `<strong>${result}</strong>`;
  return result;
}

/**
 * 加粗/斜体/删除线渲染为 markdown 语法（**text** / *text* / ~~text~~）
 */
export function renderBoldMarkdown(text: string, fa: { bold?: boolean; italic?: boolean; strikethrough?: boolean }): string {
  let result = text;
  if (fa.strikethrough) result = `~~${result}~~`;
  if (fa.italic) result = `*${result}*`;
  if (fa.bold) result = `**${result}**`;
  return result;
}

/**
 * 加粗/斜体/删除线渲染为 Word 兼容标签（b/i/strike）
 */
export function renderBoldWord(text: string, fa: { bold?: boolean; italic?: boolean; strikethrough?: boolean }): string {
  let result = text;
  if (fa.strikethrough) result = `<strike>${result}</strike>`;
  if (fa.italic) result = `<i>${result}</i>`;
  if (fa.bold) result = `<b>${result}</b>`;
  return result;
}

// ============================================================
// 颜色工具（供各 config 使用）
// 统一使用 highlight.ts 的 HL_COLORS，确保导入/导出/预览颜色一致
// ============================================================

/** 获取背景色 hex（未知名颜色用黄色 fallback） */
export function getBgHex(color: string): string {
  const bg = HL_COLORS.bg as Record<string, string>;
  return bg[color] || color || bg.yellow;
}

/** 获取前景色 hex（未知名颜色用红色 fallback） */
export function getFgHex(color: string): string {
  const fg = HL_COLORS.fg as Record<string, string>;
  const fgFallback = HL_COLORS.fgFallback as Record<string, string>;
  return fg[color] || fgFallback[color] || color || fg.red;
}

/** 判断是否为已知命名颜色 */
export function isNamedColor(color: string, type: 'bg' | 'fg'): boolean {
  const palette = type === 'bg' ? HL_COLORS.bg : HL_COLORS.fg;
  return color in (palette as Record<string, string>);
}

/** 根据背景颜色选择对比文字色（深色背景用白字，浅色背景用黑字） */
export function getContrastTextColor(color: string): string {
  return (color === 'red' || color === 'blue') ? '#fff' : '#000';
}

// ============================================================
// 预定义 RenderConfig
// ============================================================

/** 颜色映射抽象：所有 hex 转换统一走 getBgHex / getFgHex */
function makeHtmlConfig(opts: {
  name: string;
  /** 背景高亮模板，例如 `<mark style="background:{hex};...">{text}</mark>` */
  bgTpl: (hex: string, contrast: string, text: string) => string;
  /** 文字高亮模板 */
  fgTpl: (hex: string, text: string) => string;
  /** 挖空模板（高亮色固定为黄色） */
  clozeTpl: (text: string) => string;
  /** 链接/图片模板 */
  anchorTpl: (url: string, text: string, isImage: boolean) => string;
  /** 加粗/斜体渲染器（不同格式用不同标签） */
  boldRenderer: (text: string, fa: any) => string;
  /** 文本是否需要 escape */
  escapeText: (s: string) => string;
}): RenderConfig {
  return {
    name: opts.name,
    bg(color, text) {
      const hex = getBgHex(color);
      return opts.bgTpl(hex, getContrastTextColor(color), opts.escapeText(text));
    },
    fg(color, text) {
      const hex = getFgHex(color);
      return opts.fgTpl(hex, opts.escapeText(text));
    },
    cloze(text) {
      return opts.clozeTpl(opts.escapeText(text));
    },
    bold(text, fa) {
      return opts.boldRenderer(opts.escapeText(text), fa);
    },
    anchor(url, text, isImage) {
      return opts.anchorTpl(escapeXmlAttr(decodeURI(url)), text, isImage);
    },
    plain(text) {
      return opts.escapeText(text);
    },
  };
}

// ------------------------------------------------------------
// Logseq 配置：[[#red]]==text== / <span style="background:hex">text</span>
// ------------------------------------------------------------

export const LOGSEQ_CONFIG: RenderConfig = {
  name: 'logseq',
  bg(color, text) {
    if (isNamedColor(color, 'bg') && color !== 'yellow') {
      return `[[#${color}]]==${text}==`;
    }
    // yellow 或自定义 hex → 用 hex 值 fallback 保留视觉
    return `<span style="background:${getBgHex(color)}">${text}</span>`;
  },
  fg(color, text) {
    if (isNamedColor(color, 'fg')) {
      return `[[\$${color}]]==${text}==`;
    }
    return `<font color="${getFgHex(color)}">${text}</font>`;
  },
  cloze(text) {
    return `[[#cloze]]==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  },
};

// ------------------------------------------------------------
// Obsidian 配置：<span style="background:hex">text</span> / <font color="hex">text</font>
// ------------------------------------------------------------

export const OBSIDIAN_CONFIG: RenderConfig = {
  name: 'obsidian',
  bg(color, text) {
    return `<span style="background:${getBgHex(color)}">${text}</span>`;
  },
  fg(color, text) {
    return `<font color="${getFgHex(color)}">${text}</font>`;
  },
  cloze(text) {
    return `==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  },
};

// ------------------------------------------------------------
// Orca HTML 配置：<span class="orca-inline bc bcc-...">text</span>
// ------------------------------------------------------------

export const ORCA_HTML_CONFIG: RenderConfig = {
  name: 'orca',
  bg(color, text) {
    if (isNamedColor(color, 'bg')) {
      return `<span class="orca-inline bc bcc-${color}" data-type="t">${text}</span>`;
    }
    return `<span style="background:${getBgHex(color)}" class="orca-inline" data-type="t">${text}</span>`;
  },
  fg(color, text) {
    if (isNamedColor(color, 'fg')) {
      return `<span class="orca-inline fc fcc-${color}" data-type="t">${text}</span>`;
    }
    return `<span style="color:${getFgHex(color)};font-weight:600;" class="orca-inline" data-type="t">${text}</span>`;
  },
  cloze(text) {
    return `<span class="orca-inline h" data-type="t">${text}</span>`;
  },
  bold(text, fa) {
    return renderBoldHtml(text, fa);
  },
  anchor(url, text, isImage) {
    const safeUrl = escapeXmlAttr(decodeURI(url));
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${safeUrl}" alt="${safeText}" />`;
    return `<a href="${safeUrl}">${safeText}</a>`;
  },
  plain(text) {
    return escapeHtml(text);
  },
};

// ------------------------------------------------------------
// 思源笔记配置：<span data-type="backgroundColor" style="background-color:var(--b3-font-backgroundN);">
// ------------------------------------------------------------

const SIYUAN_BG_VAR: Record<string, number> = { red: 1, blue: 6, green: 4, yellow: 3 };
const SIYUAN_FG_VAR: Record<string, number> = { red: 1, blue: 6, green: 4, yellow: 3 };

export const SIYUAN_CONFIG: RenderConfig = {
  name: 'siyuan',
  bg(color, text) {
    const idx = SIYUAN_BG_VAR[color];
    if (idx) {
      return `<span data-type="backgroundColor" style="background-color: var(--b3-font-background${idx});">${text}</span>`;
    }
    return `<span data-type="backgroundColor" style="background-color: ${getBgHex(color)};">${text}</span>`;
  },
  fg(color, text) {
    const idx = SIYUAN_FG_VAR[color];
    if (idx) {
      return `<span data-type="color" style="color: var(--b3-font-color${idx});">${text}</span>`;
    }
    return `<span data-type="color" style="color: ${getFgHex(color)};">${text}</span>`;
  },
  cloze(text) {
    return `==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  },
};

// ------------------------------------------------------------
// Markdown 配置：<mark style="background:hex">text</mark> + 标准 markdown 语法
// ------------------------------------------------------------

export const MARKDOWN_CONFIG: RenderConfig = {
  name: 'markdown',
  bg(color, text) {
    const hex = getBgHex(color);
    const contrast = getContrastTextColor(color);
    return `<mark style="background:${hex};color:${contrast};padding:0 2px;border-radius:2px;">${text}</mark>`;
  },
  fg(color, text) {
    return `<span style="color:${getFgHex(color)};font-weight:600;">${text}</span>`;
  },
  cloze(text) {
    return `==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  },
};

// ------------------------------------------------------------
// 基础 HTML 配置：通用 <mark>/<span> 标签（用于 HTML / Word / 预览）
// ------------------------------------------------------------

export const BASIC_HTML_CONFIG: RenderConfig = makeHtmlConfig({
  name: 'basic-html',
  bgTpl: (hex, contrast, text) =>
    `<mark style="background:${hex} !important;color:${contrast} !important;padding:0 2px !important;border-radius:2px !important;">${text}</mark>`,
  fgTpl: (hex, text) =>
    `<span style="color:${hex} !important;font-weight:600 !important;">${text}</span>`,
  clozeTpl: (text) =>
    `<mark style="background:#ffeb3b !important;color:#000 !important;padding:0 2px !important;border-radius:2px !important;">${text}</mark>`,
  boldRenderer: renderBoldHtml,
  anchorTpl: (url, text, isImage) => {
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${url}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${url}">${safeText}</a>`;
  },
  escapeText: escapeHtmlKeepMarkdownImages,
});

// ------------------------------------------------------------
// 标准 HTML 配置（不带 !important，用于标准 HTML 文件导出）
// ------------------------------------------------------------

export const STANDARD_HTML_CONFIG: RenderConfig = makeHtmlConfig({
  name: 'standard-html',
  bgTpl: (hex, contrast, text) =>
    `<mark style="background:${hex};color:${contrast};padding:0 2px;border-radius:2px;">${text}</mark>`,
  fgTpl: (hex, text) =>
    `<span style="color:${hex};font-weight:600;">${text}</span>`,
  clozeTpl: (text) =>
    `<span class="cloze" style="background:#ffeb3b;color:#000;padding:0 2px;border-radius:2px;">${text}</span>`,
  boldRenderer: renderBoldHtml,
  anchorTpl: (url, text, isImage) => {
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${url}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${url}">${safeText}</a>`;
  },
  escapeText: escapeHtmlKeepMarkdownImages,
});

// ------------------------------------------------------------
// Word 配置：<span style="background:hex;mso-highlight:...">text</span>
// ------------------------------------------------------------

const MSO_HIGHLIGHT: Record<string, string> = {
  yellow: 'yellow',
  green: 'green',
  red: 'red',
  // blue (#fdbfff 浅紫) 在 Word 中映射为 magenta
  blue: 'magenta',
};

export const WORD_HTML_CONFIG: RenderConfig = {
  name: 'word',
  bg(color, text) {
    const hex = getBgHex(color);
    const msoColor = MSO_HIGHLIGHT[color] || 'yellow';
    const contrast = getContrastTextColor(color);
    return `<span style="background:${hex};mso-highlight:${msoColor};color:${contrast};padding:0 2px;">${escapeHtml(text)}</span>`;
  },
  fg(color, text) {
    return `<font color="${getFgHex(color)}">${escapeHtml(text)}</font>`;
  },
  cloze(text) {
    return `<span style="background:#ffeb3b;color:black;padding:0 2px;">${escapeHtml(text)}</span>`;
  },
  bold(text, fa) {
    return renderBoldWord(text, fa);
  },
  anchor(url, text, isImage) {
    const safeUrl = escapeXmlAttr(decodeURI(url));
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${safeUrl}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${safeUrl}">${safeText}</a>`;
  },
  plain(text) {
    return escapeHtml(text);
  },
};

// ------------------------------------------------------------
// 预览配置：<mark style="background:hex">text</mark>（颜色用主题色 hex，不带 !important）
// ------------------------------------------------------------

export const PREVIEW_HTML_CONFIG: RenderConfig = {
  name: 'preview',
  bg(color, text) {
    const hex = getBgHex(color);
    return `<mark style="background:${hex};border-radius:2px;padding:0 2px;">${escapeHtml(text)}</mark>`;
  },
  fg(color, text) {
    const hex = getFgHex(color);
    return `<span style="color:${hex};font-weight:600;">${escapeHtml(text)}</span>`;
  },
  cloze(text) {
    return `<mark style="background:#ffeb3b;border-radius:2px;padding:0 2px;">${escapeHtml(text)}</mark>`;
  },
  bold(text, fa) {
    return renderBoldHtml(text, fa);
  },
  anchor(url, text, isImage) {
    const safeUrl = escapeXmlAttr(decodeURI(url));
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${safeUrl}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${safeUrl}">${safeText}</a>`;
  },
  plain(text) {
    return escapeHtml(text);
  },
};

// ============================================================
// 配置注册表（按名称访问）
// ============================================================

export const RENDER_CONFIGS: Record<string, RenderConfig> = {
  logseq: LOGSEQ_CONFIG,
  obsidian: OBSIDIAN_CONFIG,
  orca: ORCA_HTML_CONFIG,
  siyuan: SIYUAN_CONFIG,
  markdown: MARKDOWN_CONFIG,
  'basic-html': BASIC_HTML_CONFIG,
  'standard-html': STANDARD_HTML_CONFIG,
  word: WORD_HTML_CONFIG,
  preview: PREVIEW_HTML_CONFIG,
};
