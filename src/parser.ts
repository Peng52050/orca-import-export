import type { ContentFragment } from './orca.d.ts';
import {
  parseHighlightToFrags,
  fragsToPlainText,
  detectHighlightSyntax,
  type HighlightSource,
} from './highlight.ts';

export interface ParseInlineOptions {
  /** 为 true 时，图片/链接/代码保留原始 Markdown 文本，不生成结构化 fragment */
  plainLinks?: boolean;
}

interface InlineToken {
  type: 'text' | 'image' | 'link' | 'code';
  raw: string;
  content?: string;
  url?: string;
  title?: string;
}

/**
 * 解析内联 Markdown 为 fragments（在 parser 层可独立使用）
 * 支持：代码 `code` > 图片 ![]() > 链接 []() > ***bold-italic*** > **bold** > *italic* > ~~strike~~ > ==highlight==
 *
 * 采用扫描器而非单一正则，可正确处理：
 * - URL 中包含括号，例如 ![](https://example.com/pic_(1).png)
 * - 链接文本中包含嵌套方括号或转义字符
 * - 行内代码中包含其他 Markdown 标记
 */
export function parseInlineMarkdownToFrags(text: string, options: ParseInlineOptions = {}): ContentFragment[] {
  if (!text) return [];
  const tokens = tokenizeInlineMarkdown(text);
  const frags: ContentFragment[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'code': {
        frags.push(options.plainLinks ? { t: 't', v: token.raw } : { t: 'c', v: token.content ?? '' });
        break;
      }
      case 'image': {
        if (options.plainLinks || !token.url) {
          frags.push({ t: 't', v: token.raw });
        } else {
          frags.push({
            t: 'a',
            v: token.url,
            fa: { img: true },
            children: token.content ? [{ t: 't', v: token.content }] : [],
          });
        }
        break;
      }
      case 'link': {
        if (options.plainLinks || !token.url) {
          frags.push({ t: 't', v: token.raw });
        } else {
          const fa: Record<string, any> = {};
          if (token.title) fa.title = token.title;
          frags.push({
            t: 'a',
            v: token.url,
            fa,
            children: [{ t: 't', v: token.content ?? '' }],
          });
        }
        break;
      }
      case 'text':
      default: {
        frags.push(...parseEmphasisInText(token.raw));
        break;
      }
    }
  }

  return frags.length > 0 ? frags : [{ t: 't', v: text }];
}

/** 判断文本中是否包含 Markdown 图片语法（支持 URL 含括号等复杂情况） */
export function hasMarkdownImage(text: string): boolean {
  if (!text) return false;
  const tokens = tokenizeInlineMarkdown(text);
  return tokens.some(t => t.type === 'image');
}

function tokenizeInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;

  while (i < text.length) {
    // 优先处理行内代码，避免代码中的 Markdown 标记被误判
    if (text[i] === '`') {
      const code = parseCodeSpan(text, i);
      if (code) {
        tokens.push({ type: 'code', raw: code.raw, content: code.code });
        i = code.end;
        continue;
      }
      // 没有闭合反引号，当作普通文本并前进一步，避免死循环
      tokens.push({ type: 'text', raw: text[i] });
      i++;
      continue;
    }

    // 图片 / 链接
    if ((text[i] === '!' && text[i + 1] === '[') || text[i] === '[') {
      const link = parseLinkOrImage(text, i);
      if (link) {
        tokens.push({
          type: link.isImage ? 'image' : 'link',
          raw: link.raw,
          content: link.text,
          url: link.url,
          title: link.title,
        });
        i = link.end;
        continue;
      }
      // 当前 [ 或 ![ 不构成有效链接/图片，当作普通文本并前进一步，避免死循环
      tokens.push({ type: 'text', raw: text[i] });
      i++;
      continue;
    }

    // 累积普通文本到下一个可能的特殊标记
    const nextSpecial = findNextSpecial(text, i);
    if (nextSpecial === -1) {
      tokens.push({ type: 'text', raw: text.slice(i) });
      break;
    }
    if (nextSpecial > i) {
      tokens.push({ type: 'text', raw: text.slice(i, nextSpecial) });
    }
    i = nextSpecial;
  }

  return tokens;
}

function findNextSpecial(text: string, start: number): number {
  const backtick = text.indexOf('`', start);
  let linkStart = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[' && (i === 0 || text[i - 1] !== '\\')) {
      linkStart = i;
      break;
    }
    if (text[i] === '!' && text[i + 1] === '[' && (i === 0 || text[i - 1] !== '\\')) {
      linkStart = i;
      break;
    }
  }
  const candidates = [backtick, linkStart].filter(n => n !== -1);
  return candidates.length > 0 ? Math.min(...candidates) : -1;
}

