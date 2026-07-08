import type { ContentFragment } from './orca.d.ts';
import type { TreeNode } from './parser.ts';
import {
  fragsToLogseq,
  fragsToObsidian,
  fragsToOrcaHTML,
  fragsToSiyuan,
  fragsToPlainText,
  fragsToBasicHTML,
  fragsToMarkdown,
  fragsToPreviewHTML,
  renderHighlightsHTML,
  renderHighlightsForWord,
  renderFragsClozeToSyntax,
  convertMarkdownImagesToHTML,
  escapeXmlAttr,
  normalizeHighlights,
  renderHighlights,
  type HighlightSource,
} from './highlight.ts';

// ============================================================
// EXPORT CONFIG TYPES
// ============================================================

export type ExportStyle = 'logseq' | 'obsidian' | 'orca' | 'siyuan';
export type ExportFormat = 'outline' | 'ordered' | 'tasklist' | 'hierarchy' | 'html' | 'json' | 'opml' | 'markdown' | 'doc' | 'txt';

export interface ExportOptions {
  /** 导出样式 (logseq/obsidian/orca) */
  style: ExportStyle;
  /** 导出格式 */
  format: ExportFormat;
  /** 是否转换高亮语法 */
  richText: boolean;
  /** 最大深度 */
  maxDepth: number;
  /** 正文处理模式: include=保留正文, onlyH=仅标题 */
  bodyMode: 'include' | 'onlyH';
  /** 源高亮格式 (用于解析输入中的高亮) */
  sourceFormat: HighlightSource;
  /** 文件名 */
  filename: string;
  /** Word 格式高亮标签模式 (traditional=传统标签/orcaNative=Orca 原生) */
  wordHighlightMode: 'traditional' | 'orcaNative';
  /** 导出挖空模式：启用后将 Orca 挖空转为指定语法 */
  exportClozeMode: boolean;
  /** 导出挖空语法数组（多选时嵌套组合） */
  exportClozeSyntax: string[];
}

// 各样式支持的导出格式 (与 HTML 参考工具一致，增加了有序列表/任务列表/树形)
export const FORMAT_OPTIONS: Record<ExportStyle, { value: ExportFormat; label: string }[]> = {
  logseq: [
    { value: 'outline', label: '大纲 (无序列表)' },
    { value: 'ordered', label: '大纲 (有序列表)' },
    { value: 'tasklist', label: '任务列表' },
    { value: 'hierarchy', label: '树形大纲 (├─└─)' },
    { value: 'html', label: 'HTML (大纲)' },
    { value: 'json', label: 'JSON' },
    { value: 'opml', label: 'OPML (大纲)' },
    { value: 'markdown', label: 'Logseq Markdown' },
  ],
  obsidian: [
    { value: 'outline', label: '大纲 (无序列表)' },
    { value: 'ordered', label: '大纲 (有序列表)' },
    { value: 'tasklist', label: '任务列表' },
    { value: 'hierarchy', label: '树形大纲 (├─└─)' },
    { value: 'markdown', label: 'Obsidian Markdown' },
  ],
  orca: [
    { value: 'outline', label: '大纲 (无序列表)' },
    { value: 'ordered', label: '大纲 (有序列表)' },
    { value: 'tasklist', label: '任务列表' },
    { value: 'hierarchy', label: '树形大纲 (├─└─)' },
    { value: 'html', label: 'HTML (大纲)' },
    { value: 'json', label: 'JSON (大纲)' },
    { value: 'opml', label: 'OPML (大纲)' },
    { value: 'markdown', label: 'Markdown (大纲)' },
    { value: 'doc', label: 'Word (大纲)' },
    { value: 'txt', label: '纯文本 (大纲)' },
  ],
  siyuan: [
    { value: 'outline', label: '大纲 (无序列表)' },
    { value: 'ordered', label: '大纲 (有序列表)' },
    { value: 'tasklist', label: '任务列表' },
    { value: 'hierarchy', label: '树形大纲 (├─└─)' },
    { value: 'markdown', label: 'SiYuan Markdown' },
    { value: 'html', label: 'HTML (大纲)' },
    { value: 'json', label: 'JSON (大纲)' },
    { value: 'opml', label: 'OPML (大纲)' },
  ],
};

