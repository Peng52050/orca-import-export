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
  // 改为通过 injectVersionBadge() 在设置面板顶部以只读徽章形式展示（纯展示，不可编辑/复制）。
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
  // 注册完成后，向设置面板注入只读版本徽章
  // 延迟 300ms 给 Orca 渲染设置面板 DOM 的时间
  setTimeout(() => injectVersionBadge(pluginName), 300);
}

// ============================================================
// VERSION BADGE — 设置面板顶部只读版本徽章
// 取代将版本号作为可编辑 string 字段放入 schema
// ============================================================

const VERSION_BADGE_STYLE = `
.oie-version-badge {
  --oie-badge-primary: #3370ff;
  --oie-badge-text: #1a1a1a;
  --oie-badge-text-2: #4e5969;
  --oie-badge-version-bg: rgba(51,112,255,0.12);

  margin: 0 0 16px 0;
  color: var(--oie-badge-text);
  font-size: 13px;
  line-height: 1.5;
}
.oie-version-badge-name {
  font-weight: 600;
  margin-right: 6px;
}
.oie-version-badge-version {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--oie-badge-version-bg);
  color: var(--oie-badge-primary);
  font-weight: 700;
  user-select: none;
  -webkit-user-select: none;
}
.oie-version-badge-desc {
  font-size: 12px;
  color: var(--oie-badge-text-2);
  margin-top: 2px;
}
/* Orca 暗色主题 — 通过 body 属性检测，不依赖 prefers-color-scheme */
body[data-theme="dark"] .oie-version-badge,
body.dark .oie-version-badge,
body.theme-dark .oie-version-badge {
  --oie-badge-primary: #7aaaff;
  --oie-badge-text: #e8e8e8;
  --oie-badge-text-2: #9ca3af;
  --oie-badge-version-bg: rgba(74,140,255,0.18);
}
@media (prefers-color-scheme: dark) {
  .oie-version-badge {
    --oie-badge-primary: #7aaaff;
    --oie-badge-text: #e8e8e8;
    --oie-badge-text-2: #9ca3af;
    --oie-badge-version-bg: rgba(74,140,255,0.18);
  }
}
`;

let versionBadgeInjected = false;
let versionBadgeObserver: MutationObserver | null = null;

/**
 * 向 Orca 设置面板顶部注入只读版本徽章
 * 取代将版本号作为可编辑 string 字段放入 schema
 */
export function injectVersionBadge(pluginName: string): void {
  if (typeof document === 'undefined') return;

  // V-3 修复：每次调用先检查 DOM 是否真实存在徽章，不存在则重置状态
  if (versionBadgeInjected) {
    const existing = document.querySelector('.oie-version-badge');
    if (existing) return; // 确实存在，跳过
    // DOM 中已不存在（面板重渲染被移除），重置状态允许重新注入
    versionBadgeInjected = false;
  }

  // 注入样式
  if (!document.getElementById('oie-version-badge-style')) {
    const style = document.createElement('style');
    style.id = 'oie-version-badge-style';
    style.setAttribute('data-role', 'orca-import-export');
    style.textContent = VERSION_BADGE_STYLE;
    document.head.appendChild(style);
  }

  // v2.4.6+：定位到右侧设置内容区（最小包含设置字段的容器），避免注入左侧插件列表
  const findPanel = (): HTMLElement | null => {
    const settingsLabels = ['调试开关', '默认导出样式'];

    // 跳过已注入徽章的容器
    const existing = document.querySelector('.oie-version-badge');
    if (existing) {
      versionBadgeInjected = true;
      return null;
    }

    // 策略：在所有 div/section/form 中找出包含全部设置字段的最小容器（面积最小）
    // 最小容器 = 右侧设置内容区；整个模态框面积更大会被淘汰
    let bestCandidate: HTMLElement | null = null;
    let bestArea = Infinity;

    const allEls = document.querySelectorAll('div, section, form');
    for (const el of allEls) {
      const text = el.textContent || '';
      // 必须包含全部设置字段标签
      if (!settingsLabels.every(label => text.includes(label))) continue;
      // 不能是隐藏元素
      const rect = (el as HTMLElement).getBoundingClientRect?.();
      if (!rect || rect.width < 200 || rect.height < 80) continue;
      // 面积最小的候选者胜出
      const area = rect.width * rect.height;
      if (area < bestArea) {
        bestArea = area;
        bestCandidate = el as HTMLElement;
      }
    }

    return bestCandidate;
  };

  const tryInject = (): boolean => {
    try {
      const panel = findPanel();
      if (!panel) {
        debugLog(pluginName, 'version badge: panel not found yet');
        return false;
      }

      // 检查是否已注入
      if (panel.querySelector('.oie-version-badge')) {
        versionBadgeInjected = true;
        return true;
      }

      // 隐藏 Orca 原生插件标题（与我们的徽章重复）
      // 查找面板内包含插件名的 h1~h3 或首个文本匹配的标题元素
      const headings = panel.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const h of headings) {
        const text = h.textContent?.trim() || '';
        if (text === pluginName || text === 'orca-import-export') {
          (h as HTMLElement).style.display = 'none';
        }
      }

      const badge = document.createElement('div');
      badge.className = 'oie-version-badge';
      badge.innerHTML = `
        <div>
          <span class="oie-version-badge-name">orca-import-export</span>
          <span class="oie-version-badge-version">v${PLUGIN_VERSION}</span>
        </div>
        <div class="oie-version-badge-desc">让笔记迁移更简单</div>
      `;
      panel.insertBefore(badge, panel.firstChild);
      versionBadgeInjected = true;
      console.log('[OIE] version badge injected');

      return true;
    } catch (e) {
      // 面板被其他插件操作时可能抛 DOMException，静默失败让 Observer 继续监听
      return false;
    }
  };

  if (tryInject()) return;

  // 设置面板可能尚未渲染，使用 MutationObserver 监听
  // 成功注入后断开；30s 超时保底断开避免长期占用
  if (versionBadgeObserver) {
    versionBadgeObserver.disconnect();
  }
  versionBadgeObserver = new MutationObserver(() => {
    if (tryInject()) {
      versionBadgeObserver?.disconnect();
      versionBadgeObserver = null;
    }
  });
  versionBadgeObserver.observe(document.body, { childList: true, subtree: true });

  // 5s 后仍未注入，输出诊断日志帮助排查
  setTimeout(() => {
    if (!versionBadgeInjected) {
      console.warn('[OIE] version badge: not injected after 5s. Available settings panels:',
        Array.from(document.querySelectorAll('.orca-plugin-settings, .orca-settings-panel, [class*="plugin-settings"], [class*="settings-content"]'))
          .map(el => ({ className: el.className, text: (el.textContent || '').slice(0, 80) })));
    }
  }, 5000);

  setTimeout(() => {
    if (versionBadgeObserver) {
      versionBadgeObserver.disconnect();
      versionBadgeObserver = null;
    }
  }, 30000);
}

/**
 * V-5: unload 时清理版本徽章资源
 * 由 main.ts unload() 调用
 */
export function removeVersionBadge(): void {
  if (versionBadgeObserver) {
    versionBadgeObserver.disconnect();
    versionBadgeObserver = null;
  }
  versionBadgeInjected = false;
  document.getElementById('oie-version-badge-style')?.remove();
  document.querySelectorAll('.oie-version-badge').forEach(el => el.remove());
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