function parseCodeSpan(text: string, start: number): { raw: string; code: string; end: number } | null {
  let tickCount = 0;
  while (text[start + tickCount] === '`') tickCount++;
  if (tickCount === 0) return null;

  let p = start + tickCount;
  while (p < text.length) {
    if (text.slice(p, p + tickCount) === '`') {
      // 确保闭合反引号数量严格相等，避免 ``code``` 提前结束
      if (text[p + tickCount] === '`') {
        p++;
        continue;
      }
      const raw = text.slice(start, p + tickCount);
      let code = text.slice(start + tickCount, p);
      // CommonMark：如果内容以空格开始和结束，且首尾不是同一个空格，各 trim 一个空格
      if (code.length >= 2 && code[0] === ' ' && code[code.length - 1] === ' ' && !/^ +$/.test(code)) {
        code = code.slice(1, -1);
      }
      return { raw, code, end: p + tickCount };
    }
    p++;
  }
  return null;
}

function parseLinkOrImage(text: string, start: number): { raw: string; isImage: boolean; text: string; url: string; title: string; end: number } | null {
  const isImage = text[start] === '!' && text[start + 1] === '[';
  const bracketStart = isImage ? start + 1 : start;
  if (text[bracketStart] !== '[') return null;

  let p = bracketStart + 1;
  let depth = 1;
  while (p < text.length && depth > 0) {
    const ch = text[p];
    if (ch === '\\') {
      p += 2;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    p++;
  }
  if (depth !== 0) return null;

  const textEnd = p - 1; // 闭合 ] 的位置
  if (text[p] !== '(') return null;

  let q = p + 1;
  let parenDepth = 0;
  while (q < text.length) {
    const ch = text[q];
    if (ch === '\\') {
      q += 2;
      continue;
    }
    if (ch === '(') parenDepth++;
    else if (ch === ')') {
      if (parenDepth === 0) break;
      parenDepth--;
    }
    q++;
  }
  if (q >= text.length || text[q] !== ')') return null;

  const raw = text.slice(start, q + 1);
  const linkText = unescapeMarkdown(text.slice(bracketStart + 1, textEnd));
  const urlTitle = splitUrlAndTitle(text.slice(p + 1, q));

  return {
    raw,
    isImage,
    text: linkText,
    url: urlTitle.url,
    title: urlTitle.title,
    end: q + 1,
  };
}

function splitUrlAndTitle(raw: string): { url: string; title: string } {
  const trimmed = raw.trim();
  let url = trimmed;
  let title = '';
  const m = trimmed.match(/^(.*?)(?:\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))$/);
  if (m) {
    url = m[1].trim();
    title = unescapeMarkdown(m[2].slice(1, -1));
  }
  return { url: unescapeMarkdown(url), title };
}

