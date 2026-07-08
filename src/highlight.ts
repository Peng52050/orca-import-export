// ============================================================
// orca-import-export: highlight/format module
// ============================================================
//
// 本文件提供四向高亮/挖空互转能力：
//   - 内部标记标准化 (normalizeHighlights): 源格式 → 内部标记
//   - 内部标记解析 (parseHighlightToFrags): 内部标记 → ContentFragment[]
//   - 格式输出: fragsTo{Logseq|Obsidian|OrcaHTML|Siyuan|Markdown|BasicHTML|WordHTML|PreviewHTML}
//
// 重构要点 (2026-07-07):
//   - F1: parseInlineMarkdownToFrags 支持结构化 fragment (图片/链接/代码)
//   - C1: 8 个 fragsTo* 函数抽到 renderer.ts，本文件保留为薄包装
//
// 模块依赖：renderer.ts 提供统一的 RenderConfig 策略对象

import type { ContentFragment } from './orca.d.ts';
import {
  renderFrags,
  LOGSEQ_CONFIG,
  OBSIDIAN_CONFIG,
  ORCA_HTML_CONFIG,
  SIYUAN_CONFIG,
  MARKDOWN_CONFIG,
  BASIC_HTML_CONFIG,
  STANDARD_HTML_CONFIG,
  WORD_HTML_CONFIG,
  PREVIEW_HTML_CONFIG,
  escapeHtml,
  escapeXmlAttr,
  escapeHtmlKeepMarkdownImages,
  getBgHex,
  getFgHex,
  isNamedColor,
} from './renderer.ts';

// 重新导出共用工具（向后兼容）
export {
  escapeHtml,
  escapeXmlAttr,
  escapeHtmlKeepMarkdownImages,
  getBgHex,
  getFgHex,
  isNamedColor,
} from './renderer.ts';

// ============================================================
// 高亮常量
// ============================================================

// 富文本高亮颜色映射 (依据 高亮语法.txt 严格核对)
// -----------------------------------------
// 模式      红底 蓝底 绿底 黄底  红字 蓝字 绿字  黄字  挖空
// Logseq    ✓   ✓   ✓   ✗   ✓   ✓   ✓   ✗   ✓
// Obsidian  ✓   ✓   ✓   ✗   ✓   ✓   ✓   ✗   ✓
// Orca      ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✗   ✓
// SiYuan    ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓ (通过 CSS 变量与 ==text== 语法)
// -----------------------------------------
// 说明：
// - 黄色背景仅 Orca Note 模式支持；Logseq/Obsidian 模式遇到时使用 hex 值 fallback (保留视觉信息)
// - 黄色文字所有模式均不支持 (参考文档未列出)；导出时降级为纯文本
// - SiYuan 支持 13 种文字色 + 13 种背景色 (CSS 变量)，本插件按命名颜色映射
export const HL_COLORS = {
  bg: { red: '#ff4d4f', blue: '#fdbfff', green: '#affad1', yellow: '#fff3a0' },
  fg: { red: '#F36208', blue: '#8a2be2', green: '#1ddd08' },
  // yellow 文字通用 fallback 颜色 (用于 Logseq/Obsidian 模式导出)
  fgFallback: { yellow: '#b88a00' },
};

// SiYuan (思源笔记) CSS 变量索引映射
// 思源预设 13 种文字色 (--b3-font-color1~13) 和 13 种背景色 (--b3-font-background1~13)
// 本插件命名颜色 → SiYuan 变量索引
export const SIYUAN_COLOR_VAR = {
  fg: { red: 1, blue: 6, green: 4, yellow: 3 },
  bg: { red: 1, blue: 6, green: 4, yellow: 3 },
};

// 内部标记常量 (与 HTML 参考工具一致)
// 格式: \x01HL:type:color\x02text\x03
const HL_START = '\x01HL:';
const HL_MID = '\x02';
const HL_END = '\x03';

// ============================================================
// INTERNAL MARKER NORMALIZATION
// 将源文本中的高亮语法统一解析为内部标记 \x01HL:type:color\x02text\x03
// ============================================================

