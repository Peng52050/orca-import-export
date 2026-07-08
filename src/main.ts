import type { ContentFragment, Block, DbId, RowPanel, ViewPanel, CursorData } from './orca.d.ts';
import type { TreeNode } from './parser.ts';
import { exportTree } from './formatter.ts';
import {
  showImportDialog,
  showExportDialog,
  showContextMenu,
  createHeadbarButton,
  removeStyles,
  createProgressOverlay,
} from './ui/Dialog.tsx';
import { hasMarkdownImage } from './parser.ts';
import { detectHighlightSyntax, normalizeFrags, fragsToOrcaInsertFormat, type HighlightSource } from './highlight.ts';
import {
  loadSettings,
  saveSettings,
  registerSettings,
  getSettings,
  debugLog,
  infoLog,
  errorLog,
  removeVersionBadge,
  type ImportPosition,
  type ClozeSyntax,
} from './settings.ts';

let pluginName: string;
let capturedCursor: CursorData | null = null;

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function getCurrentCursor(): CursorData | null {
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) return null;
    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) return null;
    return (panel.viewState as any)?.cursor || null;
  } catch (e) {
    debugLog(pluginName, 'getCurrentCursor failed:', e);
    return null;
  }
}

function openImportDialog() {
  capturedCursor = getCurrentCursor();
  showImportDialog(async (tree, formatOption, clozeMode, clozeSyntax, preparedText, sourceFormat, convertHighlight) => {
    try {
      const settings = getSettings();
      const VALID_CLOZE_SYNTAX: ClozeSyntax[] = [
        'tortoise', 'bold', 'bold-italic', 'italic', 'quote',
        'cloze-idx-bracket', 'bracket', 'brace'
      ];
      const validSet = new Set<string>(VALID_CLOZE_SYNTAX);
      const validatedSyntax = clozeSyntax.filter((s): s is ClozeSyntax => validSet.has(s));
      const updated = { ...settings, clozeMode, clozeSyntax: validatedSyntax };
      await saveSettings(pluginName, updated);
    } catch (e) {
      debugLog(pluginName, 'Failed to persist cloze settings:', e);
    }
    orca.commands.invokeEditorCommand(
      `${pluginName}.doImport`,
      capturedCursor,
      tree,
      formatOption,
      clozeMode,
      clozeSyntax,
      preparedText,
      sourceFormat,
      convertHighlight,
    ).catch((err: unknown) => {
      errorLog(pluginName, '[onImport] doImport failed:', err);
      orca.notify('error', `导入执行失败: ${err instanceof Error ? err.message : String(err)}`);
    });
  });
}

// ============================================================
// PLUGIN LIFECYCLE
// ============================================================