/** 去除 Markdown 标准转义反斜杠 */
function unescapeMarkdown(s: string): string {
  return s.replace(/\\([\\\`\*\_\{\}\[\]\(\)\#\+\-\.\!\~\|\<\>\"\'\ ])/g, '$1');
}

function parseEmphasisInText(s: string): ContentFragment[] {
  const regex = /(\*{3}([^\s*][\s\S]*?[^\s*])\*{3})|(\*{2}([^\s*][\s\S]*?[^\s*])\*{2})|(\*([^\s*][\s\S]*?[^\s*])\*)|(~~([^\s~][\s\S]*?[^\s~])~~)|(==([^=\n]+)==)/g;
  const out: ContentFragment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(s)) !== null) {
    if (match.index > lastIndex) {
      out.push({ t: 't', v: s.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      out.push({ t: 't', v: match[2] ?? '', f: 'b', fa: { bold: true, italic: true } });
    } else if (match[3]) {
      out.push({ t: 't', v: match[4] ?? '', f: 'b', fa: { bold: true } });
    } else if (match[5]) {
      out.push({ t: 't', v: match[6] ?? '', f: 'b', fa: { italic: true } });
    } else if (match[7]) {
      out.push({ t: 't', v: match[8] ?? '', f: 'b', fa: { strikethrough: true } });
    } else if (match[9]) {
      out.push({ t: 'h', v: match[10] ?? '' });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < s.length) {
    out.push({ t: 't', v: s.slice(lastIndex) });
  }
  return out.length > 0 ? out : [{ t: 't', v: s }];
}

// ============================================================
// SHARED TYPES
// ============================================================

export interface TreeNode {
  /** 原始文本 (保留高亮语法) */
  text: string;
  /** 解析后的 ContentFragment[] (用于插入 Orca) */
  fragments: ContentFragment[];
  /** 子节点 */
  children: TreeNode[];
  /** 层级深度 */
  level: number;
  /** 在原文中的行索引 (用于提取正文) */
  idx: number;
}

// ============================================================
// FORMAT DETECTION (与 HTML 参考工具一致)
// ============================================================

export type FileFormat =
  | 'markdown'
  | 'opml'
  | 'json'
  | 'plaintext'
  | 'logseq'
  | 'obsidian'
  | 'orca'
  | 'siyuan'
  | 'list_outline'
  | 'unordered'
  | 'ordered'
  | 'empty';

export function detectFormat(text: string): FileFormat {
  const trimmed = text.trim();
  if (!trimmed) return 'empty';
  // OPML
  if (trimmed.startsWith('<?xml') || /^<opml/i.test(trimmed)) return 'opml';
  // JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch (e) {
      // Not valid JSON, continue detection
    }
  }
  // Orca Note (含 orca-inline 类)
  if (/orca-inline/.test(trimmed)) return 'orca';
  // SiYuan (含 data-type="mark|color|backgroundColor" 属性)
  if (/<span\s+data-type="(mark|color|backgroundColor)"/i.test(trimmed)) return 'siyuan';
  // Obsidian (含 <span style="background:..."> 或 <font color=...>)
  if (/<span\s+style="background:|<font\s+color=/i.test(trimmed)) return 'obsidian';
  // Logseq (含 [[#color]]== 或 [[$color]]== 或 [[#cloze]]==)
  if (/\[\[#(red|blue|green|cloze)\]\]==|\[\[\$(red|blue|green)\]\]==/.test(trimmed)) return 'logseq';
  // ★ 优先检查全文是否包含 heading——如果有 heading，一定是 markdown 格式
  // 这解决了文件开头是 tab 缩进列表但全文包含 heading 的问题
  if (/^#{1,6}\s/.test(trimmed)) return 'markdown';
  if (/^#{1,6}\s/.test(text)) return 'markdown';
  // Markdown 文档（含代码块、表格、引用、图片、链接、加粗/斜体等行内语法）
  // ★ 在检测列表格式前先检查全文 markdown 特征
  if (looksLikeMarkdown(text)) return 'markdown';
  // List-based outline (unordered: -, *, +) — 仅检查首行
  if (/^[-+*]\s/.test(trimmed)) return 'list_outline';
  // Ordered list outline (1., 2., etc.) — 仅检查首行
  if (/^\d+\.\s/.test(trimmed)) return 'ordered';
  // Unordered list outline (tab-indented with - prefix) — 仅检查首行
  if (/^\t*[-+*]\s/.test(trimmed)) return 'unordered';
  // Plain text
  return 'plaintext';
}

/** 判断文本是否包含常见 Markdown 语法特征 */
function looksLikeMarkdown(text: string): boolean {
  const s = text;
  // 代码块
  if (/```[\s\S]*?```/.test(s)) return true;
  // 表格行
  if (/\n\s*\|[^\n]+\|\s*\n/.test(s)) return true;
  // 引用块
  if (/\n\s*>\s+[^\n]+/.test(s)) return true;
  // Markdown 图片 / 链接
  if (/!?\[[^\]]+\]\([^)]+\)/.test(s)) return true;
  // 加粗 / 斜体 / 删除线 / 行内代码
  if (/\*\*[^*]+\*\*/.test(s) || /__[^_]+__/.test(s)) return true;
  if (/[^*]\*[^*]+\*[^*]/.test(s) || /_[^_]+_/.test(s)) return true;
  if (/~~[^~]+~~/.test(s)) return true;
  if (/`[^`]+`/.test(s)) return true;
  return false;
}

/**
 * 检测文本中是否包含 Orca Note 高亮语法
 * 支持 HTML 格式 (<span class="orca-inline">) 和纯文本格式 (==text==)
 */
function hasOrcaHighlightSyntax(text: string): boolean {
  // HTML 格式: <span class="orca-inline ...">
  if (/orca-inline/.test(text)) return true;
  // 纯文本格式: ==text== (Orca 挖空语法)
  if (/==[^=\n]+==/.test(text)) return true;
  return false;
}

/** 获取高亮源格式 (用于高亮解析) */
export function getHighlightSource(format: FileFormat, text?: string): HighlightSource {
  // 对于结构化格式，先检测是否包含高亮语法
  if (text && (format === 'list_outline' || format === 'unordered' || format === 'ordered' || format === 'markdown' || format === 'plaintext')) {
    // 检测 Orca 原生语法
    if (hasOrcaHighlightSyntax(text)) {
      return 'orca';
    }
    // 检测 SiYuan 语法 (<span data-type="mark|color|backgroundColor">)
    if (/<span\s+data-type="(mark|color|backgroundColor)"/i.test(text)) {
      return 'siyuan';
    }
    // 检测 Logseq 语法
    if (/\[\[#(red|blue|green|cloze)\]\]==|\[\[\$(red|blue|green)\]\]==/.test(text)) {
      return 'logseq';
    }
    // 检测 HTML 高亮语法 (Obsidian 风格 + 本插件导出格式)
    if (/<span\s+style="[^"]*?(?:background|color):|<font\s+color=|<mark\s+style="[^"]*?background:|<span\s+class="cloze"/i.test(text)) {
      return 'obsidian';
    }
  }

  switch (format) {
    case 'logseq': return 'logseq';
    case 'obsidian': return 'obsidian';
    case 'orca': return 'orca';
    case 'siyuan': return 'siyuan';
    case 'json': return 'auto'; // JSON 中可能包含各种格式
    case 'markdown': return 'auto';
    case 'list_outline':
    case 'unordered':
    case 'ordered': return 'auto';
    case 'opml': return 'plaintext';
    case 'plaintext': return 'plaintext';
    default: return 'auto';
  }
}

// ============================================================
// MARKDOWN PARSER
// ============================================================

/** 检测 ATX 标题 (# 标题) */
function isAtxHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim());
}

/** 检测 Setext 标题下划线 (=== 或 ---) */
function isSetextUnderline(line: string): boolean {
  return /^\s*={3,}\s*$/.test(line) || /^\s*-{3,}\s*$/.test(line);
}

/** 将 Setext 标题转换为 ATX 标题，简化后续解析 */
function preprocessSetextHeadings(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (nextLine && isSetextUnderline(nextLine) && line.trim() && !isAtxHeading(line)) {
      const level = /^\s*=/.test(nextLine) ? 1 : 2;
      result.push('#'.repeat(level) + ' ' + line.trim());
      i++; // skip underline
    } else {
      result.push(line);
    }
  }
  return result;
}