// 扩展名映射
const EXT_MAP: Record<ExportFormat, string> = {
  outline: 'md',
  ordered: 'md',
  tasklist: 'md',
  hierarchy: 'txt',
  markdown: 'md',
  html: 'html',
  json: 'json',
  opml: 'opml',
  doc: 'doc',
  txt: 'txt',
};

// MIME 类型映射
const MIME_MAP: Record<ExportFormat, string> = {
  outline: 'text/markdown',
  ordered: 'text/markdown',
  tasklist: 'text/markdown',
  hierarchy: 'text/plain',
  markdown: 'text/markdown',
  html: 'text/html',
  json: 'application/json',
  opml: 'text/xml',
  doc: 'application/msword',
  txt: 'text/plain',
};

// ============================================================
// TABLE HELPERS
// ============================================================

/** 检测节点是否为表格（fragments 中包含 Markdown 表格语法） */
function isTableNode(node: TreeNode): boolean {
  if (!node.fragments || node.fragments.length === 0) return false;
  const text = node.fragments.map(f => String(f.v ?? '')).join('');
  // Markdown 表格：至少两行，第二行为分隔行 |---|---|
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  if (!/^\s*\|/.test(lines[0])) return false;
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[1])) return false;
  // 确保第二行包含至少一个 -
  if (!/-/.test(lines[1])) return false;
  return true;
}

/** 将 Markdown 表格语法转换为 HTML <table> 标签
 * @param mdTable Markdown 表格文本（| col | col | 格式）
 * @param style 表格样式（可选：'bordered' | 'plain'）
 */