export async function load(name: string) {
  pluginName = name;
  infoLog(pluginName, `load() called, name=${name}`);

  if (typeof orca === 'undefined') {
    errorLog(pluginName, 'Orca global not found, plugin cannot start');
    return;
  }

  await loadSettings(pluginName);
  await registerSettings(pluginName);

  orca.commands.registerCommand(
    `${pluginName}.importFile`,
    async () => {
      infoLog(pluginName, '[CMD] importFile triggered');
      try {
        openImportDialog();
      } catch (err) {
        errorLog(pluginName, '[CMD] importFile failed:', err);
        orca.notify('error', `打开导入对话框失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    '导入文件 (md/txt/OPML/JSON)',
  );

  orca.commands.registerEditorCommand(
    `${pluginName}.doImport`,
    async (editor, tree: TreeNode[], formatOption: string, clozeMode: boolean, clozeSyntax: string[], preparedText: string, sourceFormat: HighlightSource, convertHighlight: boolean = true) => {
      const cursor = editor?.[2] ?? null;
      debugLog(pluginName, `[doImport] tree=${tree?.length} textLen=${preparedText?.length ?? 0} src=${sourceFormat} cursor=${!!cursor} hl=${convertHighlight}`);
      if (!tree || !Array.isArray(tree) || tree.length === 0) {
        errorLog(pluginName, '[doImport] tree is null or empty, aborting');
        orca.notify('error', '导入内容为空，请检查文件格式');
        return;
      }
      try {
        await handleImport(tree, formatOption, clozeMode, clozeSyntax, cursor, preparedText, sourceFormat, convertHighlight);
      } catch (err) {
        errorLog(pluginName, '[doImport] handleImport failed:', err);
        orca.notify('error', `导入失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    () => {},
    { label: '执行导入', hasArgs: true },
  );

  orca.commands.registerCommand(
    `${pluginName}.exportFile`,
    async () => {
      debugLog(pluginName, '[CMD] exportFile triggered');
      try {
        handleExport();
      } catch (err) {
        errorLog(pluginName, '[CMD] exportFile failed:', err);
        orca.notify('error', `导出失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    '导出文件',
  );

  orca.commands.registerCommand(
    `${pluginName}.clearEmptyBlocks`,
    async () => {
      infoLog(pluginName, '[CMD] clearEmptyBlocks triggered');
      try {
        await handleClearEmptyBlocks();
      } catch (err) {
        errorLog(pluginName, '[CMD] clearEmptyBlocks failed:', err);
        orca.notify('error', `清除空块失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    '清除空块 (当前页面)',
  );

  orca.toolbar.registerToolbarButton(`${pluginName}.importBtn`, {
    icon: 'ti ti-upload',
    tooltip: '导入文件',
    command: `${pluginName}.importFile`,
  });
  orca.toolbar.registerToolbarButton(`${pluginName}.exportBtn`, {
    icon: 'ti ti-download',
    tooltip: '导出文件',
    command: `${pluginName}.exportFile`,
  });

  try {
    if (orca.headbar?.registerHeadbarButton) {
      orca.headbar.registerHeadbarButton(
        `${pluginName}.headbarBtn`,
        () => createHeadbarButton(
          () => openImportDialog(),
          () => handleExport(),
          () => handleClearEmptyBlocks(),
        ),
      );
    }
  } catch (err) {
    debugLog(pluginName, 'Headbar button registration failed:', err);
  }

  orca.slashCommands.registerSlashCommand(`${pluginName}/import`, {
    icon: 'ti ti-upload',
    group: 'Import/Export',
    title: '导入文件',
    command: `${pluginName}.importFile`,
  });
  orca.slashCommands.registerSlashCommand(`${pluginName}/export`, {
    icon: 'ti ti-download',
    group: 'Import/Export',
    title: '导出文件',
    command: `${pluginName}.exportFile`,
  });
  orca.slashCommands.registerSlashCommand(`${pluginName}/clear-empty`, {
    icon: 'ti ti-eraser',
    group: 'Import/Export',
    title: '清除当前页空块',
    command: `${pluginName}.clearEmptyBlocks`,
  });

  document.body.addEventListener('contextmenu', onContextMenu);
  infoLog(pluginName, 'Plugin load complete');
}

export async function unload() {
  if (typeof orca === 'undefined') return;

  orca.commands.unregisterCommand(`${pluginName}.importFile`);
  orca.commands.unregisterCommand(`${pluginName}.exportFile`);
  orca.commands.unregisterCommand(`${pluginName}.clearEmptyBlocks`);
  orca.commands.unregisterEditorCommand(`${pluginName}.doImport`);
  orca.toolbar.unregisterToolbarButton(`${pluginName}.importBtn`);
  orca.toolbar.unregisterToolbarButton(`${pluginName}.exportBtn`);
  try {
    if (orca.headbar?.unregisterHeadbarButton) {
      orca.headbar.unregisterHeadbarButton(`${pluginName}.headbarBtn`);
    }
  } catch (err) {
    // ignore
  }
  orca.slashCommands.unregisterSlashCommand(`${pluginName}/import`);
  orca.slashCommands.unregisterSlashCommand(`${pluginName}/export`);
  orca.slashCommands.unregisterSlashCommand(`${pluginName}/clear-empty`);

  document.body.removeEventListener('contextmenu', onContextMenu);
  removeStyles();
  removeVersionBadge();
  infoLog(pluginName, 'Plugin unloaded');
}

// ============================================================
// CONTEXT MENU HANDLER
// ============================================================

function onContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target) return;

  const blockEl = target.closest('.orca-block') as HTMLElement | null;
  const contentEl = target.closest('.orca-repr-main-content') as HTMLElement | null;

  if (!contentEl && !blockEl) return;

  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) return;

  let blockId: string | null = null;
  if (blockEl) {
    blockId = blockEl.dataset.id || null;
  }

  e.preventDefault();
  e.stopPropagation();

  capturedCursor = getCurrentCursor();
  showContextMenu(
    e.clientX,
    e.clientY,
    blockId,
    () => {
      openImportDialog();
    },
    () => handleExport(),
    () => handleClearEmptyBlocks(),
  );
}

// ============================================================
// IMAGE BLOCK HELPERS
// P1-6 改进：抽取 OrcaImageBlock 类型，集中 getImageUrl 兜底链
// ============================================================

/**
 * Orca 内部表示图片块的可能字段映射
 * 不同版本/不同块类型下，图片 URL 存储位置不统一
 * 注：refs 故意声明为 unknown[]，避免与 Orca 的 BlockRef[] 不兼容
 */
interface OrcaImageBlock {
  _repr?: {
    src?: string;
    url?: string;
    image?: string;
  };
  aliases?: unknown[];
  properties?: Array<{ name?: string; value?: unknown }>;
  refs?: unknown[];
}

const IMAGE_PROP_NAMES = new Set(['image', 'src', 'url']);
const IMAGE_REPR_FIELD_KEYS = ['src', 'url', 'image'] as const;

/** 安全获取 string 字段（统一空值判断） */
function getString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** P1-6: 集中兜底链，按优先级返回第一个有效 URL */
export function getImageUrl(block: Block | null | undefined): string | null {
  if (!block) return null;
  const b = block as OrcaImageBlock;

  // 1) _repr 字段（Orca 图片块最常见）
  if (b._repr && typeof b._repr === 'object') {
    for (const key of IMAGE_REPR_FIELD_KEYS) {
      const url = getString((b._repr as any)[key]);
      if (url) return url;
    }
  }

  // 2) aliases 中的 image:: 语法
  if (Array.isArray(b.aliases)) {
    for (const alias of b.aliases) {
      if (typeof alias === 'string') {
        const match = alias.match(/^image::?\s*(\S+)/);
        const url = match && match[1] ? getString(match[1]) : null;
        if (url) return url;
      }
    }
  }

  // 3) properties 字段（Orca 数据可能挂在 _repr 属性上）
  if (Array.isArray(b.properties)) {
    for (const prop of b.properties) {
      if (!prop) continue;
      if (prop.name === '_repr' && prop.value && typeof prop.value === 'object') {
        for (const key of IMAGE_REPR_FIELD_KEYS) {
          const url = getString((prop.value as any)[key]);
          if (url) return url;
        }
      }
      if (typeof prop.name === 'string' && IMAGE_PROP_NAMES.has(prop.name)) {
        const url = getString(prop.value);
        if (url) return url;
      }
    }
  }

  // 4) refs 中的 image 引用
  if (Array.isArray(b.refs)) {
    for (const ref of b.refs) {
      if (ref && (ref as any).type === 'image') {
        const url = getString((ref as any).src) || getString((ref as any).url);
        if (url) return url;
      }
    }
  }

  return null;
}

/**
 * P1-6: 集中兜底链 — 返回块中**所有**可能的图片 URL（用于批量导出/校验）
 * 注意：去重 + 保持顺序
 */
export function extractImageUrls(block: Block | null | undefined): string[] {
  if (!block) return [];
  const b = block as OrcaImageBlock;
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: unknown) => {
    const url = getString(raw);
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };

  if (b._repr && typeof b._repr === 'object') {
    for (const key of IMAGE_REPR_FIELD_KEYS) push((b._repr as any)[key]);
  }
  if (Array.isArray(b.aliases)) {
    for (const alias of b.aliases) {
      if (typeof alias === 'string') {
        const m = alias.match(/^image::?\s*(\S+)/);
        if (m && m[1]) push(m[1]);
      }
    }
  }
  if (Array.isArray(b.properties)) {
    for (const prop of b.properties) {
      if (!prop) continue;
      if (prop.name === '_repr' && prop.value && typeof prop.value === 'object') {
        for (const key of IMAGE_REPR_FIELD_KEYS) push((prop.value as any)[key]);
      }
      if (typeof prop.name === 'string' && IMAGE_PROP_NAMES.has(prop.name)) push(prop.value);
    }
  }
  if (Array.isArray(b.refs)) {
    for (const ref of b.refs) {
      if (ref && (ref as any).type === 'image') {
        push((ref as any).src);
        push((ref as any).url);
      }
    }
  }
  return out;
}

/** 将树节点的 fragments 降级为纯文本（去除高亮/挖空/加粗等富文本信息） */
function stripHighlightFromNode(node: TreeNode): TreeNode {
  const plainText = node.fragments.map(f => String(f.v ?? '')).join('');
  return {
    ...node,
    fragments: [{ t: 't', v: plainText }],
    children: node.children.map(child => stripHighlightFromNode(child)),
  };
}

// ============================================================
// PROGRESS OVERLAY (进度浮层)
// ============================================================

/** 递归计算树的总节点数 */
function countTreeNodes(tree: TreeNode[]): number {
  let count = 0;
  for (const node of tree) {
    count++;
    count += countTreeNodes(node.children);
  }
  return count;
}

// ============================================================
// IMPORT PURE FUNCTIONS
// 不依赖 handleImport 上下文，可在模块级复用
// ============================================================

const allPlainText = (frags: ContentFragment[]): boolean => frags.length > 0 && frags.every(f => f.t === 't');

/** 检测 fragments 中是否包含需要 Orca 原生解析的 Markdown 图片 */
const containsMarkdownImage = (frags: ContentFragment[]): boolean => {
  return frags.some(f => f.t === 't' && typeof f.v === 'string' && hasMarkdownImage(f.v));
};

/** 将结构化 fragments 还原为 Orca 可解析的 Markdown 文本（用于 batchInsertText） */
function fragsToOrcaMarkdown(frags: ContentFragment[]): string {
  return frags.map(f => {
    if (f.t === 't') {
      const v = String(f.v ?? '');
      if (f.fa?.bold && f.fa?.italic) return `***${v}***`;
      if (f.fa?.bold) return `**${v}**`;
      if (f.fa?.italic) return `*${v}*`;
      if (f.fa?.strikethrough) return `~~${v}~~`;
      return v;
    }
    if (f.t === 'bc' || f.t === 'fc' || f.t === 'h') return `==${f.v}==`;
    if (f.t === 'a') {
      const text = (f.children?.map((c: any) => String(c.v ?? '')).join('')) || '';
      if ((f.fa as any)?.img) return `![${text}](${f.v})`;
      return `[${text}](${f.v})`;
    }
    if (f.t === 'c') return `\`${f.v}\``;
    return String(f.v ?? '');
  }).join('');
};

function parseInlineMarkdownLite(text: string): ContentFragment[] {
  // 使用简单正则，保持图片/链接/代码为 Markdown 原文（与 v2.0.0 一致）
  const frags: ContentFragment[] = [];
  const regex = /(!\[[^\]*\]\([^)]+\))|(\[[^\]*\]\([^)]+\))|(`[^`]+`)|(\*{3}([\s\S]*?)\*{3})|(\*\*([\s\S]*?)\*\*)|(\*([\s\S]*?)\*)|(~~([\s\S]*?)~~)|(==([\s\S]*?)==)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) frags.push({ t: 't', v: text.slice(lastIndex, match.index) });
    const fm = match[0];
    if (match[1]) frags.push({ t: 't', v: fm }); // 图片
    else if (match[2]) frags.push({ t: 't', v: fm }); // 链接
    else if (match[3]) frags.push({ t: 't', v: fm }); // 代码
    else if (match[4]) frags.push({ t: 't', v: match[5] ?? '', f: 'b', fa: { bold: true, italic: true } });
    else if (match[6]) frags.push({ t: 't', v: match[7] ?? '', f: 'b', fa: { bold: true } });
    else if (match[8]) frags.push({ t: 't', v: match[9] ?? '', f: 'b', fa: { italic: true } });
    else if (match[10]) frags.push({ t: 't', v: match[11] ?? '', f: 'b', fa: { strikethrough: true } });
    else if (match[12]) frags.push({ t: 'h', v: match[13] ?? '' });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) frags.push({ t: 't', v: text.slice(lastIndex) });
  return frags.length > 0 ? frags : [{ t: 't', v: text }];
};

const parseInlineMarkdownInFrags = (frags: ContentFragment[]): ContentFragment[] => {
  const result: ContentFragment[] = [];
  for (const frag of frags) {
    if (frag.t === 't' && typeof frag.v === 'string') {
      result.push(...parseInlineMarkdownLite(frag.v));
    } else {
      result.push(frag);
    }
  }
  return result;
};

const convertSyntaxToCloze = (text: string, syntax: string): string => {
  let result = text;
  switch (syntax) {
    case 'tortoise':
      result = result.replace(/\u3016([\s\S]+?)\u3017/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
    case 'bold':
      result = result.replace(/\*\*([\s\S]+?)\*\*(?!\*)/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
    case 'bold-italic':
      result = result.replace(/\*{3}([\s\S]+?)\*{3}/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
    case 'italic':
      result = result.replace(/\*([\s\S]+?)\*(?!\*)/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
    case 'quote':
      result = result.replace(/"([\s\S]*?)"|([\u201c\u300c\u300e\u00ab])([\s\S]*?)([\u201d\u300d\u300f\u00bb])/g,
        (_, en, openCn, t, _closeCn) => `\x01HL:cloze\x02${en || t}\x03`);
      break;
    case 'cloze-idx-bracket':
      result = result.replace(/\[\[c\d+::([\s\S]*?)\]\]/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
    case 'bracket':
      result = result.replace(/\[\[([\s\S]*?)\]\]/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
    case 'brace':
      result = result.replace(/\{\{([\s\S]*?)\}\}/g, (_, t) => `\x01HL:cloze\x02${t}\x03`);
      break;
  }
  return result;
};

const parseClozeMarkers = (text: string): ContentFragment[] => {
  const frags: ContentFragment[] = [];
  const regex = /(!\[[^\]*\]\([^)]+\))|(\[[^\]*\]\([^)]+\))|(`[^`]+`)|(\*{3}([\s\S]*?)\*{3})|(\*\*([\s\S]*?)\*\*)|(\*([\s\S]*?)\*)|(~~([\s\S]*?)~~)|(==([\s\S]*?)==)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) frags.push({ t: 't', v: text.slice(lastIndex, m.index) });
    frags.push({ t: 'h', v: m[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) frags.push({ t: 't', v: text.slice(lastIndex) });
  return frags.length > 0 ? frags : [{ t: 't', v: text }];
};

function convertClozeSyntaxInFrags(frags: ContentFragment[], syntaxes: string[]): ContentFragment[] {
  const result: ContentFragment[] = [];
  for (const frag of frags) {
    if (frag.t === 't' && typeof frag.v === 'string') {
      let converted = frag.v;
      for (const syntax of syntaxes) {
        converted = convertSyntaxToCloze(converted, syntax);
      }
      if (converted !== frag.v) {
        const parsed = parseClozeMarkers(converted);
        for (const pf of parsed) {
          if (pf.t === 'h') {
            result.push(pf);
          } else if (pf.t === 't' && typeof pf.v === 'string') {
            result.push(...parseInlineMarkdownLite(pf.v));
          } else {
            result.push(pf);
          }
        }
      } else {
        result.push(...parseInlineMarkdownLite(frag.v));
      }
    } else {
      result.push(frag);
    }
  }
  return result;
};

// ============================================================
// IMPORT CONTEXT
// 封装导入状态与操作方法，替代 handleImport 内部闭包
// ============================================================

class ImportContext {
  cursor: CursorData | null;
  progress: ReturnType<typeof createProgressOverlay>;
  allInserted: Array<{ id: any; fragments: ContentFragment[] }>;
  importedCount: number;
  totalNodes: number;
  clozeMode: boolean;
  clozeSyntax: string[];
  pluginName: string;

  constructor(
    cursor: CursorData | null,
    progress: ReturnType<typeof createProgressOverlay>,
    totalNodes: number,
    clozeMode: boolean,
    clozeSyntax: string[],
    pluginName: string,
  ) {
    this.cursor = cursor;
    this.progress = progress;
    this.allInserted = [];
    this.importedCount = 0;
    this.totalNodes = totalNodes;
    this.clozeMode = clozeMode;
    this.clozeSyntax = clozeSyntax;
    this.pluginName = pluginName;
  }

  getInserted() {
    return this.allInserted;
  }

  getImportedCount() {
    return this.importedCount;
  }

  // ============================================================
  // 方向1+2：自适应等待新块 + 内容前缀匹配
  // 替代 v2.4.0 的 delay(300) + slice(-5)，更快更可靠
  // ============================================================
  async waitForNewChildren(parentId: any, baselineCount: number, timeoutMs = 1500): Promise<any[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.progress.isCancelled()) return [];
      const parentBlock = orca.state.blocks[parentId];
      const children = parentBlock?.children || [];
      if (children.length > baselineCount) {
        return children.slice(baselineCount);
      }
      await delay(50);
    }
    return [];
  }

  /** 方向2：获取块内容前缀用于匹配 */
  getBlockTextPrefix(block: Block): string {
    const content = block?.content || block?._repr?.content || [];
    return content.map((f: any) => String(f.v || '')).join('').substring(0, 30).trim();
  }

  // ============================================================
  // insertBlock：position 'lastChild'，返回新块 ID
  // 方向4：移除未使用的 afterBlockId 参数
  // ============================================================
  async insertBlock(frags: ContentFragment[], parentId: any): Promise<any> {
    try {
      const freshParent = orca.state.blocks[parentId];
      if (!freshParent) {
        errorLog(this.pluginName, '[handleImport] insertBlock: parent not found');
        return null;
      }
      const orcaFrags = fragsToOrcaInsertFormat(frags);
      const result = await orca.commands.invokeEditorCommand(
        'core.editor.insertBlock', this.cursor, freshParent, 'lastChild', orcaFrags, { type: 'text' }
      );
      if (result == null) return null;
      if (typeof result === 'number') return result;
      if (typeof result === 'object' && result.id !== undefined) return result.id;
      const num = Number(result);
      if (!isNaN(num) && num > 0) return num;
      return null;
    } catch (e) {
      errorLog(this.pluginName, 'insertBlock failed:', e);
      return null;
    }
  }

  // ============================================================
  // insertViaBatch：自适应延迟 + 内容前缀匹配
  // 方向1：用轮询替代 delay(300)，平均 50ms 即可检测到新块
  // 方向2：用内容前缀匹配替代 slice(-5)，更精确
  // 方向4：移除未使用的 afterBlockId 参数
  // ============================================================
  async insertViaBatch(text: string, parentId: any): Promise<any> {
    try {
      const parentBlock = orca.state.blocks[parentId];
      if (!parentBlock) return null;
      const baselineCount = (parentBlock.children || []).length;

      await orca.commands.invokeEditorCommand(
        'core.editor.batchInsertText', this.cursor, parentBlock, 'lastChild', text
      );

      // 方向1：自适应等待，替代固定 delay(300)
      const newChildren = await this.waitForNewChildren(parentId, baselineCount);
      if (newChildren.length === 0) return null;

      // 方向2：内容前缀匹配，找到真正的新块
      const textPrefix = text.substring(0, 30).trim();
      if (textPrefix) {
        for (const id of newChildren) {
          const block = orca.state.blocks[id];
          if (block && this.getBlockTextPrefix(block) === textPrefix) {
            return id;
          }
        }
      }
      // 兜底：返回最后一个新块
      return newChildren[newChildren.length - 1];
    } catch (e) {
      errorLog(this.pluginName, '[handleImport] batchInsertText failed:', e);
      return null;
    }
  }

  // ============================================================
  // 方向1：同级纯文本批量插入
  // 将连续的纯文本叶子节点合并为一次 batchInsertText 调用（用 \n 分隔）
  // ============================================================
  async insertBatchSiblings(nodes: TreeNode[], parentId: any): Promise<boolean> {
    if (nodes.length <= 1) return false;
    try {
      const parentBlock = orca.state.blocks[parentId];
      if (!parentBlock) return false;
      const baselineCount = (parentBlock.children || []).length;

      const texts = nodes.map(n => n.fragments.map(f => String(f.v || '')).join(''));
      const combinedText = texts.join('\n');

      await orca.commands.invokeEditorCommand(
        'core.editor.batchInsertText', this.cursor, parentBlock, 'lastChild', combinedText
      );

      const newChildren = await this.waitForNewChildren(parentId, baselineCount);

      // 方向2：按顺序+内容前缀匹配
      let matched = 0;
      for (let j = 0; j < nodes.length && j < newChildren.length; j++) {
        const id = newChildren[j];
        const block = orca.state.blocks[id];
        const expected = texts[j].substring(0, 30).trim();
        const actual = block ? this.getBlockTextPrefix(block) : '';
        if (expected === actual) {
          this.allInserted.push({ id, fragments: nodes[j].fragments });
          this.importedCount++;
          this.progress.update(this.importedCount, this.totalNodes, `已导入 ${this.importedCount}/${this.totalNodes}`);
          matched++;
        } else {
          // 兜底：按顺序采纳，但记录告警
          debugLog(this.pluginName, `[batch] content mismatch at ${j}: expected "${expected}" got "${actual}"`);
          this.allInserted.push({ id, fragments: nodes[j].fragments });
          this.importedCount++;
          this.progress.update(this.importedCount, this.totalNodes, `已导入 ${this.importedCount}/${this.totalNodes}`);
          matched++;
        }
      }
      return matched === nodes.length;
    } catch (e) {
      errorLog(this.pluginName, '[handleImport] batch siblings failed:', e);
      return false;
    }
  }

  // ============================================================
  // 方向3：单节点插入，带 1 次重试
  // ============================================================
  async insertWithRetry(fn: () => Promise<any>, plainText: string): Promise<any> {
    let result = await fn();
    if (result == null && !this.progress.isCancelled()) {
      // 重试 1 次
      debugLog(this.pluginName, `[Import] retry: "${plainText.substring(0, 40)}"`);
      await delay(100);
      result = await fn();
    }
    return result;
  }

  // ============================================================
  // processNode：方向3 取消检查 + 方向3 失败重试 + 方向4 移除 afterBlockId
  // ============================================================
  async processNode(node: TreeNode, parentBlockId: any): Promise<any> {
    // 方向3：取消检查
    if (this.progress.isCancelled()) return null;

    const frags = node.fragments;
    const plainText = frags.map(f => String(f.v || '')).join('');
    let insertedId: any = null;

    if (allPlainText(frags)) {
      const textForInsert = plainText;
      let useBatchInsert = true;
      let insertFrags: ContentFragment[] | null = null;

      if (this.clozeMode) {
        const clozeFrags = convertClozeSyntaxInFrags(frags, this.clozeSyntax);
        if (clozeFrags.some(f => f.t === 'h')) {
          insertFrags = clozeFrags;
          useBatchInsert = false;
        }
      }

      if (useBatchInsert) {
        debugLog(this.pluginName, `[Import] batchInsert: "${textForInsert.substring(0, 40)}"`);
        insertedId = await this.insertWithRetry(() => this.insertViaBatch(textForInsert, parentBlockId), plainText);
      } else {
        debugLog(this.pluginName, `[Import] insertBlock (cloze): "${textForInsert.substring(0, 40)}"`);
        insertedId = await this.insertWithRetry(() => this.insertBlock(insertFrags!, parentBlockId), plainText);
      }
    } else {
      let insertFrags: ContentFragment[];
      if (this.clozeMode) {
        insertFrags = convertClozeSyntaxInFrags(frags, this.clozeSyntax);
      } else {
        insertFrags = parseInlineMarkdownInFrags(frags);
      }

      if (!this.clozeMode && containsMarkdownImage(insertFrags)) {
        const mdText = fragsToOrcaMarkdown(insertFrags);
        debugLog(this.pluginName, `[Import] batchInsert (rich text + image): "${mdText.substring(0, 40)}"`);
        insertedId = await this.insertWithRetry(() => this.insertViaBatch(mdText, parentBlockId), plainText);
      } else {
        insertedId = await this.insertWithRetry(() => this.insertBlock(insertFrags, parentBlockId), plainText);
      }
    }

    if (insertedId) {
      this.allInserted.push({ id: insertedId, fragments: node.fragments });
      this.importedCount++;
      this.progress.update(this.importedCount, this.totalNodes, `已导入 ${this.importedCount}/${this.totalNodes}`);
    }

    if (insertedId) {
      // 方向1：同级纯文本叶子节点批量插入
      const leafChildren: TreeNode[] = [];
      const nonLeafIndices: number[] = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childFrags = child.fragments;
        const isPlain = allPlainText(childFrags);
        const hasCloze = this.clozeMode && convertClozeSyntaxInFrags(childFrags, this.clozeSyntax).some(f => f.t === 'h');
        const hasChildren = child.children.length > 0;
        const hasImage = containsMarkdownImage(childFrags);

        if (isPlain && !hasCloze && !hasChildren && !hasImage) {
          leafChildren.push(child);
        } else {
          // 遇到非叶子节点，先处理已积累的叶子批次
          if (leafChildren.length > 0) {
            if (leafChildren.length === 1) {
              await this.processNode(leafChildren[0], insertedId);
            } else {
              const ok = await this.insertBatchSiblings(leafChildren, insertedId);
              if (!ok) {
                // 批量失败，逐个重试
                for (const n of leafChildren) {
                  if (this.progress.isCancelled()) break;
                  await this.processNode(n, insertedId);
                }
              }
            }
            leafChildren.length = 0;
          }
          nonLeafIndices.push(i);
        }
      }
      // 处理剩余的叶子批次
      if (leafChildren.length > 0) {
        if (leafChildren.length === 1) {
          await this.processNode(leafChildren[0], insertedId);
        } else {
          const ok = await this.insertBatchSiblings(leafChildren, insertedId);
          if (!ok) {
            for (const n of leafChildren) {
              if (this.progress.isCancelled()) break;
              await this.processNode(n, insertedId);
            }
          }
        }
      }
      // 处理非叶子节点
      for (const idx of nonLeafIndices) {
        if (this.progress.isCancelled()) break;
        await this.processNode(node.children[idx], insertedId);
      }
    } else {
      errorLog(this.pluginName, `[handleImport] skipped children of failed node: "${plainText.substring(0, 40)}"`);
    }
    return insertedId;
  }
}