/** 计算行首缩进级别 (tabs 或 2 个空格 = 1 级) */
function computeIndent(line: string): { indent: number; contentStart: number } {
  let indent = 0;
  let j = 0;
  while (j < line.length) {
    if (line[j] === '\t') { indent++; j++; }
    else if (line[j] === ' ' && line[j + 1] === ' ') { indent++; j += 2; }
    else break;
  }
  return { indent, contentStart: j };
}

/** 移除列表标记并保留任务列表状态 */
function stripListMarker(content: string): { content: string; taskState: string | null } {
  let taskState: string | null = null;
  // Task list: - [x] / - [ ] / * [x] / 1. [x]（允许前导空白）
  const taskMatch = content.match(/^\s*([-*+]|\d+\.)\s+\[([ xX])\]\s+/);
  if (taskMatch) {
    taskState = taskMatch[2].toLowerCase() === 'x' ? '[x]' : '[ ]';
    content = content.replace(/^\s*([-*+]|\d+\.)\s+\[[ xX]\]\s+/, '');
  } else {
    content = content.replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, '');
  }
  return { content: content.trim(), taskState };
}

/**
 * Parse markdown to tree.
 * Supports:
 * - ATX headings (#, ##, ###)
 * - Setext headings (underline === / ---)
 * - Unordered lists (-, *, +)
 * - Ordered lists (1., 2., ...)
 * - Task lists (- [ ], - [x])
 * - Fenced code blocks (```)
 * - Blockquotes (>)
 * - Tables (|)
 * - Horizontal rules
 * - Inline markdown (bold, italic, links, images, code, strikethrough)
 */
export function parseMarkdown(text: string, hlSource: HighlightSource = 'auto'): TreeNode[] {
  let lines = text.split('\n');
  lines = preprocessSetextHeadings(lines);

  const hasHeadings = lines.some(l => isAtxHeading(l));
  const hasBullets = lines.some(l => /^\s*[-+*]\s/.test(l));
  const hasOrderedBullets = lines.some(l => /^\s*\d+\.\s/.test(l));

  // 如果文档包含标题，优先使用标题解析器（标题定义层级结构）
  if (hasHeadings) {
    return parseHeadingMarkdown(lines, hlSource);
  }

  // 如果文档包含列表标记，使用列表解析器
  if (hasBullets || hasOrderedBullets) {
    return parseBulletMarkdown(lines, hlSource);
  }

  // 否则按普通 Markdown 文档解析（段落、代码块、表格等）
  return parseProseMarkdown(lines, hlSource);
}

/** 判断一行是否为列表项（无序或有序） */
function isListLine(line: string): boolean {
  return /^\s*[-+*]\s/.test(line) || /^\s*\d+\.\s/.test(line);
}

/** 解析普通 Markdown 文档（无标题、无列表大纲）
 * 将连续的非特殊行合并为段落，保留代码块、分隔线等结构
 */