function markdownTableToHTML(mdTable: string, style: 'bordered' | 'plain' = 'bordered'): string {
  const lines = mdTable.split('\n').map(l => l.trim()).filter(l => l && /^\|/.test(l));
  if (lines.length < 2) return mdTable; // 无法解析，返回原文

  // 解析所有行
  const rows: string[][] = [];
  for (const line of lines) {
    // 菜单行：跳过分隔行 |---|---|
    if (/^\|?[\s:|-]+\|?$/.test(line) && !line.includes('|-|')) {
      // 检测是否为分隔行（只含 -、:、|、空格）
      if (/^[\s|:-]+$/.test(line) && line.includes('-')) continue;
    }
    // 解析单元格
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    rows.push(cells);
  }

  if (rows.length === 0) return mdTable;

  const borderStyle = style === 'bordered'
    ? 'border-collapse:collapse;width:100%;margin:8px 0;'
    : 'border-collapse:collapse;width:100%;margin:8px 0;';
  const cellStyle = style === 'bordered'
    ? 'border:1px solid #ccc;padding:6px 10px;text-align:left;'
    : 'padding:6px 10px;text-align:left;';

  let html = `<table style="${borderStyle}">`;
  // 第一行为表头
  if (rows.length > 0) {
    html += '<thead><tr>';
    for (const cell of rows[0]) {
      html += `<th style="${cellStyle}background:#f0f0f0;font-weight:600;">${escapeHtmlSafe(cell)}</th>`;
    }
    html += '</tr></thead>';
  }
  // 其余行为数据行
  if (rows.length > 1) {
    html += '<tbody>';
    for (let i = 1; i < rows.length; i++) {
      html += '<tr>';
      for (const cell of rows[i]) {
        html += `<td style="${cellStyle}">${escapeHtmlSafe(cell)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';
  }
  html += '</table>';
  return html;
}

// ============================================================
// FRAGMENTS → TEXT (基于导出样式与目标格式)
// ============================================================

/**
 * 根据样式与目标格式，返回片段的文本表示
 * - richText=false: 纯文本
 * - Orca + html: renderHighlightsHTML (标准标签)
 * - Orca + doc: renderHighlightsForWord (传统标签，根据 wordHighlightMode 可切换 Orca 原生)
 * - Orca + markdown/outline: renderHighlightsHTML (标准 HTML 标签，markdown 渲染器兼容)
 * - Orca + txt: 纯文本（无高亮）
 * - Orca + json/opml: fragsToOrcaHTML (Orca 原生语法，便于往返导入)
 * - Logseq: Logseq 语法
 * - Obsidian: Obsidian 语法
 */
function fragsToText(
  frags: ContentFragment[],
  style: ExportStyle,
  richText: boolean,
  format: ExportFormat,
  wordMode: 'traditional' | 'orcaNative' = 'traditional',
  exportClozeMode: boolean = false,
  exportClozeSyntax: string[] = [],
): string {
  // ★ 导出挖空模式优先：将 Orca 挖空 {t:'h'} 转为指定语法，其他 fragment 按样式处理
  if (exportClozeMode && exportClozeSyntax.length > 0) {
    return renderFragsClozeToSyntax(frags, exportClozeSyntax);
  }
  if (!richText) {
    return fragsToPlainText(frags);
  }
  // Orca 样式下，按目标格式选择高亮标签
  if (style === 'orca') {
    if (format === 'html') {
      // HTML: 使用标准 HTML 标签 (语义化 mark + span style)，并将 markdown 图片转为 <img>
      return convertMarkdownImagesToHTML(renderHighlightsHTML(frags));
    }
    if (format === 'doc') {
      // Word: 根据设置选择，并将 markdown 图片转为 <img>
      const html = wordMode === 'orcaNative' ? fragsToOrcaHTML(frags) : renderHighlightsForWord(frags);
      return convertMarkdownImagesToHTML(html);
    }
    if (format === 'txt') {
      // 纯文本：不包含高亮标记
      return fragsToPlainText(frags);
    }
    if (format === 'markdown' || format === 'outline') {
      // Markdown: 所有高亮类型（bc/fc/h）均转换为 ==text== 语法
      // - 挖空效果 → ==高亮==（Markdown 标准语法）
      return fragsToMarkdown(frags);
    }
    // json, opml: 使用 Orca 原生语法（便于往返导入），保留 markdown 图片语法
    return fragsToOrcaHTML(frags);
  }
  switch (style) {
    case 'logseq': return fragsToLogseq(frags);
    case 'obsidian': return fragsToObsidian(frags);
    case 'siyuan': return fragsToSiyuan(frags);
    default: return fragsToPlainText(frags);
  }
}

// ============================================================
// 层级大纲格式生成器 (所有格式统一使用层级大纲布局)
// ============================================================

/** 层级大纲 - 无序列表 (文本) */
function toHierarchyList(tree: TreeNode[], opts: ExportOptions): string {
  let result = '';
  function walk(nodes: TreeNode[], depth: number) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = '    '.repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      // ★ 表格节点：作为整体输出，不加列表前缀
      if (isTableNode(node)) {
        // 表格前加空行分隔
        if (result && !result.endsWith('\n\n')) result += '\n';
        // 表格整体缩进（大纲模式下表格视为子层级整体）
        const tableLines = text.split('\n');
        for (const line of tableLines) {
          result += indent + line + '\n';
        }
        // 表格后加空行分隔
        result += '\n';
      } else {
        result += indent + '- ' + text + '\n';
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}

/** 层级大纲 - 有序列表 (文本) */
function toOrderedList(tree: TreeNode[], opts: ExportOptions): string {
  let result = '';
  function walk(nodes: TreeNode[], depth: number) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = '    '.repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      // ★ 表格节点：作为整体输出，不加列表前缀
      if (isTableNode(node)) {
        if (result && !result.endsWith('\n\n')) result += '\n';
        const tableLines = text.split('\n');
        for (const line of tableLines) {
          result += indent + line + '\n';
        }
        result += '\n';
      } else {
        result += indent + '1. ' + text + '\n';
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}

/** 层级大纲 - 任务列表 (文本) */
function toTaskList(tree: TreeNode[], opts: ExportOptions): string {
  let result = '';
  function walk(nodes: TreeNode[], depth: number) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = '    '.repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      // ★ 表格节点：作为整体输出，不加列表前缀
      if (isTableNode(node)) {
        if (result && !result.endsWith('\n\n')) result += '\n';
        const tableLines = text.split('\n');
        for (const line of tableLines) {
          result += indent + line + '\n';
        }
        result += '\n';
      } else {
        result += indent + '- [ ] ' + text + '\n';
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}

/** 层级大纲 - 树形结构 (├─ ─ 字符) */
function toHierarchyTree(tree: TreeNode[], opts: ExportOptions): string {
  let result = '';
  function renderNode(node: TreeNode, depth: number, isLast: boolean, prefix: string) {
    if (depth > opts.maxDepth) return;
    const connector = depth === 0 ? '' : (isLast ? '└─ ' : '├─ ');
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    // ★ 表格节点：作为整体输出，不加树形连接符
    if (isTableNode(node)) {
      const tableLines = text.split('\n');
      for (const line of tableLines) {
        result += prefix + connector + line + '\n';
      }
      const children = node.children;
      const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
      for (let i = 0; i < children.length; i++) {
        renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
      }
      return;
    }
    result += prefix + connector + text + '\n';
    const children = node.children;
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
    for (let i = 0; i < children.length; i++) {
      renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
    }
  }
  for (let i = 0; i < tree.length; i++) {
    renderNode(tree[i], 0, i === tree.length - 1, '');
  }
  return result.trim();
}

/** 层级大纲 - HTML (嵌套 ul/li)
 * ★ 表格节点：输出 <table> 标签，而非 <li>
 */
function toHierarchyHTML(tree: TreeNode[], opts: ExportOptions): string {
  let html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><title>Outline</title></head>\n<body>\n';
  function renderNode(node: TreeNode, depth: number) {
    if (depth > opts.maxDepth) return;
    const indent = '  '.repeat(depth + 1);
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    // ★ 表格节点：输出 <table> 而非 <li>
    if (isTableNode(node)) {
      const tableHTML = markdownTableToHTML(text);
      html += indent + tableHTML + '\n';
      // 表格的子节点（如有）继续渲染
      if (node.children.length > 0) {
        html += indent + '<ul>\n';
        for (const child of node.children) renderNode(child, depth + 1);
        html += indent + '</ul>\n';
      }
      return;
    }
    html += indent + '<li>' + text + '\n';
    if (node.children.length > 0) {
      html += indent + '  <ul>\n';
      for (const child of node.children) renderNode(child, depth + 1);
      html += indent + '  </ul>\n';
    }
    html += indent + '</li>\n';
  }
  html += '<ul>\n';
  for (const root of tree) renderNode(root, 0);
  html += '</ul>\n';
  html += '</body>\n</html>';
  return html;
}

/** 层级大纲 - JSON (树结构) */
function toHierarchyJSON(tree: TreeNode[], opts: ExportOptions): string {
  function toTree(nodes: TreeNode[], depth: number): any[] {
    if (depth > opts.maxDepth) return [];
    return nodes.map(n => ({
      content: fragsToText(n.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax),
      children: n.children.length > 0 ? toTree(n.children, depth + 1) : [],
    }));
  }
  return JSON.stringify({ outline: toTree(tree, 0) }, null, 2);
}

/** 层级大纲 - OPML (嵌套 outline) */
function toHierarchyOPML(tree: TreeNode[], opts: ExportOptions): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<opml version="2.0">\n<head><title>Converted Outline</title></head>\n<body>\n';
  function renderNode(node: TreeNode, depth: number) {
    if (depth > opts.maxDepth) return;
    const indent = '  '.repeat(depth + 1);
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    if (node.children.length > 0) {
      xml += indent + '<outline text="' + escapeXmlAttr(text) + '">\n';
      for (const child of node.children) renderNode(child, depth + 1);
      xml += indent + '</outline>\n';
    } else {
      xml += indent + '<outline text="' + escapeXmlAttr(text) + '"/>\n';
    }
  }
  for (const root of tree) renderNode(root, 0);
  xml += '</body>\n</opml>';
  return xml;
}

/** 层级大纲 - Markdown (嵌套列表，非 # 标题)
 * ★ 表格节点：顶格输出（无缩进、无列表前缀），保持标准 Markdown 表格语法
 */
function toHierarchyMarkdown(tree: TreeNode[], opts: ExportOptions): string {
  let result = '';
  function walk(nodes: TreeNode[], depth: number) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = '    '.repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      // ★ 表格节点：顶格输出，前后加空行分隔，确保 Markdown 解析器正确识别
      if (isTableNode(node)) {
        // 表格前加空行（如果前面有内容）
        if (result && !result.endsWith('\n\n')) result += '\n';
        result += text + '\n';
        // 表格后加空行
        result += '\n';
      } else {
        result += indent + '- ' + text + '\n';
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}

/** 层级大纲 - Word/DOC (嵌套列表)
 * ★ 表格节点：输出 <table> 标签，而非 <p>
 */
function toHierarchyDOC(tree: TreeNode[], opts: ExportOptions): string {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">\n<head><meta charset="utf-8"><title>Document</title></head>\n<body>\n';
  function renderNode(node: TreeNode, depth: number) {
    if (depth > opts.maxDepth) return;
    const indent = '  '.repeat(depth);
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    // ★ 表格节点：输出 <table> 而非 <p>
    if (isTableNode(node)) {
      const tableHTML = markdownTableToHTML(text);
      html += indent + tableHTML + '\n';
      for (const child of node.children) renderNode(child, depth + 1);
      return;
    }
    html += indent + '<p style="margin-left:' + (depth * 20) + 'px;">' + text + '</p>\n';
    for (const child of node.children) renderNode(child, depth + 1);
  }
  for (const root of tree) renderNode(root, 0);
  html += '</body>\n</html>';
  return html;
}

/** 层级大纲 - 纯文本 (缩进) */
function toHierarchyTXT(tree: TreeNode[], opts: ExportOptions): string {
  let result = '';
  function renderNode(node: TreeNode, depth: number) {
    if (depth > opts.maxDepth) return;
    result += '  '.repeat(depth) + fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax) + '\n';
    for (const child of node.children) renderNode(child, depth + 1);
  }
  for (const root of tree) renderNode(root, 0);
  return result.trim();
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  extension: string;
}

export function exportTree(tree: TreeNode[], opts: ExportOptions): ExportResult {
  let content = '';

  switch (opts.format) {
    case 'outline':
      content = toHierarchyList(tree, opts);
      break;
    case 'ordered':
      content = toOrderedList(tree, opts);
      break;
    case 'tasklist':
      content = toTaskList(tree, opts);
      break;
    case 'hierarchy':
      content = toHierarchyTree(tree, opts);
      break;
    case 'markdown':
      content = toHierarchyMarkdown(tree, opts);
      break;
    case 'html':
      content = toHierarchyHTML(tree, opts);
      break;
    case 'json':
      content = toHierarchyJSON(tree, opts);
      break;
    case 'opml':
      content = toHierarchyOPML(tree, opts);
      break;
    case 'doc':
      content = toHierarchyDOC(tree, opts);
      break;
    case 'txt':
      content = toHierarchyTXT(tree, opts);
      break;
    default:
      content = toHierarchyList(tree, opts);
  }

  return {
    content,
    filename: opts.filename || 'orca-export',
    mimeType: MIME_MAP[opts.format] || 'text/plain',
    extension: EXT_MAP[opts.format] || 'txt',
  };
}

// ============================================================
// PREVIEW GENERATION (用于导出预览面板)
// ============================================================

/**
 * 生成导出预览 HTML (带高亮渲染)
 * - richText=true:
 *   - Orca 样式: 用基础 HTML 标签可视化高亮 (mark/span with style)
 *   - Logseq/Obsidian 样式: 用 <code> 显示目标语法
 * - richText=false: 纯文本
 */
export function renderExportPreview(
  tree: TreeNode[],
  opts: ExportOptions,
): string {
  if (tree.length === 0) {
    return '<span class="oie-preview-placeholder">无内容</span>';
  }

  // 列表/大纲类格式：统一渲染为无序列表预览
  const hierarchyFormats: ExportFormat[] = ['outline', 'ordered', 'tasklist', 'hierarchy', 'markdown', 'opml', 'txt', 'json'];
  if (hierarchyFormats.includes(opts.format)) {
    return renderHierarchyListPreview(tree, opts);
  }

  // HTML / DOC 格式：渲染为可视化预览 (高亮颜色可见)
  if (opts.format === 'html' || opts.format === 'doc') {
    return renderHtmlOrDocPreview(tree, opts);
  }

  // 默认: 显示代码
  const result = exportTree(tree, opts);
  return '<pre style="white-space:pre-wrap;font-family:monospace;margin:0;font-size:12px;">' +
    escapeHtmlSafe(result.content) + '</pre>';
}

/**
 * HTML/DOC 预览：直接用 fragsToBasicHTML 渲染每个片段，保证高亮颜色可见
 * 用内联 style 而非 class，兼容任何主题
 * HTML/Word 预览时，将 markdown 图片语法 ![](url) 转为 <img> 标签
 */
function renderHtmlOrDocPreview(tree: TreeNode[], opts: ExportOptions): string {
  let html = '<div style="padding:8px 0;line-height:1.9;font-size:13px;">';
  function renderNode(node: TreeNode, depth: number) {
    if (depth > opts.maxDepth) return;
    // ★ 表格节点：预览为 <table>
    if (isTableNode(node)) {
      const tableText = fragsToPlainText(node.fragments);
      html += `<div style="margin-left:${depth * 20}px;padding:3px 0;">${markdownTableToHTML(tableText)}</div>`;
      for (const child of node.children) renderNode(child, depth + 1);
      return;
    }
    let text = opts.richText
      ? fragsToBasicHTML(node.fragments)
      : escapeHtmlSafe(fragsToPlainText(node.fragments));
    // HTML/Word 预览时显示为图片
    text = convertMarkdownImagesToHTML(text);
    html += `<div style="margin-left:${depth * 20}px;padding:3px 0;">${text || '<span style="color:#aaa;">(空)</span>'}</div>`;
    for (const child of node.children) renderNode(child, depth + 1);
  }
  for (const root of tree) renderNode(root, 0);
  html += '</div>';
  return html;
}

/** 层级大纲 - 列表预览 HTML (带高亮渲染)
 *  - richText=true:
 *    - Orca 样式: 基础 HTML 标签可视化 (mark/span with style)
 *    - Logseq/Obsidian 样式: <code> 显示目标语法
 *  - richText=false: 显示纯文本
 */
function renderHierarchyListPreview(tree: TreeNode[], opts: ExportOptions): string {
  let html = '<ul style="margin:4px 0 4px 20px;">';
  function renderNode(node: TreeNode, depth: number) {
    if (depth > opts.maxDepth) return;
    // ★ 表格节点：预览为 <table>，而非 <li>
    if (isTableNode(node)) {
      const tableText = fragsToPlainText(node.fragments);
      html += '<li>' + markdownTableToHTML(tableText);
      const children = node.children;
      if (children.length > 0) {
        html += '<ul style="margin:2px 0 2px 20px;">';
        for (const child of children) renderNode(child, depth + 1);
        html += '</ul>';
      }
      html += '</li>';
      return;
    }
    const text = renderPreviewText(node.fragments, opts);
    html += '<li>' + text;
    const children = node.children;
    if (children.length > 0) {
      html += '<ul style="margin:2px 0 2px 20px;">';
      for (const child of children) renderNode(child, depth + 1);
      html += '</ul>';
    }
    html += '</li>';
  }
  for (const root of tree) renderNode(root, 0);
  html += '</ul>';
  return html;
}

/**
 * 渲染预览文本：富文本开启时统一使用可视化高亮
 * 所有样式（Orca/Logseq/Obsidian）都用 fragsToBasicHTML 渲染
 * 这样用户能一眼看到颜色效果，而不是原始语法
 */
function renderPreviewText(frags: ContentFragment[], opts: ExportOptions): string {
  if (!opts.richText) {
    return escapeHtmlSafe(fragsToPlainText(frags));
  }
  // 富文本：统一使用可视化高亮渲染（mark/span with style）
  return fragsToBasicHTML(frags);
}

/** 树形预览 HTML (带高亮渲染) */
export function renderTreePreview(tree: TreeNode[], opts: ExportOptions): string {
  let html = '<div style="font-family:monospace;line-height:1.9;font-size:13px;">';
  function renderNode(node: TreeNode, depth: number, isLast: boolean, prefix: string) {
    if (depth > opts.maxDepth) return;
    const connector = depth === 0 ? '' : (isLast ? '└─ ' : '├─ ');
    const text = renderPreviewText(node.fragments, opts);
    html += '<div style="white-space:pre-wrap;">' + escapeHtmlSafe(prefix) + connector + text + '</div>';
    const children = node.children;
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
    for (let i = 0; i < children.length; i++) {
      renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
    }
  }
  for (let i = 0; i < tree.length; i++) {
    renderNode(tree[i], 0, i === tree.length - 1, '');
  }
  html += '</div>';
  return html;
}

// ============================================================
// IMPORT PREVIEW (用于导入预览)
// ============================================================

/** 生成导入预览文本 */
/**
 * 生成导入预览文本 (带高亮渲染)
 * 直接用 fragsToPreviewHTML 渲染各片段，高亮语法转为可视化
 */
export function renderImportPreview(tree: TreeNode[], formatOption: string): string {
  if (tree.length === 0) return '';
  let html = '';
  const INDENT_PX = 24; // 每级缩进24px
  function walk(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      // 用可视化高亮渲染（Orca 风格），并将 Markdown 行内语法转为预览样式
      const text = fragsToPreviewHTML(node.fragments);
      const marginLeft = depth * INDENT_PX;
      let prefix = '';
      if (formatOption === 'unordered') prefix = '- ';
      else if (formatOption === 'ordered') prefix = '1. ';
      else if (formatOption === 'tasklist') prefix = '- [ ] ';
      else if (formatOption === 'hierarchy') prefix = '- ';
      html += `<div style="margin-left:${marginLeft}px;line-height:1.7;">${prefix}${text}</div>`;
      walk(node.children, depth + 1);
    }
  }
  // markdown格式用标题
  if (formatOption === 'markdown') {
    function walkMd(nodes: TreeNode[], depth: number) {
      for (const node of nodes) {
        const text = fragsToPreviewHTML(node.fragments);
        const level = Math.min(depth + 1, 6);
        html += `<div><h${level} style="margin:4px 0;font-size:${20 - depth * 2}px;">${text}</h${level}></div>`;
        walkMd(node.children, depth + 1);
      }
    }
    walkMd(tree, 0);
  } else {
    walk(tree, 0);
  }
  return html;
}

/** 树形导入预览 (├─ └─ 字符) - HTML 输出 */
export function renderImportTreePreview(tree: TreeNode[]): string {
  if (tree.length === 0) return '';
  let html = '';
  function renderNode(node: TreeNode, depth: number, isLast: boolean, prefix: string) {
    const connector = depth === 0 ? '' : (isLast ? '└─ ' : '├─ ');
    const text = fragsToPreviewHTML(node.fragments);
    html += `<div style="white-space:pre-wrap;font-family:monospace;line-height:1.7;">${escapeHtmlSafe(prefix)}${connector}${text}</div>`;
    const children = node.children;
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
    for (let i = 0; i < children.length; i++) {
      renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
    }
  }
  for (let i = 0; i < tree.length; i++) {
    renderNode(tree[i], 0, i === tree.length - 1, '');
  }
  return html;
}

/**
 * 导入代码视图：显示 Orca 原生高亮语法（含 HTML 标签），保持缩进层级
 * 用于"源码"标签页显示，用户看到的是高亮转化后的 Orca 原生格式
 * - 背景高亮: <span class="orca-inline bc bcc-red">text</span>
 * - 文字高亮: <span class="orca-inline fc fcc-red">text</span>
 * - 挖空: <span class="orca-inline h" data-type="t">text</span>
 */
export function renderImportCodeView(tree: TreeNode[], formatOption: string): string {
  if (tree.length === 0) return '';
  let result = '';
  const INDENT = '    ';
  function walk(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      const indent = INDENT.repeat(depth);
      // ★ 使用 fragsToOrcaHTML 显示高亮转化后的 Orca 原生语法（含颜色信息）
      const text = fragsToOrcaHTML(node.fragments);
      if (formatOption === 'unordered') result += indent + '- ' + text + '\n';
      else if (formatOption === 'ordered') result += indent + '1. ' + text + '\n';
      else if (formatOption === 'tasklist') result += indent + '- [ ] ' + text + '\n';
      else if (formatOption === 'hierarchy') {
        // 树形用专门的函数
        result += indent + '- ' + text + '\n';
      }
      else result += '#'.repeat(Math.min(depth + 1, 6)) + ' ' + text + '\n';
      walk(node.children, depth + 1);
    }
  }
  if (formatOption === 'hierarchy') {
    result = renderTreeCode(tree);
  } else {
    walk(tree, 0);
  }
  return result;
}

/** 树形代码视图（含 Orca 高亮语法） */
function renderTreeCode(tree: TreeNode[]): string {
  let result = '';
  function renderNode(node: TreeNode, depth: number, isLast: boolean, prefix: string) {
    const connector = depth === 0 ? '' : (isLast ? '└─ ' : '├─ ');
    // ★ 使用 fragsToOrcaHTML 显示高亮转化后的 Orca 原生语法
    const text = fragsToOrcaHTML(node.fragments);
    result += prefix + connector + text + '\n';
    const children = node.children;
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');
    for (let i = 0; i < children.length; i++) {
      renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
    }
  }
  for (let i = 0; i < tree.length; i++) {
    renderNode(tree[i], 0, i === tree.length - 1, '');
  }
  return result;
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtmlSafe(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