// ============================================================
// IMPORT LOGIC
// v2.4.2：基于 v2.4.0 稳定基线，增加 4 个方向的优化：
//   方向1（速度）：自适应延迟替代 delay(300) + 同级纯文本批量插入
//   方向2（可靠性）：内容前缀匹配识别新块，替代 slice(-5) 启发式
//   方向3（体验）：进度浮层取消按钮 + 单节点失败重试 + 导入摘要
//   方向4（代码质量）：移除 processNode/insertViaBatch 中未使用的 afterBlockId 参数
// ============================================================

/** 防重入锁，防止用户通过快捷键/命令面板并发触发导入 */
let isImporting = false;

async function handleImport(tree: TreeNode[], formatOption: string, clozeMode: boolean, clozeSyntax: string[], cursor: CursorData | null, preparedText: string, sourceFormat: HighlightSource, convertHighlight: boolean = true) {
  if (isImporting) {
    orca.notify('warn', '导入正在进行中，请等待完成后再试', { title: '导入提示' });
    return;
  }
  isImporting = true;
  try {
    infoLog(pluginName, `[Import] start: roots=${tree.length} fmt=${formatOption} cloze=${clozeMode} src=${sourceFormat} hl=${convertHighlight}`);

    if (tree.length === 0) {
      orca.notify('warn', '没有可导入的内容', { title: '导入提示' });
      return;
    }

    // 不转换高亮时，将所有 fragments 降级为纯文本
    if (!convertHighlight) {
      tree = tree.map(node => stripHighlightFromNode(node));
    }

    const importTarget = getTargetBlock();
    if (!importTarget) {
      orca.notify('error', '无法找到导入位置。请在 Orca 中打开一个笔记页面后重试。', { title: '导入错误' });
      return;
    }

    const pageRootId = importTarget.parentBlock.id;
    const totalNodes = countTreeNodes(tree);

    const progress = createProgressOverlay('导入文件');
    progress.update(0, totalNodes, '正在导入...');
    // 方向3：启用取消按钮
    progress.setCancellable(true);

    const ctx = new ImportContext(cursor, progress, totalNodes, clozeMode, clozeSyntax, pluginName);
    for (const node of tree) {
      if (ctx.progress.isCancelled()) break;
      await ctx.processNode(node, pageRootId);
    }
    const importedCount = ctx.getImportedCount();
    const allInserted = ctx.getInserted();

    await delay(200);
    progress.close();

    // 方向3：导入摘要
    const failed = totalNodes - importedCount;
    const wasCancelled = progress.isCancelled();
    if (wasCancelled) {
      orca.notify('warn', `已取消导入：成功 ${importedCount}/${totalNodes}，跳过 ${failed} 个`, { title: '导入已取消' });
    } else if (importedCount === totalNodes) {
      const clozeNote = clozeMode ? '（含挖空处理）' : '';
      orca.notify('success', `导入成功，共 ${importedCount} 个块${clozeNote}`, { title: '导入完成' });
    } else if (importedCount > 0) {
      orca.notify('warn', `部分导入成功：${importedCount}/${totalNodes}，${failed} 个块失败`, { title: '导入提示' });
    } else {
      orca.notify('warn', '导入完成，但未检测到新增块', { title: '导入提示' });
    }
    infoLog(pluginName, `[Import] done: inserted=${importedCount}/${totalNodes} cancelled=${wasCancelled}`);
  } catch (err) {
    errorLog(pluginName, 'Import setup error:', err);
    orca.notify('error', `导入初始化失败: ${err instanceof Error ? err.message : String(err)}`, { title: '导入错误' });
  } finally {
    isImporting = false;
  }
}