function parseProseMarkdown(lines: string[], hlSource: HighlightSource): TreeNode[] {
  const roots: TreeNode[] = [];
  let paragraphBuffer: string[] = [];
  let paragraphStartIdx = 0;

  const flushParagraph = (forceIdx?: number) => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(' ').trim();
    paragraphBuffer = [];
    if (!text) return;
    const frags = parseHighlightToFrags(text, hlSource);
    roots.push({
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level: 0,
      idx: forceIdx ?? paragraphStartIdx,
    });
  };

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';
  let codeBlockStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // 代码块处理
    if (rawLine.trim().startsWith('```')) {
      if (!inCodeBlock) {
        flushParagraph(i);
        const fenceMatch = rawLine.match(/^([ \t]*)```(.*)$/);
        codeBlockLang = fenceMatch ? fenceMatch[2].trim() : '';
        codeBlockLines = [codeBlockLang ? `\`\`\`${codeBlockLang}` : '```'];
        codeBlockStartIdx = i;
        inCodeBlock = true;
      } else {
        codeBlockLines.push('```');
        inCodeBlock = false;
        const codeBlockContent = codeBlockLines.join('\n');
        const frags = parseHighlightToFrags(codeBlockContent, hlSource);
        const plainText = fragsToPlainText(frags);
        if (plainText.trim()) {
          roots.push({
            text: plainText,
            fragments: frags,
            children: [],
            level: 0,
            idx: codeBlockStartIdx,
          });
        }
        codeBlockLines = [];
        codeBlockLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // 空行：结束当前段落
    if (!rawLine.trim()) {
      flushParagraph();
      continue;
    }

    // 分隔线：独立成块
    if (/^[-*_]{3,}\s*$/.test(rawLine.trim())) {
      flushParagraph(i);
      continue;
    }

    // 列表项：不应出现在 prose 中，但做兜底处理
    if (isListLine(rawLine)) {
      flushParagraph(i);
      const { indent, contentStart } = computeIndent(rawLine);
      let content = rawLine.slice(contentStart);
      const { content: strippedContent, taskState } = stripListMarker(content);
      content = strippedContent;
      if (taskState && content) content = taskState + ' ' + content;
      content = content.trim();
      if (content) {
        const frags = parseHighlightToFrags(content, hlSource);
        roots.push({
          text: fragsToPlainText(frags),
          fragments: frags,
          children: [],
          level: indent,
          idx: i,
        });
      }
      continue;
    }

    // 表格行：合并连续的表格行为单个节点，使用 parseHighlightToFrags 解析高亮语法
    if (/^\s*\|/.test(rawLine)) {
      flushParagraph(i);
      const tableLines: string[] = [rawLine.trim()];
      let j = i + 1;
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        tableLines.push(lines[j].trim());
        j++;
      }
      i = j - 1; // 跳过已合并的表格行
      const tableText = tableLines.join('\n');
      const frags = parseHighlightToFrags(tableText, hlSource);
      roots.push({
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level: 0,
        idx: i,
      });
      continue;
    }

    // 引用块：单独成块，保留 > 标记，使用 parseHighlightToFrags 解析高亮语法
    if (/^\s*>/.test(rawLine)) {
      flushParagraph(i);
      const content = rawLine.replace(/^\s*>\s?/, '> ').trim();
      const frags = parseHighlightToFrags(content, hlSource);
      roots.push({
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level: 0,
        idx: i,
      });
      continue;
    }

    // 普通段落行：加入缓冲区
    if (paragraphBuffer.length === 0) {
      paragraphStartIdx = i;
    }
    paragraphBuffer.push(rawLine.trim());
  }

  flushParagraph();

  // 未闭合代码块兜底
  if (inCodeBlock && codeBlockLines.length > 0) {
    codeBlockLines.push('```');
    const codeBlockContent = codeBlockLines.join('\n');
    const frags = parseHighlightToFrags(codeBlockContent, hlSource);
    const plainText = fragsToPlainText(frags);
    if (plainText.trim()) {
      roots.push({
        text: plainText,
        fragments: frags,
        children: [],
        level: 0,
        idx: codeBlockStartIdx,
      });
    }
  }

  return roots;
}