export type HighlightSource = 'auto' | 'logseq' | 'obsidian' | 'orca' | 'siyuan' | 'plaintext';

/**
 * 将源文本中的高亮语法解析为内部标记。
 * @param text 源文本
 * @param sourceFormat 高亮源格式
 * @returns 替换后的文本（含 \x01HL:type:color\x02text\x03 内部标记）
 */
export function normalizeHighlights(text: string, sourceFormat: HighlightSource): string {
  if (!text) return '';
  const tryAll = (sourceFormat === 'auto' || sourceFormat === 'plaintext');
  let s = text;

  // --- Logseq 语法 ---
  // 背景: [[#red|blue|green]]==text==
  // 文字: [[$red|blue|green]]==text==
  // 挖空: [[#cloze]]==text==
  if (sourceFormat === 'logseq' || tryAll) {
    s = s.replace(/\[\[#(red|blue|green|cloze)\]\]==([\s\S]+?)==/g, (_, c, t) => {
      if (c === 'cloze') return `${HL_START}cloze${HL_MID}${t}${HL_END}`;
      return `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/\[\[\$(red|blue|green)\]\]==([\s\S]+?)==/g, (_, c, t) =>
      `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`);
  }

  // --- Obsidian 语法 ---
  // 背景: <mark style="background:#hex">text</mark> 或 ==text== (高亮)
  // 文字: <font color="#hex">text</font>
  if (sourceFormat === 'obsidian' || tryAll) {
    // 1. <mark style="background:hex">text</mark>
    s = s.replace(/<mark\s+[^>]*?style=["']?\s*background:\s*(#[0-9a-fA-F]{3,8})[^"';]*["']?[^>]*>([\s\S]*?)<\/mark>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, 'bg');
      return `${HL_START}bg:${color}${HL_MID}${t}${HL_END}`;
    });
    // 2. <span style="background:hex">text</span>
    s = s.replace(/<span\s+style=["']background:\s*(#[0-9a-fA-F]{3,8})[^"';]*["'][^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, 'bg');
      return `${HL_START}bg:${color}${HL_MID}${t}${HL_END}`;
    });
    // 3. <span style="background:hex;...其他..."> 兜底
    s = s.replace(/<span\s+[^>]*?style=["'][^"']*background:\s*(#[0-9a-fA-F]{3,8})[^"';]*["'][^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, 'bg');
      return `${HL_START}bg:${color}${HL_MID}${t}${HL_END}`;
    });
    // 4. <font color="hex">text</font>
    s = s.replace(/<font\s+color=["']?(#[0-9a-fA-F]{3,8})["']?[^>]*>([\s\S]*?)<\/font>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, 'fg');
      return `${HL_START}fg:${color}${HL_MID}${t}${HL_END}`;
    });
  }

  // --- Orca 语法 ---
  // 背景: <span class="orca-inline bc bcc-red">text</span>
  // 文字: <span class="orca-inline fc fcc-red">text</span>
  // 挖空: <span class="orca-inline h">text</span>
  if (sourceFormat === 'orca' || tryAll) {
    s = s.replace(/<span\s+class=["']orca-inline\s+bc\s+bcc-(red|blue|green|yellow)["'][^>]*>([\s\S]*?)<\/span>/gi, (_, c, t) =>
      `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`);
    s = s.replace(/<span\s+class=["']orca-inline\s+fc\s+fcc-(red|blue|green)["'][^>]*>([\s\S]*?)<\/span>/gi, (_, c, t) =>
      `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`);
    s = s.replace(/<span\s+class=["']orca-inline\s+h["'][^>]*>([\s\S]*?)<\/span>/gi, (_, t) =>
      `${HL_START}cloze${HL_MID}${t}${HL_END}`);
  }
  // 仅明确指定 Orca 模式时 ==text== 才视为挖空
  // auto / Obsidian / SiYuan 模式下 ==text== 视为黄色背景高亮
  if (sourceFormat === 'orca') {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}cloze${HL_MID}${t}${HL_END}`);
  }
  // Obsidian ==text== → 背景高亮 (黄色)
  if (sourceFormat === 'obsidian') {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
  }

  // --- SiYuan (思源笔记) 语法 ---
  // 思源 mark 元素 ==text== 或 <span data-type="mark"> 是高亮（可见），不是挖空
  if (sourceFormat === 'siyuan' || tryAll) {
    s = s.replace(/<span\s+data-type="mark"[^>]*>([\s\S]*?)<\/span>/gi, (_, t) =>
      `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
    s = s.replace(/<span\s+data-type="color"\s+style="color:\s*var\(--b3-font-color(\d+)\);?"[^>]*>([\s\S]*?)<\/span>/gi, (_, idx, t) => {
      const c = siyuanVarToColorName(parseInt(idx, 10), 'fg');
      return `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+data-type="backgroundColor"\s+style="background-color:\s*var\(--b3-font-background(\d+)\);?"[^>]*>([\s\S]*?)<\/span>/gi, (_, idx, t) => {
      const c = siyuanVarToColorName(parseInt(idx, 10), 'bg');
      return `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`;
    });
    // 兜底：内联 hex 颜色
    s = s.replace(/<span\s+data-type="color"\s+style="color:\s*(#[0-9a-fA-F]{3,8});?"[^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const c = hexToColorName(hex, 'fg');
      return `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+data-type="backgroundColor"\s+style="background-color:\s*(#[0-9a-fA-F]{3,8});?"[^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const c = hexToColorName(hex, 'bg');
      return `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`;
    });
  }
  // SiYuan ==text== → 背景高亮（高亮，非挖空）
  if (sourceFormat === 'siyuan') {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
  }

  // auto 模式下未识别的 ==text== 统一视为黄色背景高亮（与 Obsidian/SiYuan 语义一致）
  if (sourceFormat === 'auto') {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
  }

  return s;
}

/**
 * 将 hex 颜色值反向映射为颜色名称。
 */
function hexToColorName(hex: string, type: 'bg' | 'fg'): string {
  const normalized = hex.toLowerCase();
  const colors = type === 'bg' ? HL_COLORS.bg : HL_COLORS.fg;
  for (const [name, value] of Object.entries(colors)) {
    if (value.toLowerCase() === normalized) return name;
  }
  // 未匹配：使用第一个颜色作为 fallback
  return type === 'bg' ? 'yellow' : 'red';
}

/**
 * SiYuan CSS 变量索引 → 命名颜色
 */
function siyuanVarToColorName(idx: number, type: 'bg' | 'fg'): string {
  const map = type === 'bg' ? SIYUAN_COLOR_VAR.bg : SIYUAN_COLOR_VAR.fg;
  for (const [name, varIdx] of Object.entries(map)) {
    if (varIdx === idx) return name;
  }
  return type === 'bg' ? 'yellow' : 'red';
}

/**
 * 命名颜色 → SiYuan CSS 变量索引
 */
function siyuanColorVarIdx(color: string, type: 'bg' | 'fg'): number | null {
  const map = type === 'bg' ? SIYUAN_COLOR_VAR.bg : SIYUAN_COLOR_VAR.fg;
  return (map as Record<string, number>)[color] ?? null;
}

// ============================================================
// INTERNAL MARKER PARSING
// 内部标记 → ContentFragment[]
// ============================================================

/**
 * 将含内部标记的文本（或源文本）解析为 ContentFragment[]。
 *
 * 两种用法（向后兼容）：
 * 1. parseHighlightToFrags(text)
 *    - text 已经是含 \x01HL:type:color\x02text\x03 内部标记的文本
 * 2. parseHighlightToFrags(text, sourceFormat)
 *    - text 是源文本（含源高亮语法），先 normalize 再 parse
 *
 * @param text 源文本
 * @param sourceFormat 可选；指定时先做 normalizeHighlights
 * @returns ContentFragment 数组
 */
export function parseHighlightToFrags(text: string, sourceFormat?: HighlightSource): ContentFragment[] {
  if (!text) return [];
  // 向后兼容：提供 sourceFormat 时先规范化
  if (sourceFormat) {
    text = normalizeHighlights(text, sourceFormat);
  }
  const result: ContentFragment[] = [];
  const re = /\x01HL:([^\x02]+)\x02([\s\S]*?)\x03/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ t: 't', v: text.slice(lastIndex, match.index) });
    }
    const spec = match[1]; // "type:color" 或 "cloze"
    const content = match[2];
    if (spec === 'cloze') {
      result.push({ t: 'h', v: content });
    } else {
      const [type, color] = spec.split(':');
      if (type === 'bg') {
        result.push({ t: 'bc', color, v: content });
      } else if (type === 'fg') {
        result.push({ t: 'fc', color, v: content });
      } else {
        result.push({ t: 't', v: content });
      }
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push({ t: 't', v: text.slice(lastIndex) });
  }
  return result;
}

// ============================================================
// RENDER: ContentFragment[] → target format
// 8 个 fragsTo* 函数已重构为薄包装，详见 renderer.ts
// ============================================================

/** Convert fragments to Logseq highlight syntax */
export function fragsToLogseq(frags: ContentFragment[]): string {
  return renderFrags(frags, LOGSEQ_CONFIG);
}

/** Convert fragments to Obsidian highlight syntax */
export function fragsToObsidian(frags: ContentFragment[]): string {
  return renderFrags(frags, OBSIDIAN_CONFIG);
}

/** Convert fragments to Orca HTML syntax */
export function fragsToOrcaHTML(frags: ContentFragment[]): string {
  return renderFrags(frags, ORCA_HTML_CONFIG);
}

/** Convert fragments to SiYuan (思源笔记) highlight syntax */
export function fragsToSiyuan(frags: ContentFragment[]): string {
  return renderFrags(frags, SIYUAN_CONFIG);
}

/** Convert fragments to Markdown（含 HTML 标签保留颜色） */
export function fragsToMarkdown(frags: ContentFragment[]): string {
  return renderFrags(frags, MARKDOWN_CONFIG);
}

/** Convert fragments to BASIC HTML（!important 防止外部 CSS 覆盖） */
export function fragsToBasicHTML(frags: ContentFragment[]): string {
  return renderFrags(frags, BASIC_HTML_CONFIG);
}

/** 标准 HTML 渲染（用于 HTML 文件导出） */
export function renderHighlightsHTML(frags: ContentFragment[]): string {
  return renderFrags(frags, STANDARD_HTML_CONFIG);
}

/** 兼容别名 */
export const fragsToStandardHTML = renderHighlightsHTML;

/** Word 兼容 HTML 渲染（使用 mso-highlight） */
export function renderHighlightsForWord(frags: ContentFragment[]): string {
  return renderFrags(frags, WORD_HTML_CONFIG);
}

/** 兼容别名 */
export const fragsToWordHTML = renderHighlightsForWord;

/** 预览 HTML 渲染（带高亮） */
export function fragsToPreviewHTML(frags: ContentFragment[]): string {
  return renderFrags(frags, PREVIEW_HTML_CONFIG);
}

/** Convert fragments to plain text (strip all formatting) */
export function fragsToPlainText(frags: ContentFragment[]): string {
  return frags.map(f => {
    if (f.t === 'a') {
      const anyF = f as any;
      const linkText = anyF.text || f.children?.map((c: any) => String(c.v ?? '')).join('') || '';
      return linkText || String(f.v ?? '');
    }
    return String(f.v ?? '');
  }).join('');
}

// ============================================================
// 3. 通用富文本 → Orca 内部插入格式（用于 core.editor.insertBlock）
// ============================================================

/** 把任何 hex 颜色值（不区分大小写、去空格）反向映射为命名颜色 */
function hexToColorNameAny(hex: string): string | null {
  if (!hex || typeof hex !== 'string') return null;
  const normalized = hex.toLowerCase().replace(/\s/g, '');
  for (const [name, h] of Object.entries(HL_COLORS.bg)) {
    if (h.toLowerCase() === normalized) return name;
  }
  for (const [name, h] of Object.entries(HL_COLORS.fg)) {
    if (h.toLowerCase() === normalized) return name;
  }
  return null;
}

/** 颜色值归一化：hex → 命名色；命名色保持原样；其他原样返回 */
function normalizeColorValue(color: string): string {
  if (!color || typeof color !== 'string') return 'yellow';
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const name = hexToColorNameAny(trimmed);
    return name || trimmed;
  }
  return trimmed;
}

/** 从 children 数组中提取纯文本（兜底） */
function extractTextFromChildren(children: any): string {
  if (!Array.isArray(children)) return '';
  return children.map((c: any) => String(c.v ?? '')).join('');
}

/**
 * 将 Orca 内部存储格式的 ContentFragment[] 归一化为标准格式
 * {t:'bc'/'fc'/'h', v, color}，供后续渲染/导出使用。
 *
 * 支持的输入形态：
 * 1. {t:'bc'/'fc'/'h', v, color}                 → 标准化
 * 2. {t:'t', v, f:'bc'/'fc'/'h', fa:{bcc/fcc}}   → 标准化
 * 3. {t:'t', v, fa:{bc/fc/h/type/color}}         → 标准化
 * 4. {t:'b', v, fa:{bold,italic,...}}            → 标准化
 * 5. {t:'a', v, children, fa:{img}}              → 标准化
 * 6. {t:'t', v: 'image::URL ...'}                → 转为 markdown ![](url) 格式
 */
export function normalizeFrags(frags: ContentFragment[]): ContentFragment[] {
  return frags.map((f) => {
    // 0. 文本中的 image:: URL 转为 markdown 语法（兼容旧式 Orca 图片块）
    if (f.v && typeof f.v === 'string' && /image::?[ \t]+\S/.test(f.v)) {
      const v = (f.v as string).replace(/(^|\s)image::?[ \t]+(\S+)/g, (_m, prefix, url) =>
        `${prefix}![](${url})`);
      f = { ...f, v };
    }

    // 1. 标准 {t:'bc'/'fc'/'h'} 格式
    if (f.t === 'bc' || f.t === 'fc' || f.t === 'h') {
      const color = (f as any).color ? normalizeColorValue((f as any).color) : f.t === 'fc' ? 'red' : 'yellow';
      const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
      return { t: f.t, v: text, color } as any;
    }

    // 2. 内部存储 {t:'t', f:'bc'/'fc'/'h', fa:{bcc/fcc}} 格式
    if (f.f && typeof f.f === 'string') {
      const fmt = f.f;
      if (fmt === 'bc' || fmt === 'fc' || fmt === 'h') {
        const fa = f.fa;
        let rawColor: string | null = null;
        if (fa) {
          if (fmt === 'bc') rawColor = (fa as any).bcc || (fa as any).bccColor || (fa as any).color || (fa as any).c;
          else if (fmt === 'fc') rawColor = (fa as any).fcc || (fa as any).fccColor || (fa as any).color || (fa as any).c;
          else rawColor = null;
        }
        if (!rawColor && (f as any).color) rawColor = (f as any).color;
        const color = rawColor ? normalizeColorValue(rawColor) : fmt === 'fc' ? 'red' : 'yellow';
        const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
        return { t: fmt, v: text, color } as any;
      }
    }

    // 3. {fa:{h/cloze/highlight/type=='h'}}  挖空
    if (f.fa) {
      const fa = f.fa;
      if ((fa as any).h || (fa as any).cloze || (fa as any).highlight || (fa as any).type === 'h') {
        const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
        return { t: 'h', v: text } as any;
      }
      if ((fa as any).bc || (fa as any).bg || (fa as any).background || (fa as any).type === 'bc') {
        const rawColor = (fa as any).bc || (fa as any).bg || (fa as any).background || (fa as any).color;
        const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
        return { t: 'bc', v: text, color: normalizeColorValue(rawColor) } as any;
      }
      if ((fa as any).fc || (fa as any).fg || (fa as any).foreground || (fa as any).type === 'fc') {
        const rawColor = (fa as any).fc || (fa as any).fg || (fa as any).foreground || (fa as any).color;
        const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
        return { t: 'fc', v: text, color: normalizeColorValue(rawColor) } as any;
      }
      if ((fa as any).color) {
        const rawColor = (fa as any).color;
        const color = normalizeColorValue(rawColor);
        const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
        if ((fa as any).type === 'background' || (fa as any).c === 'bc') return { t: 'bc', v: text, color } as any;
        if ((fa as any).type === 'foreground' || (fa as any).c === 'fc') return { t: 'fc', v: text, color } as any;
        return { t: 'bc', v: text, color } as any;
      }
      if ((fa as any).c && typeof (fa as any).c === 'string') {
        const colorName = ((fa as any).c as string).toLowerCase();
        if (['red', 'blue', 'green', 'yellow'].includes(colorName)) {
          const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
          return { t: 'bc', v: text, color: colorName } as any;
        }
      }
    }

    // 4. 加粗/斜体/删除线 {t:'b', fa}
    if (f.t === 'b') {
      const text = String((f as any).v ?? '') || extractTextFromChildren((f as any).children);
      const fa: any = (f as any).fa || {};
      const cleanFa: any = {};
      if (fa.bold) cleanFa.bold = true;
      if (fa.italic) cleanFa.italic = true;
      if (fa.strikethrough) cleanFa.strikethrough = true;
      if (fa.underline) cleanFa.underline = true;
      if (Object.keys(cleanFa).length === 0) cleanFa.bold = true;
      return { t: 'b', v: text, fa: cleanFa } as any;
    }

    // 5. 链接/图片 {t:'a', v, children, fa:{img}}
    if (f.t === 'a') {
      const url = String((f as any).v ?? '');
      const fa = f.fa || {};
      const linkText = extractTextFromChildren((f as any).children);
      return { t: 'a', v: url, fa: (fa as any).img ? { img: true } : {}, text: linkText } as any;
    }

    // 6. 普通文本 {t:'t'} — 处理 image:: URL
    if (f.t === 't') {
      const text = String((f as any).v || '');
      const converted = text.replace(/(^|\s)image::?[ \t]+(\S+)/g, (_m, prefix, url) =>
        `${prefix}![](${url})`);
      return { t: 't', v: converted } as any;
    }

    return { t: 't', v: String((f as any).v ?? '') } as any;
  });
}

/**
 * 把标准富文本 frags 转为 Orca `core.editor.insertBlock` 接受的内部格式。
 *
 * 转换规则：
 * - {t:'bc', color}   → {t:'t', v, f:'bc', fa:{bcc: color}}
 * - {t:'fc', color}   → {t:'t', v, f:'fc', fa:{fcc: color}}
 * - {t:'h'}           → {t:'t', v, f:'h', fa:{}}
 * - {t:'b', fa}       → {t:'t', v, f:'b', fa: cleanFa}
 * - {t:'a', v, fa:{img}, children}  → 保留结构
 * - 其他保持不变
 */
export function fragsToOrcaInsertFormat(frags: ContentFragment[]): ContentFragment[] {
  return frags.map((f) => {
    // 已有 f/fa 字段说明是 Orca 内部格式，直接通过
    if (f.f || f.fa) {
      return { ...f };
    }
    if (f.t === 'bc') {
      return { t: 't', v: String(f.v ?? ''), f: 'bc', fa: { bcc: (f as any).color || 'yellow' } };
    }
    if (f.t === 'fc') {
      return { t: 't', v: String(f.v ?? ''), f: 'fc', fa: { fcc: (f as any).color || 'red' } };
    }
    if (f.t === 'h') {
      return { t: 't', v: String(f.v ?? ''), f: 'h', fa: {} };
    }
    if (f.t === 'b') {
      const fa: any = (f as any).fa || {};
      const cleanFa: any = {};
      if (fa.bold) cleanFa.bold = true;
      if (fa.italic) cleanFa.italic = true;
      if (fa.strikethrough) cleanFa.strikethrough = true;
      if (fa.underline) cleanFa.underline = true;
      if (Object.keys(cleanFa).length === 0) cleanFa.bold = true;
      return { t: 't', v: String(f.v ?? ''), f: 'b', fa: cleanFa };
    }
    if (f.t === 'a') {
      const url = String(f.v ?? '');
      const fa = (f as any).fa?.img ? { img: true } : {};
      // 递归转换 children，保留其中的加粗/高亮等格式；无 children 时用 URL 作为显示文本兜底
      const rawChildren = Array.isArray((f as any).children) ? (f as any).children : [];
      let children: any[] = [];
      if (rawChildren.length > 0) {
        children = fragsToOrcaInsertFormat(rawChildren);
      } else if ((f as any).text) {
        children = [{ t: 't', v: (f as any).text }];
      } else if (!fa.img) {
        children = [{ t: 't', v: url }];
      }
      return { t: 'a', v: url, fa, children };
    }
    if (f.t === 't') {
      return { t: 't', v: String(f.v ?? '') };
    }
    return { t: 't', v: String(f.v ?? '') };
  });
}

/**
 * 将原始文本中的高亮语法全部转换为 ==text== 标记
 * 用于：batchInsertText 前预处理
 */
export function convertTextToImportFormat(text: string, sourceFormat: HighlightSource): string {
  const normalized = normalizeHighlights(text, sourceFormat);
  return normalized.replace(/\x01HL:([^\x02]*)\x02([\s\S]*?)\x03/g, '==$2==');
}

/**
 * 将 markdown 图片语法 ![alt](url) 转换为 HTML <img> 标签
 */
export function convertMarkdownImagesToHTML(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const altText = alt || '';
    const safeUrl = escapeXmlAttr(decodeURI(url));
    return `<img src="${safeUrl}" alt="${escapeHtml(altText)}" style="max-width:100%;height:auto;" />`;
  });
}

// ============================================================
// EXPORT: renderHighlights (text + target style)
// ============================================================

/**
 * 将源文本中的高亮语法直接渲染为目标格式。
 * 等价于：normalizeHighlights → parseHighlightToFrags → fragsToXxx
 * @param text 源文本（含高亮语法）
 * @param targetStyle 目标格式
 * @returns 渲染后的文本
 */
export function renderHighlights(text: string, targetStyle: 'logseq' | 'obsidian' | 'orca' | 'siyuan' | 'plaintext'): string {
  if (!text) return '';
  const normalized = normalizeHighlights(text, targetStyle);
  if (normalized === text) return text; // 无高亮语法
  const frags = parseHighlightToFrags(normalized);
  switch (targetStyle) {
    case 'logseq': return fragsToLogseq(frags);
    case 'obsidian': return fragsToObsidian(frags);
    case 'orca': return fragsToOrcaHTML(frags);
    case 'siyuan': return fragsToSiyuan(frags);
    default: return fragsToPlainText(frags);
  }
}

// ============================================================
// DETECT: identify the highlight syntax in text
// ============================================================

/** Detect the highlight syntax type in text */
export function detectHighlightSyntax(text: string): HighlightSource {
  if (/\[\[#(red|blue|green|cloze)\]\]==/.test(text) || /\[\[\$(red|blue|green)\]\]==/.test(text)) {
    return 'logseq';
  }
  if (/orca-inline\s+(bc|fc|h)/.test(text)) {
    return 'orca';
  }
  // SiYuan: <span data-type="mark|color|backgroundColor">
  if (/<span\s+data-type="(mark|color|backgroundColor)"/i.test(text)) {
    return 'siyuan';
  }
  if (/<span\s+style=["']background:/.test(text) || /<font\s+color=/.test(text)) {
    return 'obsidian';
  }
  return 'plaintext';
}

// ============================================================
// CLOZE 语法工具（用于导出时将 Orca 挖空转为目标语法）
// ============================================================

/**
 * 将挖空文本按指定语法（数组）渲染输出
 * 多选时按数组顺序嵌套（外层在前，内层在后）
 * 用于导出时将 Orca 挖空 {t:'h'} 转为目标语法
 */
export function renderClozeToSyntax(text: string, syntaxes: string[]): string {
  if (!text || syntaxes.length === 0) return text;
  let result = text;
  for (const syntax of syntaxes) {
    result = wrapClozeOnce(result, syntax);
  }
  return result;
}

/** 单个语法的包裹函数 */
function wrapClozeOnce(text: string, syntax: string): string {
  switch (syntax) {
    case 'tortoise':
      return `〖${text}〗`;
    case 'bold':
      return `**${text}**`;
    case 'bold-italic':
      return `***${text}***`;
    case 'italic':
      return `*${text}*`;
    case 'quote':
      return `"${text}"`;
    case 'cloze-idx-bracket':
      return `[[c1::${text}]]`;
    case 'bracket':
      return `[[${text}]]`;
    case 'brace':
      return `{{${text}}}`;
    default:
      return text;
  }
}

/**
 * 将 fragments 中的挖空 (t:'h') 按指定语法渲染
 * 其他 fragment 类型使用 MARKDOWN_CONFIG 渲染，保留加粗/斜体/链接/高亮等格式
 */
export function renderFragsClozeToSyntax(frags: ContentFragment[], syntaxes: string[]): string {
  if (syntaxes.length === 0) {
    return frags.map(f => String(f.v ?? '')).join('');
  }
  return frags.map(f => {
    if (f.t === 'h') {
      return renderClozeToSyntax(String(f.v ?? ''), syntaxes);
    }
    // 保留其他富文本格式，避免挖空导出时加粗/高亮/链接全部丢失
    return renderFrags([f], MARKDOWN_CONFIG);
  }).join('');
}

// ============================================================
// 后处理：扫描页面所有块将 ==text== 转为 Orca 挖空
// ============================================================

/**
 * 在导入后扫描页面中的所有块，将 ==text== 语法转换为 Orca 挖空 (h) 效果
 * 适用于 batchInsertText 导入之后的统一后处理
 * @param rootBlockId 根块 ID（页面 ID）
 */
export async function scanBlocksForCloze(rootBlockId: number | string): Promise<void> {
  try {
    const visited = new Set<number | string>();
    let changedCount = 0;
    const walk = (blockId: number | string) => {
      if (!blockId || visited.has(blockId)) return;
      visited.add(blockId);
      const block = (orca as any).state?.blocks?.[blockId];
      if (!block) return;
      if (block.content) {
        let hasCloze = false;
        const newContent: any[] = [];
        for (const frag of block.content) {
          if (frag.t === 't' && typeof frag.v === 'string') {
            const text = frag.v;
            const regex = /==([^=\n]+)==/g;
            if (regex.test(text)) {
              hasCloze = true;
              regex.lastIndex = 0;
              let lastIdx = 0;
              let m: RegExpExecArray | null;
              while ((m = regex.exec(text)) !== null) {
                if (m.index > lastIdx) {
                  newContent.push({ t: 't', v: text.slice(lastIdx, m.index) });
                }
                newContent.push({ t: 'h', v: m[1] });
                lastIdx = regex.lastIndex;
              }
              if (lastIdx < text.length) {
                newContent.push({ t: 't', v: text.slice(lastIdx) });
              }
            } else {
              newContent.push(frag);
            }
          } else {
            newContent.push(frag);
          }
        }
        if (hasCloze) {
          block.content = newContent;
          changedCount++;
        }
      }
      if (Array.isArray(block.children)) {
        for (const childId of block.children) {
          walk(childId);
        }
      }
    };
    walk(rootBlockId);
    if (changedCount > 0) {
      console.log(`[OIE] scanBlocksForCloze: converted ${changedCount} blocks`);
    }
  } catch (e) {
    console.warn('[OIE] scanBlocksForCloze error:', e);
  }
}