interface ImportTarget {
  parentBlock: Block;
  position: 'lastChild' | 'after';
  afterSibling: Block | null;
}

function getTargetBlock(): ImportTarget | null {
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) {
      errorLog(pluginName, '[getTargetBlock] no activePanel');
      return null;
    }
    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) {
      errorLog(pluginName, `[getTargetBlock] no view panel for ${activePanelId}`);
      return null;
    }
    const rootId = panel.viewArgs?.blockId as DbId | undefined;
    if (rootId === undefined || !state.blocks[rootId]) {
      errorLog(pluginName, `[getTargetBlock] no root block ${rootId}`);
      return null;
    }
    const rootBlock = state.blocks[rootId];
    const settings = getSettings();
    const importPosition: ImportPosition = settings.importPosition || 'child';
    if (importPosition === 'child') {
      debugLog(pluginName, `[getTargetBlock] insert as child of ${rootId}`);
      return { parentBlock: rootBlock, position: 'lastChild', afterSibling: null };
    }
    const parentId = rootBlock.parent;
    if (parentId === null || parentId === undefined) {
      debugLog(pluginName, '[getTargetBlock] root has no parent, fallback to child');
      return { parentBlock: rootBlock, position: 'lastChild', afterSibling: null };
    }
    const parent = state.blocks[parentId];
    if (!parent) {
      errorLog(pluginName, `[getTargetBlock] parent ${parentId} not found`);
      return { parentBlock: rootBlock, position: 'lastChild', afterSibling: null };
    }
    // 安全校验：仅当 rootBlock 的父级是页面根（无 parent 或父级不在 state 中）时才允许作为同级兄弟插入
    // 否则导入块会出现在意料之外的层级
    const grandparentId = parent.parent;
    const isRootLevel = grandparentId === null || grandparentId === undefined || !state.blocks[grandparentId];
    if (!isRootLevel) {
      debugLog(pluginName, `[getTargetBlock] root ${rootId} is not at root level, fallback to child`);
      return { parentBlock: rootBlock, position: 'lastChild', afterSibling: null };
    }
    debugLog(pluginName, `[getTargetBlock] insert as sibling after ${rootId} in parent ${parentId}`);
    return { parentBlock: parent, position: 'after', afterSibling: rootBlock };
  } catch (e) {
    errorLog(pluginName, 'getTargetBlock error:', e);
    return null;
  }
}