/** Parse bullet-based markdown (Logseq/Workflowy style) */
function parseBulletMarkdown(lines: string[], hlSource: HighlightSource): TreeNode[] {
  interface StackItem { node: TreeNode; indent: number; }
  const roots: TreeNode[] = [];
  const stack: StackItem[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';
  let codeBlockStartIdx = 0;

  const pushNode = (node: TreeNode, indent: number) => {
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, indent });
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Handle fenced code blocks
    if (rawLine.trim().startsWith('```')) {
      if (!inCodeBlock) {
        const fenceMatch = rawLine.match(/^([ \t]*)```(.*)$/);
        codeBlockLang = fenceMatch ? fenceMatch[2].trim() : '';
        codeBlockLines = [codeBlockLang ? `\`\`\`${codeBlockLang}` : '```'];
        codeBlockStartIdx = i;
        inCodeBlock = true;
      } else {
        codeBlockLines.push('```');
        inCodeBlock = false;
        const codeBlockContent = codeBlockLines.join('\n');
        const frags = parseHighlightToFrags(codeBlockContent, hlSource);
        const plainText = fragsToPlainText(frags);
        if (plainText.trim()) {
          const indent = computeIndent(rawLine).indent;
          const node: TreeNode = {
            text: plainText,
            fragments: frags,
            children: [],
            level: indent,
            idx: codeBlockStartIdx,
          };
          pushNode(node, indent);
        }
        codeBlockLines = [];
        codeBlockLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Skip horizontal rules
    if (/^[-*_]{3,}\s*$/.test(rawLine.trim())) continue;

    // Skip empty lines
    if (!rawLine.trim()) continue;

    // Compute indentation
    const { indent, contentStart } = computeIndent(rawLine);
    let content = rawLine.slice(contentStart);

    // Blockquote: keep > marker, use parseHighlightToFrags
    if (/^\s*>/.test(content)) {
      content = content.replace(/^\s*>\s?/, '> ');
      content = content.trim();
      if (!content) continue;
      const frags = parseHighlightToFrags(content, hlSource);
      pushNode({
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level: indent,
        idx: i,
      }, indent);
      continue;
    }

    // 表格行：合并连续的表格行为单个节点，使用 parseHighlightToFrags 解析高亮语法
    if (/^\s*\|/.test(rawLine)) {
      const tableLines: string[] = [rawLine.trim()];
      let j = i + 1;
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        tableLines.push(lines[j].trim());
        j++;
      }
      i = j - 1; // 跳过已合并的表格行
      const tableText = tableLines.join('\n');
      const frags = parseHighlightToFrags(tableText, hlSource);
      const node: TreeNode = {
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level: indent,
        idx: i,
      };
      pushNode(node, indent);
      continue;
    }

    // Strip list marker and detect task state
    // ★ 修复：blockquote 开头的行（>）不应被误认为列表标记
    // 否则 "> *italic*" 中的 * 会被 stripListMarker 当作列表标记去掉，导致 italic 解析失败
    const isBlockquote = /^\s*>/.test(content);
    let strippedContent = content;
    let taskState: string | null = null;
    if (!isBlockquote) {
      const { content: sContent, taskState: sTask } = stripListMarker(content);
      strippedContent = sContent;
      taskState = sTask;
    }
    content = strippedContent;
    if (taskState && content) {
      content = taskState + ' ' + content;
    }

    content = content.trim();
    if (!content) continue;

    const frags = parseHighlightToFrags(content, hlSource);
    const plainText = fragsToPlainText(frags);

    const node: TreeNode = {
      text: plainText,
      fragments: frags,
      children: [],
      level: indent,
      idx: i,
    };

    pushNode(node, indent);
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    codeBlockLines.push('```');
    const codeBlockContent = codeBlockLines.join('\n');
    const frags = parseHighlightToFrags(codeBlockContent, hlSource);
    const plainText = fragsToPlainText(frags);
    if (plainText.trim()) {
      const node: TreeNode = {
        text: plainText,
        fragments: frags,
        children: [],
        level: 0,
        idx: codeBlockStartIdx,
      };
      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

/** Parse heading-based markdown
 * 单次线性扫描，严格保持文档顺序与层级：
 * - 每个标题出现时，先把标题之前的正文挂到“当前父标题”下（不是栈顶最深标题）
 * - 标题自身挂到比它层级高的最近父标题下
 * - 正文节点 level = 父标题 level + 1
 */
function parseHeadingMarkdown(lines: string[], hlSource: HighlightSource): TreeNode[] {
  const roots: TreeNode[] = [];
  // 标题栈，存 { node, level }
  const headingStack: { node: TreeNode; level: number }[] = [];
  // 当前父标题的栈索引：正文应挂到这个标题下
  // 栈顶始终是“当前父标题”，子标题出现时才会临时变深
  let parentIndex = -1;
  // 正文缓冲区
  let contentBuffer: string[] = [];

  const flushContent = () => {
    if (contentBuffer.length === 0) return;
    const sectionLines = contentBuffer;
    contentBuffer = [];
    if (!sectionLines.some(l => l.trim())) return;

    const sectionRoots = parseBulletMarkdown(sectionLines, hlSource);
    const parentLevel = parentIndex >= 0 ? headingStack[parentIndex].level : 0;
    const targetNode = parentIndex >= 0 ? headingStack[parentIndex].node : null;

    for (const child of sectionRoots) {
      adjustNodeLevels(child, parentLevel + 1);
      if (targetNode) {
        targetNode.children.push(child);
      } else {
        roots.push(child);
      }
    }
  };

  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      contentBuffer.push(line);
      continue;
    }
    if (inCodeBlock) {
      contentBuffer.push(line);
      continue;
    }

    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      // 先把标题前的正文 flush 到当前父标题
      flushContent();

      const level = m[1].length;
      const content = m[2].trim();
      const fragments = parseHighlightToFrags(content, hlSource);
      const node: TreeNode = {
        text: fragsToPlainText(fragments),
        fragments,
        children: [],
        level,
        idx: i,
      };

      // 找到合适的父标题：比当前标题层级高（level 数字小）的最近标题
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }

      if (headingStack.length > 0) {
        headingStack[headingStack.length - 1].node.children.push(node);
      } else {
        roots.push(node);
      }
      headingStack.push({ node, level });
      // ★ 关键：push 后更新 parentIndex，使后续正文挂到当前标题下
      parentIndex = headingStack.length - 1;
      continue;
    }

    contentBuffer.push(line);
  }

  flushContent();

  if (roots.length === 0 && headingStack.length === 0) {
    return parseBulletMarkdown(lines, hlSource);
  }

  return roots;
}

/** 将节点及其所有子节点的 level 调整为基于 baseLevel 的相对层级 */
function adjustNodeLevels(node: TreeNode, baseLevel: number) {
  node.level = baseLevel + node.level;
  for (const child of node.children) {
    adjustNodeLevels(child, baseLevel);
  }
}

// ============================================================
// HTML PARSER
// ============================================================

