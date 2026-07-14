// ============================================================
// Orca Import/Export Plugin Settings
// 参考 orca-cn-typography 设置面板风格（标签+描述+控件）
// ============================================================

import type { PluginSettingsSchema } from './orca.d.ts';

/** 构建时由 vite.config.js 从 package.json 注入，无需手动同步 */
declare const __PLUGIN_VERSION__: string;
export const PLUGIN_VERSION: string = typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : '0.0.0';

// ============================================================
// SETTINGS TYPES
// ============================================================

export type ExportStylePref = 'logseq' | 'obsidian' | 'orca' | 'siyuan';
export type WordHighlightMode = 'traditional' | 'orcaNative';
export type ImportPosition = 'child' | 'after';
/** 挖空语法类型 — 每种语法映射为 Orca 原生挖空 (h) */
export type ClozeSyntax =
  | 'tortoise'       // 〖XX〗
  | 'bold'           // **XX**
  | 'bold-italic'    // ***XX***
  | 'italic'         // *XX*
  | 'quote'          // "XX" / 「XX」
  | 'cloze-idx-bracket'  // [[c1::XX]]
  | 'bracket'        // [[XX]]
  | 'brace';         // {{XX}}

export interface PluginSettings {
  /** 调试开关 - 开启后输出详细日志 */
  debug: boolean;
  /** 默认导出样式 */
  defaultExportStyle: ExportStylePref;
  /** 默认是否转换高亮语法 */
  defaultRichText: boolean;
  /** 默认最大深度 */
  defaultMaxDepth: number;
  /** Word 格式高亮标签模式 */
  wordHighlightMode: WordHighlightMode;
  /** 导入时插入位置 (child=子块 / after=兄弟) */
  importPosition: ImportPosition;
  /** 导入时是否启用挖空模式 (将指定语法转换为 Orca 挖空效果) */
  clozeMode: boolean;
  /** 挖空语法类型（多选数组，支持组合） */
  clozeSyntax: ClozeSyntax[];
  /** 导出时是否启用挖空模式 (将 Orca 挖空转换为指定语法) */
  exportClozeMode: boolean;
  /** 导出时挖空语法类型（多选数组，多选时嵌套组合） */
  exportClozeSyntax: ClozeSyntax[];
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

export const DEFAULT_SETTINGS: PluginSettings = {
  debug: false,
  defaultExportStyle: 'orca',
  defaultRichText: true,
  defaultMaxDepth: 6,
  wordHighlightMode: 'traditional',
  importPosition: 'child',
  clozeMode: true,
  clozeSyntax: ['bold'],
  exportClozeMode: false,
  exportClozeSyntax: ['bold'],
};

// ============================================================
// SETTINGS SCHEMA (用于 Orca Note 设置面板)
// 参考 orca-cn-typography 风格：label + description + 控件
// ============================================================

export const SETTINGS_SCHEMA: PluginSettingsSchema = {
  // 注意：版本号已从 schema 中移除，避免作为 string 字段被用户编辑。
  // 改为通过 patchPluginNameWithVersion() 在插件名旁边注入版本号胶囊展示。
  debug: {
    label: '调试开关',
    description: '开启后在 console 输出详细日志（导入步骤、光标状态、editor command 调用参数等）',
    type: 'boolean',
    defaultValue: DEFAULT_SETTINGS.debug,
  },
  defaultExportStyle: {
    label: '默认导出样式',
    description: '打开导出对话框时的默认样式：logseq / obsidian / Orca Note / SiYuan',
    type: 'singleChoice',
    defaultValue: DEFAULT_SETTINGS.defaultExportStyle,
    choices: [
      { label: 'Logseq 样式', value: 'logseq' },
      { label: 'Obsidian 样式', value: 'obsidian' },
      { label: 'Orca Note 样式', value: 'orca' },
      { label: 'SiYuan (思源) 样式', value: 'siyuan' },
    ],
  },
  defaultRichText: {
    label: '默认转换富文本语法',
    description: '打开导出对话框时，富文本语法转换复选框的默认状态',
    type: 'boolean',
    defaultValue: DEFAULT_SETTINGS.defaultRichText,
  },
  defaultMaxDepth: {
    label: '默认最大深度',
    description: '导出时的默认层级深度（H1-H6，建议范围 2-10）',
    type: 'number',
    defaultValue: DEFAULT_SETTINGS.defaultMaxDepth,
  },
  wordHighlightMode: {
    label: 'Word 标签模式',
    description: '导出 Word (.doc) 时使用的高亮标签：traditional = 传统 mark/span 标签（兼容性好）/ orcaNative = Orca Note 原生标签',
    type: 'singleChoice',
    defaultValue: DEFAULT_SETTINGS.wordHighlightMode,
    choices: [
      { label: '传统标签 (推荐)', value: 'traditional' },
      { label: 'Orca 原生标签', value: 'orcaNative' },
    ],
  },
  importPosition: {
    label: '导入插入位置',
    description: '导入内容到当前块的位置：child = 作为子块插入（推荐） / after = 作为同级兄弟插入',
    type: 'singleChoice',
    defaultValue: DEFAULT_SETTINGS.importPosition,
    choices: [
      { label: '子块 (推荐)', value: 'child' },
      { label: '同级兄弟', value: 'after' },
    ],
  },
  clozeMode: {
    label: '挖空模式',
    description: '导入时将指定语法转换为 Orca 挖空（遮挡）效果。注：高亮语法由富文本转换功能全权处理',
    type: 'boolean',
    defaultValue: DEFAULT_SETTINGS.clozeMode,
  },
  clozeSyntax: {
    label: '挖空语法',
    description: '导入时将哪些语法识别为挖空效果（可多选，支持组合）',
    type: 'multiChoices',
    defaultValue: DEFAULT_SETTINGS.clozeSyntax,
    choices: [
      { label: '〖内容〗', value: 'tortoise' },
      { label: '[[c1::xx]]', value: 'cloze-idx-bracket' },
      { label: '[[xx]]', value: 'bracket' },
      { label: '{{xx}}', value: 'brace' },
      { label: '**xx**', value: 'bold' },
      { label: '***xx***', value: 'bold-italic' },
      { label: '*xx*', value: 'italic' },
      { label: '"xx"', value: 'quote' },
    ],
  },
  exportClozeMode: {
    label: '导出挖空模式',
    description: '导出时将 Orca 挖空（遮挡）效果转换为指定语法。关闭时按各样式默认语法输出（如高亮）',
    type: 'boolean',
    defaultValue: DEFAULT_SETTINGS.exportClozeMode,
  },
  exportClozeSyntax: {
    label: '导出挖空语法',
    description: '导出时将 Orca 挖空转换为哪种语法（可多选，多选时按顺序嵌套组合）',
    type: 'multiChoices',
    defaultValue: DEFAULT_SETTINGS.exportClozeSyntax,
    choices: [
      { label: '〖内容〗', value: 'tortoise' },
      { label: '[[c1::xx]]', value: 'cloze-idx-bracket' },
      { label: '[[xx]]', value: 'bracket' },
      { label: '{{xx}}', value: 'brace' },
      { label: '**xx**', value: 'bold' },
      { label: '***xx***', value: 'bold-italic' },
      { label: '*xx*', value: 'italic' },
      { label: '"xx"', value: 'quote' },
    ],
  },
};

// ============================================================
// SETTINGS MANAGER
// ============================================================

let cachedSettings: PluginSettings | null = null;

/**
 * 加载插件设置 (从 Orca 仓库级配置)
 * 若未设置过则使用默认值
 */
export async function loadSettings(pluginName: string): Promise<PluginSettings> {
  try {
    // 先尝试从 Orca 设置面板读取各个独立 key
    const result: Partial<PluginSettings> = {};
    const allKeys: (keyof PluginSettings)[] = [
      'debug', 'defaultExportStyle', 'defaultRichText', 'defaultMaxDepth',
      'wordHighlightMode', 'importPosition', 'clozeMode', 'clozeSyntax',
      'exportClozeMode', 'exportClozeSyntax',
    ];
    for (const key of allKeys) {
      try {
        const val = await orca.plugins.getData(pluginName, `setting_${key}`);
        if (val !== undefined && val !== null) {
          // 类型转换
          if (key === 'debug' || key === 'defaultRichText' || key === 'clozeMode' || key === 'exportClozeMode') {
            (result as any)[key] = val === 'true' || val === true || val === '1' || val === 1;
          } else if (key === 'defaultMaxDepth') {
            (result as any)[key] = Number(val);
          } else if (key === 'clozeSyntax' || key === 'exportClozeSyntax') {
            // 多选数组，存储为逗号分隔字符串；兼容 val 已经是数组的旧数据
            if (Array.isArray(val)) {
              (result as any)[key] = val.filter(v => typeof v === 'string');
            } else if (typeof val === 'string' && val.includes(',')) {
              (result as any)[key] = val.split(',').filter(Boolean);
            } else if (typeof val === 'string' && val) {
              (result as any)[key] = [val];
            }
          } else {
            (result as any)[key] = val;
          }
        }
      } catch (_e) {
        // 忽略单个 key 读取失败
      }
    }
    cachedSettings = { ...DEFAULT_SETTINGS, ...result };
  } catch (err) {
    console.warn('[OIE] loadSettings failed, using defaults:', err);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  if (cachedSettings?.debug) {
    console.log('[OIE] Settings loaded:', cachedSettings);
  }
  return cachedSettings;
}

/**
 * 保存插件设置
 * 参考 Orca 官方文档：orca.plugins.setData(pluginName, key, value)
 * value 必须是基本类型（string/number/boolean），不接受复杂对象
 */
export async function saveSettings(pluginName: string, settings: PluginSettings): Promise<void> {
  cachedSettings = { ...settings };
  try {
    const keys: (keyof PluginSettings)[] = ['debug', 'defaultExportStyle', 'defaultRichText', 'defaultMaxDepth', 'wordHighlightMode', 'importPosition', 'clozeMode', 'clozeSyntax', 'exportClozeMode', 'exportClozeSyntax'];
    for (const key of keys) {
      const val = settings[key];
      if (val !== undefined && val !== null) {
        // 数组类型（clozeSyntax/exportClozeSyntax）转为逗号分隔字符串；值本身含逗号时拒绝保存，避免解析歧义
        const strVal = Array.isArray(val)
          ? val.filter(v => typeof v === 'string' && !v.includes(',')).join(',')
          : String(val);
        await orca.plugins.setData(pluginName, `setting_${key}`, strVal);
      }
    }
  } catch (err) {
    console.error('[OIE] saveSettings failed:', err);
  }
}

/**
 * 获取当前设置 (若未加载则返回默认值)
 */
export function getSettings(): PluginSettings {
  return cachedSettings || { ...DEFAULT_SETTINGS };
}

/**
 * 注册设置 schema 到 Orca Note
 * Orca 会自动渲染设置面板
 */
export async function registerSettings(pluginName: string): Promise<void> {
  try {
    if (orca.plugins?.setSettingsSchema) {
      await orca.plugins.setSettingsSchema(pluginName, SETTINGS_SCHEMA);
      console.log('[OIE] Settings schema registered');
    } else {
      console.warn('[OIE] setSettingsSchema API not available');
    }
  } catch (err) {
    console.warn('[OIE] registerSettings failed:', err);
  }
  // 注册完成后，向设置面板插件名旁边注入版本号胶囊
  // 延迟 300ms 给 Orca 渲染设置面板 DOM 的时间
  setTimeout(() => patchPluginNameWithVersion(pluginName), 300);
}

// ============================================================
// VERSION BADGE — 插件名旁边版本号胶囊（参照 orca-plugin-picgo）
// 取代将版本号作为可编辑 string 字段放入 schema
// ============================================================

const VERSION_BADGE_STYLE = `
.oie-version-pill-host {
  position: relative !important;
  display: inline-block !important;
}
.oie-version-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 999px;
  background: #3370ff;
  color: #fff;
  margin-left: 10px;
  vertical-align: middle;
  user-select: none;
  -webkit-user-select: none;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(51,112,255,0.25);
}
body[data-theme="dark"] .oie-version-pill,
body.dark .oie-version-pill,
body.theme-dark .oie-version-pill {
  background: #5b8ff9;
  box-shadow: 0 1px 3px rgba(91,143,249,0.25);
}
@media (prefers-color-scheme: dark) {
  .oie-version-pill { background: #5b8ff9; }
}
`;

let versionBadgeObserver: MutationObserver | null = null;
const OIE_VERSION_PATCHED = 'data-oie-version-patched';

/** 检查元素是否在侧边栏内（向上遍历 6 层祖先） */
function isInsideSidebar(el: HTMLElement | null): boolean {
  if (!el) return false;
  let depth = 0;
  let node: HTMLElement | null = el;
  while (node && depth < 6) {
    const cls = (node.className || '').toString().toLowerCase();
    if (/sidebar|side-bar|plugin-list|nav-panel|left-panel|nav-list/.test(cls)) return true;
    node = node.parentElement;
    depth++;
  }
  return false;
}

/**
 * 在设置面板中找到插件名称元素，在其旁边注入版本号胶囊
 * 三层渐进扫描：精确选择器 → 标题 fallback → 宽元素兜底
 * 全局最多只注入 1 个 badge
 */
export function patchPluginNameWithVersion(pluginName: string): void {
  if (typeof document === 'undefined') return;

  // 全局最多只注入 1 个：通过标记属性判断
  if (document.querySelector(`[${OIE_VERSION_PATCHED}]`)) return;

  // 注入胶囊样式
  if (!document.getElementById('oie-version-badge-style')) {
    const style = document.createElement('style');
    style.id = 'oie-version-badge-style';
    style.setAttribute('data-role', 'orca-import-export');
    style.textContent = VERSION_BADGE_STYLE;
    document.head.appendChild(style);
  }

  const tryPatch = (): boolean => {
    try {
      let target: HTMLElement | null = null;

      // ===== 第一层：精确选择器（带插件名过滤，避免命中通用类） =====
      const exactSelectors = [
        `.plugin-property-name[data-plugin-name="${pluginName}"]`,
        `.plugin-detail-name[data-plugin-name="${pluginName}"]`,
        `[data-plugin-name="${pluginName}"]`,
        `[data-plugin="${pluginName}"]`,
        `.plugin-name[data-id="${pluginName}"]`,
        `.settings-plugin-name`,
      ];
      for (const sel of exactSelectors) {
        const el = document.querySelector(sel);
        if (el && (el as HTMLElement).textContent?.includes(pluginName)) {
          target = el as HTMLElement;
          break;
        }
      }

      // ===== 第二层：标题类元素 fallback =====
      // 优先命中显示插件标题的元素（而不是任何包含插件名的开关 label）
      if (!target) {
        const headingSelectors = 'h1, h2, h3, h4, .title, .page-title, .plugin-title, .settings-title, .orca-plugin-title, .setting-header-title';
        const headings = document.querySelectorAll(headingSelectors);
        for (const h of headings) {
          const text = h.textContent?.trim() || '';
          // 精确匹配插件名，避免 "启用插件" 这类开关 label
          if (text === pluginName) {
            target = h as HTMLElement;
            break;
          }
        }
      }

      // ===== 第三层：宽元素兜底（宽度 ≥ 240px 的文本元素） =====
      if (!target) {
        const textEls = document.querySelectorAll('div, span, p, section, article, header');
        let best: HTMLElement | null = null;
        let bestW = 0;
        for (const el of textEls) {
          const text = el.textContent?.trim() || '';
          // 文本必须等于插件名，避免命中子元素拼接或开关 label
          if (text !== pluginName) continue;
          const rect = (el as HTMLElement).getBoundingClientRect?.();
          if (!rect || rect.width < 240) continue;
          // 排除侧边栏
          if (isInsideSidebar(el as HTMLElement)) continue;
          if (rect.width > bestW) {
            bestW = rect.width;
            best = el as HTMLElement;
          }
        }
        target = best;
      }

      if (!target || isInsideSidebar(target)) {
        debugLog(pluginName, 'version pill: target not found or inside sidebar');
        return false;
      }

      // 再次检查全局唯一（防止并发）
      if (document.querySelector(`[${OIE_VERSION_PATCHED}]`)) return true;

      // 标记目标元素已注入
      target.setAttribute(OIE_VERSION_PATCHED, 'true');

      // 给目标元素增加 host 样式，确保胶囊内联显示
      target.classList.add('oie-version-pill-host');

      // 插入版本胶囊
      const pill = document.createElement('span');
      pill.className = 'oie-version-pill';
      pill.textContent = `v${PLUGIN_VERSION}`;
      target.appendChild(pill);

      console.log('[OIE] version pill patched');
      return true;
    } catch (e) {
      // 静默失败，Observer 继续监听
      return false;
    }
  };

  if (tryPatch()) return;

  // 设置面板可能尚未渲染，使用 MutationObserver 监听
  if (versionBadgeObserver) {
    versionBadgeObserver.disconnect();
  }
  versionBadgeObserver = new MutationObserver(() => {
    if (tryPatch()) {
      versionBadgeObserver?.disconnect();
      versionBadgeObserver = null;
    }
  });
  versionBadgeObserver.observe(document.body, { childList: true, subtree: true });

  // 5s 诊断日志
  setTimeout(() => {
    if (!document.querySelector(`[${OIE_VERSION_PATCHED}]`)) {
      console.warn('[OIE] version pill: not patched after 5s');
    }
  }, 5000);

  // 30s 超时断开
  setTimeout(() => {
    if (versionBadgeObserver) {
      versionBadgeObserver.disconnect();
      versionBadgeObserver = null;
    }
  }, 30000);
}

/**
 * unload 时清理所有版本徽章资源
 * 由 main.ts unload() 调用
 */
export function removeVersionBadge(): void {
  if (versionBadgeObserver) {
    versionBadgeObserver.disconnect();
    versionBadgeObserver = null;
  }
  // 清理标记属性、host 类、胶囊元素
  document.querySelectorAll(`[${OIE_VERSION_PATCHED}]`).forEach(el => {
    el.removeAttribute(OIE_VERSION_PATCHED);
    el.classList.remove('oie-version-pill-host');
    const pill = el.querySelector('.oie-version-pill');
    if (pill) pill.remove();
  });
  // 兜底：清理所有可能残留的胶囊和 host 类
  document.querySelectorAll('.oie-version-pill').forEach(el => el.remove());
  document.querySelectorAll('.oie-version-pill-host').forEach(el => el.classList.remove('oie-version-pill-host'));
  document.getElementById('oie-version-badge-style')?.remove();
}

// ============================================================
// DEBUG LOGGING
// ============================================================

/**
 * 调试日志 - 仅在设置开启时输出
 */
export function debugLog(pluginName: string, ...args: any[]): void {
  const settings = getSettings();
  if (settings.debug) {
    console.log(`[${pluginName}][DEBUG]`, ...args);
  }
}

/**
 * 信息日志 - 仅在调试开关开启时输出（避免污染控制台）
 */
export function infoLog(pluginName: string, ...args: any[]): void {
  const settings = getSettings();
  if (settings.debug) {
    console.log(`[${pluginName}]`, ...args);
  }
}

/**
 * 错误日志 - 总是输出（错误必须可见）
 */
export function errorLog(pluginName: string, ...args: any[]): void {
  console.error(`[${pluginName}]`, ...args);
}