// ============================================================
// EXPORT LOGIC
// ============================================================

function handleExport() {
  infoLog(pluginName, '[Export] start');
  const progress = createProgressOverlay('导出文件');
  progress.update(0, 1, '正在提取块...');
  // P0: 导出过程允许取消（extractBlocksFromPanel 不耗时，但保留扩展性）
  const abortSignal = progress.setCancellable(true);
  try {
    if (abortSignal.aborted) {
      progress.close();
      orca.notify('warn', '已取消导出', { title: '导出已取消' });
      return;
    }
    const { tree, blockCount, sourceFormat, rootName } = extractBlocksFromPanel();
    progress.update(1, 1, `已提取 ${blockCount} 个块`);
    infoLog(pluginName, `[Export] extracted: roots=${tree.length} blocks=${blockCount} src=${sourceFormat} name="${rootName}"`);
    if (tree.length === 0) {
      progress.close();
      orca.notify('warn', '当前页面没有可导出的内容', { title: '导出提示' });
      return;
    }
    if (abortSignal.aborted) {
      progress.close();
      orca.notify('warn', '已取消导出', { title: '导出已取消' });
      return;
    }
    setTimeout(() => {
      progress.close();
      showExportDialog(tree, blockCount, sourceFormat, rootName);
    }, 100);
  } catch (err) {
    progress.close();
    errorLog(pluginName, '[Export] error:', err);
    orca.notify('error', `导出失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function extractBlocksFromPanel(): { tree: TreeNode[]; blockCount: number; sourceFormat: HighlightSource; rootName: string } {
  debugLog(pluginName, '[Export] extractBlocksFromPanel start');
  const state = orca.state;
  const blocks = state.blocks;
  const totalBlocks = Object.keys(blocks).length;
  let rootBlockIds: DbId[] = [];
  let rootName = '';
  let viewPanel: ViewPanel | null = null;
  const activePanelId = state.activePanel;
  if (activePanelId) {
    viewPanel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (viewPanel) {
      const rootId = viewPanel.viewArgs?.blockId as DbId | undefined;
      if (rootId !== undefined && blocks[rootId]) {
        rootBlockIds = blocks[rootId].children || [];
      }
    }
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, '[Export] no root from active panel, trying all panels');
    const allPanels = findAllViewPanels(state.panels);
    for (const panel of allPanels) {
      const rootId = panel.viewArgs?.blockId as DbId | undefined;
      if (rootId !== undefined && blocks[rootId]) {
        rootBlockIds = blocks[rootId].children || [];
        viewPanel = panel;
        if (rootBlockIds.length > 0) break;
      }
    }
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, '[Export] trying DOM-based block detection');
    const blockEls = document.querySelectorAll('.orca-block[data-id]');
    const visibleBlockIds: DbId[] = [];
    const childSet = new Set<DbId>();
    for (const el of blockEls) {
      const idStr = (el as HTMLElement).dataset.id;
      if (!idStr) continue;
      const id = Number(idStr);
      if (!blocks[id]) continue;
      visibleBlockIds.push(id);
      const block = blocks[id];
      if (block.children) {
        for (const childId of block.children) {
          childSet.add(childId);
        }
      }
    }
    rootBlockIds = visibleBlockIds.filter(id => !childSet.has(id));
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, '[Export] trying parentless block detection');
    rootBlockIds = Object.keys(blocks).map(k => Number(k)).filter(id => {
      const block = blocks[id];
      return block && (block.parent === undefined || !blocks[block.parent]);
    });
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, '[Export] fallback to root-level blocks only');
    rootBlockIds = Object.keys(blocks).map(k => Number(k)).filter(id => {
      const block = blocks[id];
      return block && (block.parent === undefined || block.parent === null || !blocks[block.parent]);
    });
  }
  debugLog(pluginName, `[Export] total=${totalBlocks} roots=${rootBlockIds.length} first=[${rootBlockIds.slice(0, 5).join(',')}${rootBlockIds.length > 5 ? '...' : ''}]`);
  let blockCount = 0;
  let rawText = '';
  const tree: TreeNode[] = rootBlockIds
    .map(id => blockToTreeNode(id, blocks, 0, () => { blockCount++; }, (t: string) => { rawText += t + '\n'; }))
    .filter((n): n is TreeNode => n !== null);
  let sourceFormat: HighlightSource = 'orca';
  const hasOrcaFrags = checkHasOrcaHighlights(blocks, rootBlockIds);
  if (!hasOrcaFrags && rawText.trim()) {
    sourceFormat = detectHighlightSyntax(rawText);
  }
  if (tree.length > 0 && tree[0].text) {
    rootName = sanitizeFilename(tree[0].text);
  }
  return { tree, blockCount, sourceFormat, rootName };
}

function sanitizeFilename(name: string, maxLength = 60): string {
  let s = (name || '').trim();
  s = s.replace(/^#+\s*/, '');
  s = s.replace(/\*\*?([^*]+)\*\*?/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/[\\/:*?"<>|\r\n\t]/g, '_');
  if (s.length > maxLength) s = s.substring(0, maxLength).trim();
  return s || 'orca-export';
}

function findAllViewPanels(panels: RowPanel): ViewPanel[] {
  const result: ViewPanel[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.view !== undefined && typeof node.view === 'string') {
      result.push(node as ViewPanel);
      return;
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
  walk(panels);
  return result;
}

function checkHasOrcaHighlights(blocks: Record<string | DbId, Block>, rootIds: DbId[]): boolean {
  function checkBlock(id: DbId, visited: Set<DbId>): boolean {
    if (visited.has(id)) return false;
    visited.add(id);
    const block = blocks[id];
    if (!block) return false;
    if (block.content) {
      for (const frag of block.content) {
        if (frag.t === 'bc' || frag.t === 'fc' || frag.t === 'h') return true;
        if (frag.f === 'bc' || frag.f === 'fc' || frag.f === 'h') return true;
        if (frag.fa && (frag.fa.bc || frag.fa.fc || frag.fa.h || frag.fa.color || frag.fa.c)) return true;
      }
    }
    if (block.children) {
      for (const childId of block.children) {
        if (checkBlock(childId, visited)) return true;
      }
    }
    return false;
  }
  for (const id of rootIds) {
    if (checkBlock(id, new Set())) return true;
  }
  return false;
}

// ============================================================
// TABLE DETECTION HELPERS
// ============================================================

function extractTableMarkdown(block: Block): string | null {
  const b = block as any;
  const blockId = b.id ?? '?';

  // 方案1: 检测 Orca 表格的嵌套块结构
  // 结构: 表格根块(text="") → 列块(text="", N个) → 行块(text="", M个) → 单元格块(text="实际内容")
  if ((!b.text || b.text === '') &&
      (!b.content || !Array.isArray(b.content) || b.content.length === 0) &&
      Array.isArray(b.children) && b.children.length >= 1) {

    const blocks = (orca as any).state?.blocks;
    if (blocks) {
      // 检查是否为表格结构：所有子块都是"列"，每列下的子块是"行"，行下的子块是"单元格"
      const columns: string[][] = [];
      let rowCount = 0;
      let isTableStructure = true;

      for (const colId of b.children) {
        const colBlock = blocks[colId];
        if (!colBlock) { isTableStructure = false; break; }
        // 列块应该 text="" 且有子块
        if ((colBlock.text && colBlock.text !== '') ||
            (colBlock.content && Array.isArray(colBlock.content) && colBlock.content.length > 0) ||
            !Array.isArray(colBlock.children) || colBlock.children.length === 0) {
          isTableStructure = false; break;
        }

        // 提取该列的所有单元格文本
        const colCells: string[] = [];
        for (const rowId of colBlock.children) {
          const rowBlock = blocks[rowId];
          if (!rowBlock) { isTableStructure = false; break; }
          // 行块应该有子块（单元格）
          if (!Array.isArray(rowBlock.children) || rowBlock.children.length === 0) {
            // 行块本身可能是单元格（直接含文本）
            const cellText = rowBlock.text || (Array.isArray(rowBlock.content) ? rowBlock.content.map((f: any) => String(f.v ?? '')).join('') : '');
            if (cellText) {
              colCells.push(cellText.trim());
            } else {
              isTableStructure = false; break;
            }
          } else if (rowBlock.children.length === 1) {
            // 行块下有一个单元格块
            const cellBlock = blocks[rowBlock.children[0]];
            if (!cellBlock) { isTableStructure = false; break; }
            const cellText = cellBlock.text || (Array.isArray(cellBlock.content) ? cellBlock.content.map((f: any) => String(f.v ?? '')).join('') : '');
            colCells.push(cellText.trim());
          } else {
            isTableStructure = false; break;
          }
        }

        if (!isTableStructure) break;

        if (rowCount === 0) {
          rowCount = colCells.length;
        } else if (colCells.length !== rowCount) {
          isTableStructure = false; break;
        }
        columns.push(colCells);
      }

      // 验证：至少2列1行才认为是表格
      if (isTableStructure && columns.length >= 2 && rowCount >= 1) {
        // 构建 Markdown 表格（按行构建）
        const mdRows: string[] = [];
        for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
          const cells: string[] = [];
          for (let colIdx = 0; colIdx < columns.length; colIdx++) {
            const cellText = columns[colIdx][rowIdx] || '';
            cells.push(cellText.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim());
          }
          mdRows.push('| ' + cells.join(' | ') + ' |');
        }
        // 插入分隔行（在第一行之后）
        if (mdRows.length >= 1) {
          const colCount = columns.length;
          const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
          mdRows.splice(1, 0, sep);
        }
        debugLog(pluginName, `[Export] table nested: ${columns.length}×${rowCount} (block=${blockId})`);
        return mdRows.join('\n');
      }
    }
  }

  // 方案2: 从 block.content fragments 拼接后检测 Markdown 表格
  if (Array.isArray(b.content) && b.content.length > 0) {
    const fragText = b.content.map((f: any) => String(f.v ?? '')).join('');
    if (fragText) {
      const lines = fragText.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
      if (lines.length >= 2 && lines[0].includes('|') && /^\|?[\s:|-]+\|?$/.test(lines[1]) && lines[1].includes('-')) {
        debugLog(pluginName, `[Export] table content (block=${blockId})`);
        return fragText;
      }
    }
  }

  // 方案3: 从 block.text 提取 Markdown 表格
  const text = b.text || '';
  if (text) {
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
    if (lines.length >= 2 && lines[0].includes('|') && /^\|?[\s:|-]+\|?$/.test(lines[1]) && lines[1].includes('-')) {
      debugLog(pluginName, `[Export] table text (block=${blockId})`);
      return text;
    }
  }

  // 方案4: 从 _repr 提取表格（Orca 原生表格块，未来可能支持）
  const repr = b._repr;
  if (repr && typeof repr === 'object') {
    let rows: any[] | null = null;
    if (Array.isArray(repr.rows)) rows = repr.rows;
    else if (repr.data && Array.isArray(repr.data.rows)) rows = repr.data.rows;
    else if (Array.isArray(repr)) rows = repr;
    else if (Array.isArray(repr.cells) && repr.cells.length > 0 && Array.isArray(repr.cells[0])) rows = repr.cells;
    else if (Array.isArray(repr.matrix)) rows = repr.matrix;

    if (rows && rows.length > 0) {
      const mdRows: string[] = [];
      let colCount = 0;
      for (const row of rows) {
        if (!Array.isArray(row)) break;
        colCount = Math.max(colCount, row.length);
        const cells = row.map((cell: any) => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'object' && cell !== null) {
            if (Array.isArray(cell.fragments)) {
              return cell.fragments.map((f: any) => String(f.v ?? '')).join('')
                .replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
            }
            if (typeof cell.text === 'string') return cell.text.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
            if (typeof cell.v === 'string') return cell.v.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
            return JSON.stringify(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
          }
          return String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
        });
        mdRows.push('| ' + cells.join(' | ') + ' |');
      }
      if (colCount > 0 && mdRows.length >= 1) {
        const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
        mdRows.splice(1, 0, sep);
        debugLog(pluginName, `[Export] table _repr: ${colCount}×${rows.length} (block=${blockId})`);
        return mdRows.join('\n');
      }
    }
  }

  return null;
}

function blockToTreeNode(
  blockId: DbId,
  blocks: Record<string | DbId, Block>,
  level: number,
  countFn: () => void,
  textCollector: (text: string) => void,
): TreeNode | null {
  const block = blocks[blockId];
  if (!block) return null;
  countFn();

  const tableMd = extractTableMarkdown(block);
  if (tableMd !== null) {
    const fragments: ContentFragment[] = [{ t: 't', v: tableMd }];
    textCollector(tableMd);
    // 表格的子块是表格结构的一部分（列/行/单元格），已被合并为 Markdown 表格文本
    // 不再递归子块，避免重复输出单元格内容
    return { text: tableMd, fragments, children: [], level, idx: 0 };
  }

  let fragments: ContentFragment[];
  if (block.content && Array.isArray(block.content) && block.content.length > 0) {
    fragments = normalizeFrags(block.content as ContentFragment[]);
  } else if (block.text) {
    fragments = [{ t: 't', v: block.text }];
  } else {
    const imageUrl = getImageUrl(block);
    if (imageUrl) {
      fragments = [{ t: 't', v: `![](${imageUrl})` }];
    } else {
      fragments = [{ t: 't', v: '' }];
    }
  }

  const extraImageUrl = getImageUrl(block);
  if (extraImageUrl && !fragments.some(f => f.v && /!\[.*\]\(.*\)/.test(String(f.v)))) {
    fragments = [...fragments, { t: 't', v: `![](${extraImageUrl})` }];
  }

  const text = fragments.map(f => String(f.v)).join('');
  textCollector(text);

  const children: TreeNode[] = (block.children || [])
    .map(childId => blockToTreeNode(childId, blocks, level + 1, countFn, textCollector))
    .filter((n): n is TreeNode => n !== null);

  return { text, fragments, children, level, idx: 0 };
}

async function removeOrcaBlock(blockId: DbId): Promise<boolean> {
  if (typeof orca === 'undefined') return false;
  try {
    await orca.invokeBackend('remove-block', blockId);
    return true;
  } catch (_e1) {}
  try {
    await orca.invokeBackend('delete-block', blockId);
    return true;
  } catch (_e2) {}
  try {
    await orca.commands.invokeEditorCommand('core.editor.removeBlock', null, blockId);
    return true;
  } catch (_e3) {}
  try {
    const block = orca.state.blocks[blockId];
    if (!block) return true;
    const parentId = block.parent;
    if (parentId !== undefined && parentId !== null) {
      const parent = orca.state.blocks[parentId];
      if (parent && Array.isArray(parent.children)) {
        const idx = parent.children.indexOf(blockId);
        if (idx >= 0) parent.children.splice(idx, 1);
      }
    }
    delete orca.state.blocks[blockId];
    return true;
  } catch (e) {
    errorLog(pluginName, `[removeOrcaBlock] All attempts failed for blockId=${blockId}:`, e);
    return false;
  }
}

function countNodes(tree: TreeNode[]): number {
  let count = 0;
  for (const node of tree) {
    count++;
    count += countNodes(node.children);
  }
  return count;
}

function isEmptyBlock(block: Block): boolean {
  if (!block) return false;
  if (Array.isArray(block.children) && block.children.length > 0) return false;
  if (Array.isArray(block.aliases) && block.aliases.length > 0) return false;
  if (Array.isArray(block.refs) && block.refs.length > 0) return false;
  if (Array.isArray(block.backRefs) && block.backRefs.length > 0) return false;
  if (Array.isArray(block.properties) && block.properties.length > 0) return false;
  const content = block.content || [];
  if (content.length === 0) return true;
  // 检查是否只含图片（无文本），此时不应视为空块
  let hasImage = false;
  let text = '';
  for (const f of content) {
    if (f.t === 'a' && f.fa?.img) {
      hasImage = true;
    } else if (typeof f.v === 'string') {
      text += f.v;
    } else if (f.v && typeof f.v === 'object' && f.v.text) {
      text += f.v.text;
    }
  }
  return text.trim() === '' && !hasImage;
}

function collectEmptyBlocks(parentId: DbId): DbId[] {
  const result: DbId[] = [];
  const parent = orca.state.blocks[parentId];
  if (!parent) return result;
  const children = [...(parent.children || [])] as DbId[];
  for (const childId of children) {
    result.push(...collectEmptyBlocks(childId));
  }
  const freshParent = orca.state.blocks[parentId];
  if (freshParent && Array.isArray(freshParent.children) && freshParent.children.length > 0) {
    return result;
  }
  if (parentId !== freshParent?.parent) {
    if (isEmptyBlock(freshParent || parent)) {
      result.push(parentId);
    }
  }
  return result;
}

async function handleClearEmptyBlocks() {
  infoLog(pluginName, '===== handleClearEmptyBlocks start =====');
  const state = orca.state;
  const activePanelId = state.activePanel;
  if (!activePanelId) {
    orca.notify('error', '无法找到活动面板', { title: '清除空块' });
    return;
  }
  const panel = orca.nav.findViewPanel(activePanelId, state.panels);
  if (!panel || !panel.viewArgs?.blockId) {
    orca.notify('error', '无法找到当前页面', { title: '清除空块' });
    return;
  }
  const rootBlockId = panel.viewArgs.blockId as DbId;
  infoLog(pluginName, `handleClearEmptyBlocks: root block = ${rootBlockId}`);
  const emptyBlockIds = collectEmptyBlocks(rootBlockId);
  infoLog(pluginName, `handleClearEmptyBlocks: found ${emptyBlockIds.length} empty blocks`);
  if (emptyBlockIds.length === 0) {
    orca.notify('info', '当前页面没有空块', { title: '清除空块' });
    return;
  }
  let removedCount = 0;
  for (const blockId of emptyBlockIds) {
    const success = await removeOrcaBlock(blockId);
    if (success) removedCount++;
  }
  orca.notify('success', `已清除 ${removedCount} 个空块`, { title: '清除空块' });
  infoLog(pluginName, `===== handleClearEmptyBlocks done: removed ${removedCount}/${emptyBlockIds.length} =====`);
}