export function parseHTML(htmlText: string, hlSource: HighlightSource = 'orca'): TreeNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  // Try heading-based parsing first
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length > 0) {
    return parseHTMLHeadings(doc, hlSource);
  }

  // Try list-based parsing
  const lists = doc.querySelectorAll('ul, ol');
  if (lists.length > 0) {
    const roots: TreeNode[] = [];
    for (const list of Array.from(lists)) {
      if (list.parentElement?.tagName === 'LI') continue;
      roots.push(...parseHTMLList(list, 0, hlSource));
    }
    return roots;
  }

  // Fallback: treat as single node
  const bodyText = doc.body?.textContent || htmlText;
  const frags = parseHighlightToFrags(bodyText.trim(), hlSource);
  return [{
    text: fragsToPlainText(frags),
    fragments: frags,
    children: [],
    level: 0,
    idx: 0,
  }];
}

function parseHTMLHeadings(doc: Document, hlSource: HighlightSource): TreeNode[] {
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const flat: { node: TreeNode; level: number; el: Element; idx: number }[] = [];

  headings.forEach((h, i) => {
    const level = parseInt(h.tagName.substring(1));
    const html = h.innerHTML;
    const frags = parseHighlightToFrags(html, hlSource);
    flat.push({
      node: {
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level,
        idx: i,
      },
      level,
      el: h,
      idx: i,
    });
  });

  const roots: TreeNode[] = [];
  const stack: typeof flat = [];

  for (const h of flat) {
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(h.node);
    } else {
      stack[stack.length - 1].node.children.push(h.node);
    }
    stack.push(h);
  }

  return roots;
}

function parseHTMLList(list: Element, level: number, hlSource: HighlightSource): TreeNode[] {
  const nodes: TreeNode[] = [];
  const items = list.querySelectorAll(':scope > li');

  items.forEach((item, idx) => {
    // Get direct text content (not from nested lists)
    const clone = item.cloneNode(true) as Element;
    const nestedLists = clone.querySelectorAll('ul, ol');
    nestedLists.forEach(l => l.remove());
    const html = clone.innerHTML;
    const frags = parseHighlightToFrags(html, hlSource);

    const node: TreeNode = {
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level,
      idx,
    };

    // Parse nested lists
    const nested = item.querySelectorAll(':scope > ul, :scope > ol');
    for (const nl of Array.from(nested)) {
      node.children.push(...parseHTMLList(nl, level + 1, hlSource));
    }

    nodes.push(node);
  });

  return nodes;
}

// ============================================================
// OPML PARSER
// ============================================================

export function parseOPML(opmlText: string, hlSource: HighlightSource = 'auto'): TreeNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opmlText, 'text/xml');
  const body = doc.querySelector('body');
  if (!body) return [];

  return parseOPMLOutlines(body, 0, hlSource);
}

function parseOPMLOutlines(parent: Element, level: number, hlSource: HighlightSource): TreeNode[] {
  const nodes: TreeNode[] = [];
  const outlines = parent.querySelectorAll(':scope > outline');

  outlines.forEach((outline, idx) => {
    const text = outline.getAttribute('text') || outline.getAttribute('title') || '';
    const frags = parseHighlightToFrags(text, hlSource);

    const node: TreeNode = {
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level,
      idx,
    };

    // Parse children
    node.children = parseOPMLOutlines(outline, level + 1, hlSource);
    nodes.push(node);
  });

  return nodes;
}

// ============================================================
// PLAIN TEXT PARSER
// ============================================================

export function parsePlainText(text: string): TreeNode[] {
  const lines = text.split('\n');
  const roots: TreeNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const frags = parseHighlightToFrags(trimmed, 'auto');
    roots.push({
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level: 0,
      idx: i,
    });
  }

  return roots;
}

// ============================================================
// JSON PARSER
// ============================================================

/**
 * Parse JSON to tree. Supports multiple JSON structures:
 * 1. { outline: [{ content, children }] } — Logseq/Workflowy export format
 * 2. [{ content, children }] — Array of tree nodes
 * 3. { text, children } — Single tree node
 * 4. [{ text, children }] — Array of text nodes
 */
export function parseJSON(jsonText: string, hlSource: HighlightSource = 'auto'): TreeNode[] {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    // 抛出明确的错误，让 UI 层展示给用户
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Case 1: { outline: [...] }
  if (data && typeof data === 'object' && Array.isArray(data.outline)) {
    return data.outline.map((item: any, idx: number) => jsonItemToTreeNode(item, 0, hlSource, idx));
  }

  // Case 2: Array of nodes
  if (Array.isArray(data)) {
    return data.map((item: any, idx: number) => jsonItemToTreeNode(item, 0, hlSource, idx));
  }

  // Case 3: Single node object
  if (data && typeof data === 'object') {
    return [jsonItemToTreeNode(data, 0, hlSource, 0)];
  }

  return [];
}

function jsonItemToTreeNode(item: any, level: number, hlSource: HighlightSource, idx: number): TreeNode {
  if (!item || typeof item !== 'object') {
    // Primitive value — treat as plain text
    const text = String(item ?? '');
    const frags = parseHighlightToFrags(text, hlSource);
    return { text: fragsToPlainText(frags), fragments: frags, children: [], level, idx };
  }

  // Extract text content from various possible keys（使用 ?? 避免把 0/false 误判为空）
  const rawText = item.content ?? item.text ?? item.title ?? item.value ?? '';
  const fragments = parseHighlightToFrags(String(rawText), hlSource);
  const text = fragsToPlainText(fragments);

  // Extract children from various possible keys
  const rawChildren = item.children || item.items || item.sub || [];
  const children = Array.isArray(rawChildren)
    ? rawChildren.map((child: any, i: number) => jsonItemToTreeNode(child, level + 1, hlSource, i))
    : [];

  return { text, fragments, children, level, idx };
}

// ============================================================
// MAIN PARSE FUNCTION
// ============================================================

/**
 * 清理 Logseq 等来源中的文档级元数据标记
 * 例如：
 *   logseq.order-list-type:: number
 *   another-key:: some-value
 *   - key:: value
 * 这些行不属于正文内容，导入时自动剔除
 */
export function cleanLogseqMarkers(text: string): string {
  let s = text;
  // 1. 清理独立的 "key:: value" 行 (Logseq 属性)
  s = s.replace(/^[ \t]*[-+]?[ \t]*[A-Za-z][A-Za-z0-9._-]*::[ \t]*[^\n]*$/gm, '');
  // 2. 清理行内的 "key:: value" 标记
  s = s.replace(/(^|\s)[A-Za-z][A-Za-z0-9._-]*::[ \t]*[^\n]*$/gm, '$1');
  return s;
}

/**
 * 将导入文本中的图片格式统一转换为 Markdown 图片格式
 *   Orca 格式：image: 图片路径  或  image:: 图片路径
 *   裸 URL：https://xxx.png 或 http://xxx.jpg
 *   md 格式：![替代文字](图片路径)
 */
export function convertImageSyntax(text: string): string {
  let s = text;

  // 1. 整行的 image::  / image:  (允许前导空白)
  s = s.replace(
    /^[ \t]*image::?[ \t]+(\S+)[ \t]*$/gm,
    (_m, p) => `![](${p})`,
  );

  // 2. 行内的 image:  path (无 ::)
  s = s.replace(
    /(^|\s)image:[ \t]+(\S+)/g,
    (_m, prefix, p) => `${prefix}![](${p})`,
  );

  // 3. 裸图片 URL 转 markdown 格式 (整行只有 URL 的情况)
  // 匹配 http/https 开头，以图片扩展名结尾的 URL
  s = s.replace(
    /^[ \t]*(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico))[ \t]*$/gim,
    (_m, url) => `![](${url})`,
  );

  // 4. 已经是 markdown 图片格式但 URL 包含特殊字符的情况，保持不变

  return s;
}

/**
 * 解码常见的 HTML 实体，避免导入后出现 &quot; 等字符
 */
export function decodeHtmlEntities(text: string): string {
  // 必须最后解码 &amp;，否则 &amp;quot; 会被错误双重解码为 "
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(+code))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 预处理导入文本：清理 Logseq 元数据 + HTML 解码 + 转换图片语法
 * 与 parseFile 中的预处理步骤完全一致
 */
export function preprocessForImport(text: string): string {
  return convertImageSyntax(cleanLogseqMarkers(decodeHtmlEntities(text)));
}

export function parseFile(text: string, format?: FileFormat): TreeNode[] {
  const fmt = format || detectFormat(text);

  // 预处理：
  // 1. 清理 Logseq 元数据
  // 2. HTML 解码：&quot; → ", &amp; → &, &lt; → <, &gt; → >
  // 3. 转换图片语法
  const cleaned = cleanLogseqMarkers(decodeHtmlEntities(text));
  const prepared = convertImageSyntax(cleaned);

  // 传入预处理后的文本，以便检测高亮语法类型
  const hlSource = getHighlightSource(fmt, prepared);

  switch (fmt) {
    case 'markdown': return parseMarkdown(prepared, hlSource);
    case 'orca': return parseHTML(prepared, hlSource);
    case 'opml': return parseOPML(prepared, hlSource);
    case 'json': return parseJSON(prepared, hlSource);
    case 'list_outline':
    case 'logseq':
    case 'plaintext': return parseMarkdown(prepared, hlSource);
    case 'obsidian': return parseMarkdown(prepared, 'obsidian');
    // ★ 修复：unordered 格式也走 parseMarkdown，让它能同时识别 heading + 列表
    // 原来的 parseBulletMarkdown 只认列表标记，会把 # 标题当成普通文本
    case 'unordered': {
      const hasHeadings = prepared.split('\n').some(l => /^#{1,6}\s/.test(l));
      if (hasHeadings) {
        // 文件包含 heading，优先用 heading parser（能同时处理 heading + 列表嵌套）
        return parseMarkdown(prepared, hlSource);
      } else {
        // 纯列表文件，用 bullet parser
        return parseBulletMarkdown(prepared.split('\n'), hlSource);
      }
    }
    case 'ordered': {
      const hasHeadings = prepared.split('\n').some(l => /^#{1,6}\s/.test(l));
      if (hasHeadings) {
        return parseMarkdown(prepared, hlSource);
      } else {
        return parseBulletMarkdown(prepared.split('\n'), hlSource);
      }
    }
    case 'empty': return [];
    default: return parseMarkdown(prepared, hlSource);
  }
}
