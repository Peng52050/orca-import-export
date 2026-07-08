// ============================================================
// Orca Import/Export Dialog - 原生 DOM 实现（不依赖 React 渲染）
// HeadbarButton 仍用 window.React（由 Orca 渲染树渲染）
// ============================================================

import type { TreeNode, FileFormat } from '../parser.ts';
import { parseFile, detectFormat, getHighlightSource, preprocessForImport } from '../parser.ts';
import {
  FORMAT_OPTIONS,
  exportTree,
  renderExportPreview,
  renderImportPreview,
  renderImportTreePreview,
  renderImportCodeView,
  type ExportStyle,
  type ExportFormat,
  type ExportOptions,
} from '../formatter.ts';
import { type HighlightSource } from '../highlight.ts';
import { setAllBlocksFolded } from '../fold.ts';
import { getSettings, type ClozeSyntax } from '../settings.ts';

// ============================================================
// INLINE SVG ICONS (避免依赖 tabler-icons 字体)
// ============================================================

const ICONS = {
  upload: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  file: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  fileCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  eye: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  list: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  listNumbers: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
  markdown: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13l1.5 1.5L13 12"/><path d="M9 17l1.5-1.5L13 18"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  exchange: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  chevronUp: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  loader: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
  spinner: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
  checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
};

// ============================================================
// SHARED STYLES
// ============================================================

const DIALOG_STYLES = `
/* ============================================================
 * CSS 变量定义 - 自动适配深色/浅色主题
 * 通过 prefers-color-scheme 媒体查询处理 fallback 颜色
 * ============================================================ */
.oie-themed, .oie-themed * {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
  box-sizing: border-box !important;
}
.oie-themed {
  --oie-bg: #ffffff;
  --oie-bg-alt: #f7f8fa;
  --oie-bg-fill: #f2f3f5;
  --oie-bg-fill-hover: #e5e6eb;
  --oie-border: #e8e8e8;
  --oie-border-light: #f0f0f0;
  --oie-text: #1a1a1a;
  --oie-text-2: #4e5969;
  --oie-text-3: #86909c;
  --oie-primary: #3370ff;
  --oie-primary-light: #e8f3ff;
  --oie-success: #00b42a;
  --oie-shadow: 0 8px 32px rgba(0,0,0,0.2);
  color: var(--oie-text);
  font-size: 14px;
  line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  .oie-themed {
    --oie-bg: #1e1e1e;
    --oie-bg-alt: #252525;
    --oie-bg-fill: #2a2a2a;
    --oie-bg-fill-hover: #353535;
    --oie-border: #3a3a3a;
    --oie-border-light: #2f2f2f;
    --oie-text: #e8e8e8;
    --oie-text-2: #b0b0b0;
    --oie-text-3: #888888;
    --oie-primary: #4a8cff;
    --oie-primary-light: #1a2a4a;
    --oie-success: #2ea043;
    --oie-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
}
/* Orca 深色主题适配：检测 Orca body 的 dark class 或 data-theme 属性 */
body[data-theme="dark"] .oie-themed,
body.dark .oie-themed,
body.theme-dark .oie-themed {
    --oie-bg: #1e1e1e;
    --oie-bg-alt: #252525;
    --oie-bg-fill: #2a2a2a;
    --oie-bg-fill-hover: #353535;
    --oie-border: #3a3a3a;
    --oie-border-light: #2f2f2f;
    --oie-text: #e8e8e8;
    --oie-text-2: #b0b0b0;
    --oie-text-3: #888888;
    --oie-primary: #4a8cff;
    --oie-primary-light: #1a2a4a;
    --oie-success: #2ea043;
    --oie-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.oie-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  animation: oie-fade-in 0.15s ease;
  font-size: 14px;
}
@keyframes oie-fade-in { from { opacity: 0; } to { opacity: 1; } }

.oie-dialog {
  background: var(--oie-bg);
  color: var(--oie-text);
  border-radius: 12px;
  box-shadow: var(--oie-shadow);
  width: 640px; max-width: 92vw; max-height: 86vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: oie-slide-up 0.2s ease;
  font-size: 14px;
  line-height: 1.5;
}
@keyframes oie-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.oie-dialog-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--oie-border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--oie-bg);
}
.oie-dialog-title {
  font-size: 15px; font-weight: 600;
  color: var(--oie-text);
  display: flex; align-items: center; gap: 8px;
  line-height: 1.4;
}
.oie-dialog-title svg {
  color: var(--oie-primary);
  width: 18px; height: 18px;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
.oie-dialog-close {
  cursor: pointer;
  font-size: 14px;
  color: var(--oie-text-3);
  background: transparent;
  border: none;
  padding: 6px;
  line-height: 1;
  border-radius: 6px;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
}
.oie-dialog-close:hover {
  color: var(--oie-text);
  background: var(--oie-bg-fill);
}
.oie-dialog-close svg {
  width: 16px; height: 16px;
  display: block;
}

.oie-dialog-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
  color: var(--oie-text);
  font-size: 14px;
  line-height: 1.6;
}

.oie-dialog-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--oie-border);
  display: flex; justify-content: flex-end; gap: 8px;
  background: var(--oie-bg-alt);
  align-items: center;
}

.oie-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  display: inline-flex; align-items: center; gap: 6px;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
}
.oie-btn svg {
  width: 14px; height: 14px;
  display: inline-block;
  vertical-align: middle;
}
.oie-btn-primary {
  background: var(--oie-primary);
  color: #fff;
  border-color: var(--oie-primary);
}
.oie-btn-primary:hover { opacity: 0.88; }
.oie-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.oie-btn-secondary {
  background: var(--oie-bg);
  color: var(--oie-text);
  border-color: var(--oie-border);
}
.oie-btn-secondary:hover { background: var(--oie-bg-fill); border-color: var(--oie-text-3); }
.oie-btn-ghost {
  background: transparent;
  color: var(--oie-text-2);
  border-color: transparent;
}
.oie-btn-ghost:hover { background: var(--oie-bg-fill); color: var(--oie-text); }
.oie-btn-sm { padding: 4px 10px; font-size: 12px; }
.oie-btn-sm svg { width: 12px; height: 12px; }
.oie-btn-pulse {
  animation: oie-pulse 1.2s ease-in-out infinite;
}
@keyframes oie-pulse {
  0% { box-shadow: 0 0 0 0 rgba(51, 112, 255, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(51, 112, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(51, 112, 255, 0); }
}

.oie-section-label {
  font-size: 12px; font-weight: 600;
  color: var(--oie-text-2);
  margin: 14px 0 8px 0;
  display: flex; align-items: center; gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.oie-section-label:first-child { margin-top: 0; }
.oie-section-label svg {
  color: var(--oie-primary);
  width: 14px; height: 14px;
  flex-shrink: 0;
}
.oie-section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.oie-section-label-row > span:not(.oie-section-label-actions) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.oie-section-label-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.oie-option-group {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 12px;
}
.oie-option-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: 1.5px solid var(--oie-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--oie-bg);
}
.oie-option-card:hover { border-color: var(--oie-primary); }
.oie-option-card.selected {
  border-color: var(--oie-primary);
  background: var(--oie-primary-light);
}
.oie-option-icon {
  font-size: 16px; color: var(--oie-primary);
  width: 20px; text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.oie-option-icon svg { width: 16px; height: 16px; }
.oie-option-text { flex: 1; min-width: 0; }
.oie-option-label {
  font-size: 13px; font-weight: 500;
  color: var(--oie-text);
  line-height: 1.4;
}
.oie-option-desc {
  font-size: 11px;
  color: var(--oie-text-3);
  margin-top: 2px;
  line-height: 1.4;
}
.oie-radio {
  width: 16px; height: 16px;
  border: 2px solid var(--oie-border);
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.15s;
  position: relative;
}
.oie-option-card.selected .oie-radio {
  border-color: var(--oie-primary);
  background: var(--oie-primary);
}
.oie-option-card.selected .oie-radio::after {
  content: '';
  position: absolute;
  top: 3px; left: 3px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #fff;
}

.oie-file-drop {
  position: relative;
  border: 2px dashed var(--oie-border);
  border-radius: 12px;
  padding: 28px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  margin-bottom: 12px;
  background: var(--oie-bg);
  color: var(--oie-text);
  overflow: hidden;
}
.oie-file-drop:hover {
  border-color: var(--oie-primary);
  background: var(--oie-bg-alt);
}
/* P1-4: 拖放视觉反馈 - 渐变 + 光晕 + 图标弹跳 + 提示文字 */
.oie-file-drop.drag-over {
  border-color: var(--oie-primary);
  border-style: solid;
  background: linear-gradient(135deg, rgba(51,112,255,0.12) 0%, rgba(122,170,255,0.06) 100%);
  box-shadow:
    0 0 0 4px rgba(51,112,255,0.1),
    0 8px 24px rgba(51,112,255,0.15),
    inset 0 0 40px rgba(51,112,255,0.05);
  transform: scale(1.02);
  animation: oie-drop-pulse 1s ease-in-out infinite;
}
.oie-file-drop.drag-over .oie-file-drop-icon {
  color: var(--oie-primary);
  transform: scale(1.2) translateY(-4px);
}
.oie-file-drop.drag-over .oie-file-drop-text {
  color: var(--oie-primary);
  font-weight: 600;
}
@keyframes oie-drop-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(51,112,255,0.1), 0 8px 24px rgba(51,112,255,0.15); }
  50% { box-shadow: 0 0 0 8px rgba(51,112,255,0.06), 0 12px 32px rgba(51,112,255,0.25); }
}
.oie-file-drop-icon {
  font-size: 32px;
  color: var(--oie-text-3);
  margin-bottom: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.oie-file-drop-icon svg { width: 36px; height: 36px; }
.oie-file-drop.has-file .oie-file-drop-icon { color: var(--oie-success); }
.oie-file-drop-text {
  font-size: 13px;
  color: var(--oie-text-2);
  line-height: 1.5;
  word-break: break-all;
  transition: all 0.2s ease;
}
/* P1-4: 拖放中显示的提示文字 */
.oie-file-drop-hint-active {
  margin-top: 6px;
  font-size: 11px;
  color: var(--oie-primary);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  animation: oie-hint-blink 1s ease-in-out infinite;
}
@keyframes oie-hint-blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
/* P1-5: 预览骨架屏 */
.oie-preview-skeleton {
  padding: 12px 4px;
  display: flex; flex-direction: column; gap: 10px;
}
.oie-preview-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg,
    var(--oie-bg-fill) 0%,
    var(--oie-bg-fill-hover) 50%,
    var(--oie-bg-fill) 100%);
  background-size: 200% 100%;
  animation: oie-skeleton-shimmer 1.2s ease-in-out infinite;
}
.oie-preview-skeleton-line:nth-child(2) { animation-delay: 0.1s; }
.oie-preview-skeleton-line:nth-child(3) { animation-delay: 0.2s; }
@keyframes oie-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.oie-file-name {
  font-size: 14px; font-weight: 500;
  color: var(--oie-success);
}
.oie-format-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--oie-bg-fill);
  color: var(--oie-text-2);
  margin-left: 8px;
  letter-spacing: 0.5px;
}
.oie-info-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: var(--oie-primary-light);
  border-radius: 6px;
  font-size: 12px;
  color: var(--oie-text-2);
  margin-bottom: 12px;
  line-height: 1.5;
}
.oie-info-bar svg {
  color: var(--oie-primary);
  width: 14px; height: 14px;
  flex-shrink: 0;
}
.oie-config-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--oie-bg-alt);
  border: 1px solid var(--oie-border);
  border-radius: 6px;
}
@media (max-width: 520px) {
  .oie-config-bar {
    grid-template-columns: 1fr;
  }
  .oie-dialog {
    width: 100%;
    max-width: 96vw;
    border-radius: 8px;
  }
}
.oie-opt-group {
  display: flex; flex-direction: column; gap: 3px;
}
.oie-opt-group-inline {
  flex-direction: row; flex-wrap: wrap; align-items: center;
  gap: 6px 10px;
}
.oie-opt-group-inline > .oie-opt-label {
  margin-right: 4px;
}
.oie-opt-label {
  font-size: 10px; font-weight: 600;
  color: var(--oie-text-2);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.oie-select, .oie-input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--oie-border);
  border-radius: 4px;
  background: var(--oie-bg);
  color: var(--oie-text);
  font-size: 12px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}
.oie-select:focus, .oie-input:focus {
  border-color: var(--oie-primary);
}
.oie-select option {
  background: var(--oie-bg);
  color: var(--oie-text);
}
.oie-checkbox-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px;
  height: 28px;
  cursor: pointer;
  color: var(--oie-text);
}
.oie-checkbox-label input { cursor: pointer; accent-color: var(--oie-primary); }

.oie-cloze-syntax-group {
  display: flex; flex-wrap: nowrap; gap: 4px 8px;
  padding: 4px 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.oie-cloze-syntax-group::-webkit-scrollbar {
  height: 4px;
}
.oie-cloze-syntax-group::-webkit-scrollbar-thumb {
  background: var(--oie-border);
  border-radius: 2px;
}
.oie-cloze-syntax-item {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12px; cursor: pointer;
  color: var(--oie-text);
  padding: 2px 5px;
  border-radius: 3px;
  transition: background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.oie-cloze-syntax-item:hover {
  background: var(--oie-bg-fill);
}
.oie-cloze-syntax-item input {
  cursor: pointer;
  accent-color: var(--oie-primary);
  margin: 0;
}
.oie-cloze-syntax-item span {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
}

.oie-sub-tabs {
  display: flex; gap: 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--oie-border);
}
.oie-sub-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--oie-border);
  gap: 8px;
  flex-wrap: wrap;
}
.oie-tab-inline-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--oie-text-2);
  cursor: pointer;
  white-space: nowrap;
  margin-right: auto;
}
.oie-tab-inline-checkbox input {
  cursor: pointer;
  accent-color: var(--oie-primary);
  margin: 0;
}
.oie-sub-tab {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--oie-text-3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  margin-bottom: -1px;
  user-select: none;
}
.oie-sub-tab:hover { color: var(--oie-text); }
.oie-sub-tab.active {
  color: var(--oie-primary);
  border-bottom-color: var(--oie-primary);
}
.oie-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.oie-footer-hint {
  font-size: 11px;
  color: var(--oie-text-3);
  flex: 1;
  line-height: 1.4;
}

.oie-code-view {
  font: 12px/1.6 'JetBrains Mono', 'Consolas', 'Menlo', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--oie-bg-alt);
  border: 1px solid var(--oie-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 180px;
  max-height: 360px;
  overflow: auto;
  color: var(--oie-text);
}
.oie-preview-view {
  background: var(--oie-bg-alt);
  border: 1px solid var(--oie-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 180px;
  max-height: 360px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.7;
  color: var(--oie-text);
}
.oie-preview-view ul, .oie-preview-view ol {
  margin: 4px 0 4px 20px;
}
.oie-preview-view li { margin: 2px 0; }
.oie-preview-view p { margin: 4px 0; }
.oie-preview-view h1, .oie-preview-view h2, .oie-preview-view h3 {
  color: var(--oie-text);
  font-weight: 600;
  margin: 8px 0 4px 0;
}
.oie-preview-view strong { color: var(--oie-text); }
.oie-preview-view code {
  background: var(--oie-bg-fill);
  color: var(--oie-text);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
}
.oie-preview-placeholder {
  color: var(--oie-text-3);
  font-size: 13px;
  text-align: center;
  padding: 40px 20px;
  display: block;
}
.oie-preview-syntax {
  background: var(--oie-bg-fill);
  color: var(--oie-text);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Consolas', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: inline;
}

.oie-headbar-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: inherit;
  transition: all 0.15s;
  position: relative;
  background: none;
  border: 1px solid transparent;
}
.oie-headbar-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  color: var(--oie-primary);
}
.oie-headbar-btn:focus-visible {
  outline: 2px solid var(--oie-primary);
  outline-offset: 1px;
}
.oie-headbar-btn[aria-expanded="true"] {
  background: var(--oie-primary-light, rgba(99, 102, 241, 0.12));
  color: var(--oie-primary);
}
.oie-headbar-btn-icon {
  font-size: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.oie-headbar-btn-icon svg { width: 18px; height: 18px; }

.oie-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--oie-bg);
  color: var(--oie-text);
  border-radius: 8px;
  box-shadow: var(--oie-shadow);
  border: 1px solid var(--oie-border);
  min-width: 180px;
  z-index: 100000;
  overflow: hidden;
  animation: oie-dropdown-in 0.12s ease;
  font-size: 13px;
}
@keyframes oie-dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.oie-dropdown-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--oie-text);
  transition: background 0.12s;
  line-height: 1.4;
  outline: none;
}
.oie-dropdown-item:hover,
.oie-dropdown-item:focus-visible {
  background: var(--oie-bg-fill);
}
.oie-dropdown-item:focus-visible {
  box-shadow: inset 2px 0 0 0 var(--oie-primary);
}
.oie-dropdown-item-icon {
  font-size: 16px;
  color: var(--oie-primary);
  width: 18px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.oie-dropdown-item-icon svg { width: 16px; height: 16px; }
.oie-dropdown-divider {
  height: 1px;
  background: var(--oie-border-light);
  margin: 0;
}

.oie-context-menu {
  position: fixed;
  background: var(--oie-bg);
  color: var(--oie-text);
  border-radius: 8px;
  box-shadow: var(--oie-shadow);
  border: 1px solid var(--oie-border);
  min-width: 200px;
  z-index: 100001;
  overflow: hidden;
  animation: oie-dropdown-in 0.1s ease;
  font-size: 13px;
}
.oie-context-menu-header {
  padding: 7px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--oie-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--oie-bg-alt);
  border-bottom: 1px solid var(--oie-border-light);
}

/* 高亮语法预览样式 */
.oie-preview-view .orca-inline.bc.bcc-red { background: #ff4d4f; border-radius: 2px; padding: 0 2px; color: #fff; }
.oie-preview-view .orca-inline.bc.bcc-blue { background: #fdbfff; border-radius: 2px; padding: 0 2px; }
.oie-preview-view .orca-inline.bc.bcc-green { background: #affad1; border-radius: 2px; padding: 0 2px; }
.oie-preview-view .orca-inline.bc.bcc-yellow { background: #fff3a0; border-radius: 2px; padding: 0 2px; }
.oie-preview-view .orca-inline.fc.fcc-red { color: #F36208; font-weight: 600; }
.oie-preview-view .orca-inline.fc.fcc-blue { color: #8a2be2; font-weight: 600; }
.oie-preview-view .orca-inline.fc.fcc-green { color: #1ddd08; font-weight: 600; }
.oie-preview-view .orca-inline.h { background: #ffeb3b; border-radius: 2px; padding: 0 2px; }

/* SiYuan (思源笔记) 高亮预览样式 */
.oie-preview-view [data-type="mark"] { background: #ffeb3b; border-radius: 2px; padding: 0 2px; }
.oie-preview-view [data-type="backgroundColor"] { border-radius: 2px; padding: 0 2px; }
.oie-preview-view [data-type="color"] { font-weight: 600; }
/* SiYuan CSS 变量预览 (与思源默认主题颜色接近) */
.oie-preview-view [style*="b3-font-background1"] { background: #ffe4e4 !important; }
.oie-preview-view [style*="b3-font-background3"] { background: #fff3a0 !important; }
.oie-preview-view [style*="b3-font-background4"] { background: #affad1 !important; }
.oie-preview-view [style*="b3-font-background6"] { background: #fdbfff !important; }
.oie-preview-view [style*="b3-font-color1"] { color: #F36208 !important; }
.oie-preview-view [style*="b3-font-color3"] { color: #b88a00 !important; }
.oie-preview-view [style*="b3-font-color4"] { color: #1ddd08 !important; }
.oie-preview-view [style*="b3-font-color6"] { color: #8a2be2 !important; }

/* 基础 HTML 标签样式 (fragsToBasicHTML 输出) */
/* 只重置没有 inline style 的 mark，避免覆盖 fragsToBasicHTML 的颜色 */
.oie-preview-view mark:not([style]) {
  background: #ffeb3b;
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
.oie-preview-view .cloze {
  background: #ffeb3b;
  border-radius: 2px;
  padding: 0 2px;
}

/* 导入成功后块高亮动画 */
.oie-import-highlight {
  animation: oie-import-pulse 1.5s ease-in-out;
}
@keyframes oie-import-pulse {
  0% { box-shadow: inset 4px 0 0 0 rgba(51, 112, 255, 0.8); }
  50% { box-shadow: inset 4px 0 0 0 rgba(51, 112, 255, 0.2); }
  100% { box-shadow: inset 4px 0 0 0 rgba(51, 112, 255, 0); }
}

/* 样式设置：富文本 / 挖空 并排两列，挖空语法整行排列 */
.oie-style-config {
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 12px 16px;
}
.oie-style-config .oie-opt-group {
  min-width: 0;
}
.oie-style-config .oie-opt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}
.oie-style-config .oie-cloze-syntax-group {
  margin-top: 4px;
  padding: 6px 10px;
  background: var(--oie-bg-fill);
  border-radius: 4px;
  border: 1px solid var(--oie-border-light);
}
@media (max-width: 520px) {
  .oie-style-config {
    grid-template-columns: 1fr;
  }
}

/* 进度浮层 - 科技感设计 */
.oie-progress-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 100%);
  backdrop-filter: blur(12px) saturate(1.3);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  z-index: 100000;
  display: flex; align-items: center; justify-content: center;
  animation: oie-fade-in 0.3s ease;
}
.oie-progress-card {
  position: relative;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.12) 0%, 
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 24px;
  padding: 28px 32px;
  min-width: 380px; max-width: 520px; width: 90%;
  box-shadow:
    0 32px 80px rgba(0,0,0,0.25),
    0 0 0 1px rgba(255,255,255,0.1) inset,
    0 0 60px rgba(51,112,255,0.15),
    0 0 120px rgba(51,112,255,0.08);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  animation: oie-scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
/* 科技感光晕边框 */
.oie-progress-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  padding: 1px;
  background: linear-gradient(135deg, 
    rgba(51,112,255,0.4) 0%, 
    rgba(122,170,255,0.2) 25%,
    transparent 50%,
    rgba(122,170,255,0.2) 75%,
    rgba(51,112,255,0.4) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  animation: oie-border-glow 3s ease-in-out infinite;
}
@keyframes oie-border-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
/* 背景粒子效果 */
.oie-progress-card::after {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: 
    radial-gradient(circle at 20% 30%, rgba(51,112,255,0.15) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(122,170,255,0.1) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 60%);
  animation: oie-particles 8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes oie-particles {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(2%, 2%) rotate(120deg); }
  66% { transform: translate(-2%, -2%) rotate(240deg); }
}
@keyframes oie-scale-in {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.oie-progress-header {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
  z-index: 1;
}
.oie-progress-title {
  font-size: 15px; font-weight: 600;
  color: var(--oie-text);
  display: flex; align-items: center; gap: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.oie-progress-title svg {
  width: 20px; height: 20px;
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(51,112,255,0.5));
}
.oie-progress-spinner {
  color: var(--oie-primary);
  animation: oie-spin 1s linear infinite;
}
.oie-progress-spinner svg {
  stroke-dasharray: 60;
  stroke-dashoffset: 0;
  animation: oie-spinner-dash 1.2s ease-in-out infinite;
}
@keyframes oie-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes oie-spinner-dash {
  0% { stroke-dashoffset: 60; }
  50% { stroke-dashoffset: 15; }
  100% { stroke-dashoffset: 60; }
}
.oie-progress-success {
  color: var(--oie-success);
  animation: oie-scale-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  filter: drop-shadow(0 0 12px rgba(0,180,42,0.6));
}
@keyframes oie-scale-pop {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.oie-progress-percent {
  font-size: 16px; font-weight: 700;
  color: var(--oie-primary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(51,112,255,0.4);
  z-index: 1;
}
.oie-progress-track {
  position: relative;
  width: 100%; height: 10px;
  background: linear-gradient(90deg, 
    rgba(255,255,255,0.08) 0%, 
    rgba(255,255,255,0.04) 100%);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 
    inset 0 1px 3px rgba(0,0,0,0.1),
    0 1px 0 rgba(255,255,255,0.05);
  z-index: 1;
}
.oie-progress-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, 
    var(--oie-primary) 0%, 
    #7aaaff 50%,
    #a8d4ff 100%);
  border-radius: 999px;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  box-shadow: 
    0 0 16px rgba(51,112,255,0.6),
    0 0 32px rgba(51,112,255,0.3),
    inset 0 1px 0 rgba(255,255,255,0.3);
}
.oie-progress-fill::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, 
    rgba(255,255,255,0.4) 0%, 
    rgba(255,255,255,0) 100%);
  border-radius: 999px 999px 0 0;
}
.oie-progress-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255,255,255,0.5) 50%, 
    transparent 100%);
  animation: oie-progress-shimmer 1.5s ease-in-out infinite;
}
@keyframes oie-progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
.oie-progress-meta {
  position: relative;
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 14px;
  font-size: 12px; color: var(--oie-text-3);
  z-index: 1;
}
.oie-progress-status { 
  color: var(--oie-text-2);
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.oie-progress-card.is-complete .oie-progress-fill {
  background: linear-gradient(90deg, 
    var(--oie-success) 0%, 
    #5cd380 50%,
    #8ee8a8 100%);
  box-shadow: 
    0 0 20px rgba(0,180,42,0.5),
    0 0 40px rgba(0,180,42,0.25),
    inset 0 1px 0 rgba(255,255,255,0.3);
}
.oie-progress-card.is-complete .oie-progress-percent {
  color: var(--oie-success);
  text-shadow: 0 0 12px rgba(0,180,42,0.5);
}
.oie-progress-card.is-complete::before {
  background: linear-gradient(135deg, 
    rgba(0,180,42,0.5) 0%, 
    rgba(92,211,128,0.3) 50%,
    rgba(0,180,42,0.5) 100%);
}
.oie-progress-header-right {
  display: flex; align-items: center; gap: 12px;
  z-index: 1;
}
.oie-progress-cancel {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.08);
  color: var(--oie-text);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}
.oie-progress-cancel:hover {
  background: rgba(247,49,73,0.15);
  border-color: rgba(247,49,73,0.4);
  color: #f73149;
}
.oie-progress-cancel:active { transform: scale(0.96); }
.oie-progress-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255,255,255,0.04);
  color: var(--oie-text-3);
}
.oie-progress-card.is-cancelling .oie-progress-fill {
  background: linear-gradient(90deg, #f73149 0%, #ff7a8a 100%) !important;
  box-shadow: 0 0 16px rgba(247,49,73,0.4) !important;
  animation: oie-cancelling-shimmer 0.6s ease-in-out infinite;
}
.oie-progress-card.is-cancelling .oie-progress-spinner {
  color: #f73149;
  animation: oie-spin 0.6s linear infinite;
}
@keyframes oie-cancelling-shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}
`;

// ============================================================
// STYLE MANAGEMENT
// ============================================================

let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.dataset.role = 'orca-import-export';
  style.textContent = DIALOG_STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}

function removeStyles() {
  const styles = document.querySelectorAll('style[data-role="orca-import-export"]');
  styles.forEach(s => s.remove());
  styleInjected = false;
}

// ============================================================
// DOM HELPER
// ============================================================

/**
 * 增强的 DOM 元素创建函数（支持可变参数 children）
 * - 兼容单元素或数组作为 children
 * - 兼容 textContent / innerHTML / 事件 / 属性
 * - 支持 `icon` 属性快速插入 SVG 字符串
 */
function el(
  tag: string,
  props: Record<string, any> = {},
  ...children: (HTMLElement | string | (HTMLElement | string | null | undefined)[] | null | undefined)[]
): HTMLElement {
  const node = document.createElement(tag);
  let hasTextContent = false;
  let hasIcon = false;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'innerHTML') {
      node.innerHTML = value;
      hasTextContent = true;
    }
    else if (key === 'textContent') {
      node.textContent = value;
      hasTextContent = true;
    }
    else if (key === 'icon' && typeof value === 'string') {
      const span = document.createElement('span');
      span.className = 'oie-icon-span';
      span.style.display = 'inline-flex';
      span.style.alignItems = 'center';
      span.style.justifyContent = 'center';
      span.innerHTML = ICONS[value as keyof typeof ICONS] || value;
      node.appendChild(span);
      hasIcon = true;
    }
    else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      node.addEventListener(eventName, value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  // 追加 children（textContent/innerHTML/icon 优先级最高，会跳过 children）
  if (!hasTextContent && !hasIcon) {
    for (const child of children) {
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c === null || c === undefined) continue;
          if (typeof c === 'string') node.appendChild(document.createTextNode(c));
          else node.appendChild(c);
        }
      } else if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
  }
  return node;
}

/**
 * 安全设置 SVG 图标（替代 innerHTML = ICONS.xxx）
 * 将 SVG 字符串解析为 DOM 后附加到目标元素，避免 innerHTML 注入风险
 */
function setIcon(element: HTMLElement, iconName: keyof typeof ICONS) {
  const svgString = ICONS[iconName];
  if (!svgString) return;

  // 清空现有内容
  element.innerHTML = '';

  // 使用 DOMParser 解析 SVG 字符串
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;

  if (svg && svg.tagName.toLowerCase() === 'svg') {
    // 确保 SVG 正确显示
    svg.setAttribute('width', '1em');
    svg.setAttribute('height', '1em');
    svg.style.display = 'inline-block';
    svg.style.verticalAlign = 'middle';
    element.appendChild(svg);
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

/** 将树中所有节点的 fragments 降级为纯文本（去除高亮/挖空/加粗等富文本信息） */
function stripHighlightFromTree(tree: TreeNode[]): TreeNode[] {
  return tree.map(node => ({
    ...node,
    fragments: [{ t: 't' as const, v: node.fragments.map(f => String(f.v ?? '')).join('') }],
    children: stripHighlightFromTree(node.children),
  }));
}

/**
 * 在指定容器内显示一个轻量级状态提示（自动消失）
 * @param container 父容器（通常是对话框 body 或 parsedSection）
 * @param text 提示文本
 * @param type 类型: 'info' | 'success' | 'warn' | 'error'
 */
function showStatusHintIn(container: HTMLElement, text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info', durationMs = 2200) {
  // 移除同容器的旧提示
  const old = container.querySelector('.oie-status-hint');
  if (old) old.remove();

  const hint = el('div', {
    className: `oie-status-hint oie-status-${type}`,
    textContent: text,
  });
  hint.style.cssText = `
    position: relative; padding: 6px 12px; margin: 4px 0;
    border-radius: 4px; font-size: 12px; line-height: 1.4;
    background: ${type === 'success' ? 'rgba(46,160,67,0.12)' :
                 type === 'warn'    ? 'rgba(212,160,4,0.12)' :
                 type === 'error'   ? 'rgba(247,49,73,0.12)' :
                                      'rgba(51,112,255,0.12)'};
    color: ${type === 'success' ? '#2ea043' :
            type === 'warn'    ? '#b88a00' :
            type === 'error'   ? '#f73149' :
                                 '#3370ff'};
    border: 1px solid ${type === 'success' ? 'rgba(46,160,67,0.3)' :
                       type === 'warn'    ? 'rgba(212,160,4,0.3)' :
                       type === 'error'   ? 'rgba(247,49,73,0.3)' :
                                            'rgba(51,112,255,0.3)'};
    animation: oie-hint-fade 0.2s ease;
  `;
  container.appendChild(hint);
  setTimeout(() => {
    hint.style.transition = 'opacity 0.3s ease';
    hint.style.opacity = '0';
    setTimeout(() => hint.remove(), 300);
  }, durationMs);
}

type DownloadResult = 'downloaded' | 'cancelled' | 'failed';

async function downloadFile(content: string, filename: string, mimeType: string): Promise<DownloadResult> {
  const extension = filename.split('.').pop() || '';

  // 方案 1: File System Access API（现代浏览器，允许用户选择保存位置）
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: extension ? [{
          description: '导出文件',
          accept: { [mimeType]: [`.${extension}`] } as any,
        }] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([content], { type: mimeType }));
      await writable.close();
      return 'downloaded';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
      console.warn('[OIE] showSaveFilePicker failed:', err);
    }
  }

  // 方案 2: 传统 <a download>（Electron / 旧版环境）
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch (err) {
    console.warn('[OIE] <a download> failed:', err);
  }

  return 'failed';
}

// ============================================================
// PROGRESS OVERLAY
// ============================================================

export interface ProgressOverlay {
  el: HTMLDivElement;
  update: (current: number, total: number, status?: string) => void;
  close: () => void;
  /** 设置是否可取消；返回 AbortSignal，业务侧在每步检查 signal.aborted */
  setCancellable: (cancellable: boolean) => AbortSignal;
  isCancelled: () => boolean;
}

export function createProgressOverlay(title: string): ProgressOverlay {
  injectStyles();

  const fill = el('div', { className: 'oie-progress-fill' });
  const track = el('div', { className: 'oie-progress-track' }, fill);
  const statusEl = el('span', { className: 'oie-progress-status', textContent: '正在处理...' });
  const countEl = el('span', { className: 'oie-progress-count', textContent: '0 / 0' });
  const percentEl = el('span', { className: 'oie-progress-percent', textContent: '0%' });
  const iconEl = el('span', { icon: 'spinner', className: 'oie-progress-spinner' }) as HTMLSpanElement;
  const titleText = el('span', { textContent: title });

  // 取消按钮：默认不显示，业务侧调用 setCancellable(true) 后展示
  const cancelBtn = el('button', {
    className: 'oie-progress-cancel',
    type: 'button',
    title: '取消当前操作',
    'aria-label': '取消',
    onclick: () => {
      if (abortController && !abortController.signal.aborted) {
        abortController.abort('user-cancel');
        statusEl.textContent = '正在取消...';
        cancelBtn.disabled = true;
        cancelBtn.textContent = '取消中';
        // 取消态视觉
        card.classList.add('is-cancelling');
      }
    },
  }, '取消') as HTMLButtonElement;
  cancelBtn.style.display = 'none';

  const card = el('div', { className: 'oie-progress-card' },
    el('div', { className: 'oie-progress-header' },
      el('div', { className: 'oie-progress-title' },
        iconEl,
        titleText,
      ),
      el('div', { className: 'oie-progress-header-right' },
        percentEl,
        cancelBtn,
      ),
    ),
    track,
    el('div', { className: 'oie-progress-meta' }, statusEl, countEl),
  );

  const overlay = el('div', { className: 'oie-progress-overlay oie-themed' }, card);
  document.body.appendChild(overlay);

  let abortController: AbortController | null = null;

  return {
    el: overlay as HTMLDivElement,
    update(current: number, total: number, status?: string) {
      const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
      fill.style.width = pct + '%';
      percentEl.textContent = pct + '%';
      countEl.textContent = `${current} / ${total}`;
      if (status) statusEl.textContent = status;
    },
    close() {
      // 清理取消控制器
      abortController = null;
      cancelBtn.style.display = 'none';
      fill.style.width = '100%';
      statusEl.textContent = '完成';
      percentEl.textContent = '100%';
      card.classList.remove('is-cancelling');
      card.classList.add('is-complete');
      iconEl.innerHTML = ICONS.checkCircle;
      iconEl.classList.remove('oie-progress-spinner');
      iconEl.classList.add('oie-progress-success');
      titleText.textContent = title + '完成';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => overlay.remove(), 300);
    },
    setCancellable(cancellable: boolean) {
      if (cancellable) {
        abortController = new AbortController();
        cancelBtn.style.display = '';
        cancelBtn.disabled = false;
        cancelBtn.textContent = '取消';
        return abortController.signal;
      } else {
        abortController = null;
        cancelBtn.style.display = 'none';
        return new AbortController().signal;
      }
    },
    isCancelled() {
      return !!abortController?.signal.aborted;
    },
  };
}

// ============================================================
// IMPORT DIALOG (原生 DOM)
// ============================================================

export function showImportDialog(onImport: (tree: TreeNode[], formatOption: string, clozeMode: boolean, clozeSyntax: string[], preparedText: string, sourceFormat: HighlightSource, convertHighlight: boolean) => void) {
  // 并发对话框检查
  const existingImport = document.getElementById('oie-import-dialog-overlay');
  if (existingImport) existingImport.remove();
  try {
    injectStyles();
  } catch (err) {
    orca.notify('error', `样式注入失败: ${err}`);
    return;
  }

  let fileContent = '';
  let fileName = '';
  let detectedFormat: FileFormat | '' = '';
  let manualFormat: FileFormat | 'auto' = 'auto';
  let parsedTree: TreeNode[] = [];
  let preparedText = '';      // 预处理后的文本（走 batchInsertText，保留表格/图片）
  let sourceFormat: HighlightSource = 'auto';  // 高亮源格式
  let formatOption = 'unordered';
  let importSubTab: 'preview' | 'code' = 'preview' as 'preview' | 'code';
  
  // 挖空模式设置
  const settings = getSettings();
  let clozeMode = settings.clozeMode;
  let clozeSyntax = settings.clozeSyntax || ['bold'];
  // 高亮转换开关（控制预览和导入是否保留高亮）
  let convertHighlight = true;

  try {
    const overlay = el('div', { className: 'oie-overlay oie-themed', id: 'oie-import-dialog-overlay' });
    overlay.addEventListener('click', () => close());
    const dialog = el('div', { className: 'oie-dialog' });
    dialog.addEventListener('click', (e) => e.stopPropagation());
    overlay.appendChild(dialog);

    // Header
    const header = el('div', { className: 'oie-dialog-header' },
      el('div', { className: 'oie-dialog-title', id: 'oie-import-dialog-title' },
        el('span', { icon: 'upload' }),
        el('span', { textContent: '导入文件' }),
      ),
      el('button', {
        className: 'oie-dialog-close',
        title: '关闭 (Esc)',
        'aria-label': '关闭',
        onClick: close,
      },
        el('span', { icon: 'close' }),
      ),
    );

    // 键盘导航：Esc 关闭，Enter 确认导入（排除输入控件），Tab 焦点陷阱
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Enter' && parsedTree.length > 0) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
          return; // 在输入控件中按 Enter 不触发导入
        }
        e.preventDefault();
        importBtn.click();
      } else if (e.key === 'Tab') {
        // 焦点陷阱：Tab 循环在对话框内
        const focusable = dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'oie-import-dialog-title');
    dialog.tabIndex = -1;

    // Body
    const body = el('div', { className: 'oie-dialog-body' });

    // File drop zone
    const fileInput = el('input', {
      type: 'file',
      style: { display: 'none' },
      accept: '.md,.txt,.opml,.xml,.json'
    }) as HTMLInputElement;

    const dropZone = el('div', { className: 'oie-file-drop' });
    const dropIcon = el('div', { className: 'oie-file-drop-icon', innerHTML: ICONS.upload });
    const dropText = el('div', { className: 'oie-file-drop-text', textContent: '点击选择文件或拖拽文件到此处' });
    const dropHint = el('div', {
      style: { fontSize: '11px', color: 'var(--oie-text-3)', marginTop: '4px' },
      textContent: '支持 .md / .txt / .opml / .json (自动检测 Logseq / Obsidian / Orca Note 富文本语法)'
    });
    dropZone.append(dropIcon, dropText, dropHint, fileInput);

    // Paste button (next to file drop zone)
    const pasteBtn = el('button', {
      className: 'oie-btn oie-btn-secondary oie-btn-sm',
      style: { marginTop: '8px', width: '100%' },
    },
      el('span', { icon: 'copy' }),
      el('span', { textContent: '从剪贴板粘贴文本' }),
    );

    function updateDropZone() {
      dropZone.className = 'oie-file-drop' + (fileName ? ' has-file' : '');
      setIcon(dropIcon, fileName ? 'fileCheck' : 'upload');
      dropText.innerHTML = '';
      if (dropHint.parentElement) dropHint.remove();
      if (fileName) {
        const fileNameSpan = el('span', { className: 'oie-file-name', textContent: fileName });
        dropText.appendChild(fileNameSpan);
        if (detectedFormat) {
          dropText.appendChild(el('span', { className: 'oie-format-badge', textContent: detectedFormat }));
        }
      } else {
        dropText.textContent = '点击选择文件或拖拽文件到此处';
        dropZone.appendChild(dropHint);
      }
    }
    updateDropZone();

    dropZone.addEventListener('click', () => fileInput.click());
    // P1-4: 用 enter/leave 计数器 + 提示文字实现更稳定的拖放视觉反馈
    let dragCounter = 0;
    const dropHintActive = el('div', { className: 'oie-file-drop-hint-active', textContent: '释放鼠标导入' });
    let dropHintActiveAppended = false;
    const showDragOver = () => {
      if (dropHint.parentElement) dropHint.remove();
      if (!dropHintActiveAppended) {
        dropZone.appendChild(dropHintActive);
        dropHintActiveAppended = true;
      }
    };
    const hideDragOver = () => {
      if (dropHintActiveAppended) {
        dropHintActive.remove();
        dropHintActiveAppended = false;
      }
    };
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      dropZone.classList.add('drag-over');
      if (dragCounter === 1) showDragOver();
    });
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) {
        dropZone.classList.remove('drag-over');
        hideDragOver();
        updateDropZone();
      }
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropZone.classList.remove('drag-over');
      hideDragOver();
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) handleFileSelect(file);
      else updateDropZone();
    });
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileSelect(file);
    });

    // Paste from clipboard
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          orca.notify('warn', '剪贴板为空', { title: '导入提示' });
          return;
        }
        fileContent = text;
        fileName = '(粘贴内容)';
        preparedText = preprocessForImport(text);
        detectedFormat = detectFormat(fileContent);
        sourceFormat = getHighlightSource(detectedFormat, preparedText);
        try {
          parsedTree = parseFile(fileContent, manualFormat === 'auto' ? undefined : manualFormat);
        } catch (err) {
          parsedTree = [];
          orca.notify('error', `文件解析失败: ${err instanceof Error ? err.message : String(err)}`, { title: '导入错误' });
        }
        updateDropZone();
        updateParsedSection();
        orca.notify('success', '已从剪贴板粘贴', { title: '导入' });
      } catch {
        orca.notify('error', '无法读取剪贴板', { title: '导入错误' });
      }
    });

    // 文件大小限制 (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    // 文件读取序号，防止竞态
    let fileReadSeq = 0;

    function handleFileSelect(file: File) {
      // 文件大小校验
      if (file.size > MAX_FILE_SIZE) {
        orca.notify('error', `文件过大 (${(file.size / 1024 / 1024).toFixed(1)} MB)，最大支持 50 MB`, { title: '导入错误' });
        return;
      }
      // 二进制文件检测：通过扩展名和类型过滤
      const textExts = ['.md', '.txt', '.opml', '.xml', '.json', '.markdown', '.csv', '.org'];
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (file.type && !file.type.startsWith('text/') && file.type !== 'application/json' && file.type !== 'application/xml' && file.type !== 'text/xml') {
        // 非文本 MIME 类型且扩展名不在白名单
        if (!textExts.includes(ext)) {
          orca.notify('error', '不支持的文件类型，请选择文本文件 (.md/.txt/.opml/.json)', { title: '导入错误' });
          return;
        }
      }
      const currentSeq = ++fileReadSeq;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (currentSeq !== fileReadSeq) return; // 丢弃过期回调
        fileContent = e.target?.result as string;
        // 去除 UTF-8 BOM
        if (fileContent.charCodeAt(0) === 0xFEFF) {
          fileContent = fileContent.slice(1);
        }
        // 空文件检测
        if (!fileContent.trim()) {
          orca.notify('warn', '文件内容为空', { title: '导入提示' });
          return;
        }
        fileName = file.name;
        preparedText = preprocessForImport(fileContent);
        detectedFormat = detectFormat(fileContent);
        sourceFormat = getHighlightSource(detectedFormat, preparedText);
        try {
          parsedTree = parseFile(fileContent, manualFormat === 'auto' ? undefined : manualFormat);
        } catch (err) {
          parsedTree = [];
          orca.notify('error', `文件解析失败: ${err instanceof Error ? err.message : String(err)}`, { title: '导入错误' });
        }
        updateDropZone();
        updateParsedSection();
      };
      reader.onerror = () => {
        if (currentSeq !== fileReadSeq) return;
        orca.notify('error', '文件读取失败', { title: '导入错误' });
      };
      reader.readAsText(file);
    }

    // Parsed section
    const parsedSection = el('div');
    parsedSection.style.display = 'none';

    // 导入按钮（在 body 内，与"预览"平齐）
    const importBtn = el('button', { className: 'oie-btn oie-btn-primary oie-btn-sm', disabled: true },
      el('span', { icon: 'download' }),
      el('span', { textContent: '导入' }),
    );
    importBtn.addEventListener('click', () => {
      if (parsedTree.length === 0) {
        orca.notify('warn', '请先选择文件', { title: '导入提示' });
        return;
      }

      // 先关闭对话框，再执行导入
      // editor command 会通过捕获的 cursor 建立编辑器上下文
      const tree = parsedTree;
      const fmt = formatOption;
      const currentClozeMode = clozeMode;
      const currentClozeSyntax = clozeSyntax;
      const currentConvertHighlight = convertHighlight;

      close();

      // 用 setTimeout 0 推迟到下一个 tick，确保 overlay 完全移除
      setTimeout(() => {
        onImport(tree, fmt, currentClozeMode, currentClozeSyntax, preparedText, sourceFormat, currentConvertHighlight);
      }, 0);
    });

    function updateImportBtn() {
      (importBtn as HTMLButtonElement).disabled = parsedTree.length === 0;
    }

    const updateParsedSection = function() {
      parsedSection.style.display = parsedTree.length > 0 ? 'block' : 'none';
      parsedSection.innerHTML = '';

      if (parsedTree.length === 0) {
        updateImportBtn();
        return;
      }

      // Info bar
      parsedSection.appendChild(
        el('div', { className: 'oie-info-bar' },
          el('span', { icon: 'info' }),
          el('span', { textContent: `已解析 ${countNodes(parsedTree)} 个节点，富文本语法已自动转换为 Orca 原生格式` }),
        )
      );

      // Import format select (手动指定导入格式)
      const importFormatConfig = el('div', { className: 'oie-config-bar' });
      const importFormatSelect = el('select', { className: 'oie-select' },
        [el('option', { value: 'auto', textContent: '自动检测' }),
         el('option', { value: 'markdown', textContent: 'Markdown' }),
         el('option', { value: 'unordered', textContent: '无序列表大纲' }),
         el('option', { value: 'ordered', textContent: '有序列表大纲' }),
         el('option', { value: 'json', textContent: 'JSON' }),
         el('option', { value: 'logseq', textContent: 'Logseq' }),
         el('option', { value: 'obsidian', textContent: 'Obsidian' }),
         el('option', { value: 'orca', textContent: 'Orca Note' }),
         el('option', { value: 'siyuan', textContent: 'SiYuan (思源)' }),
         el('option', { value: 'plaintext', textContent: '纯文本' }),
        ]
      ) as HTMLSelectElement;
      importFormatSelect.value = manualFormat;
      importFormatSelect.addEventListener('change', () => {
        manualFormat = importFormatSelect.value as FileFormat | 'auto';
        // 重新解析并更新 sourceFormat
        if (fileContent) {
          try {
            parsedTree = parseFile(fileContent, manualFormat === 'auto' ? undefined : manualFormat);
            // ★ 修复：切换格式后重新计算 sourceFormat
            preparedText = preprocessForImport(fileContent);
            detectedFormat = detectFormat(fileContent);
            sourceFormat = getHighlightSource(detectedFormat, preparedText);
          } catch (err) {
            parsedTree = [];
            orca.notify('error', `文件解析失败: ${err instanceof Error ? err.message : String(err)}`, { title: '导入错误' });
          }
          updateParsedSection();
        }
      });
      importFormatConfig.append(
        el('div', { className: 'oie-opt-group' },
          el('label', { className: 'oie-opt-label', textContent: '导入格式' }),
          importFormatSelect,
        ),
      );
      parsedSection.appendChild(importFormatConfig);

      // Format options label
      parsedSection.appendChild(
        el('div', { className: 'oie-section-label' },
          el('span', { icon: 'settings' }),
          el('span', { textContent: '导入格式' }),
        )
      );

      const optionGroup = el('div', { className: 'oie-option-group' });
      const formatOptions = [
        { id: 'unordered', label: '无序列表', desc: '使用 - 符号的层级大纲', icon: 'list' },
        { id: 'ordered', label: '有序列表', desc: '使用 1. 2. 3. 的层级大纲', icon: 'listNumbers' },
        { id: 'markdown', label: 'Markdown', desc: '使用 # 标题的层级结构', icon: 'markdown' },
      ];

      for (const opt of formatOptions) {
        const card = el('div', { className: 'oie-option-card' + (formatOption === opt.id ? ' selected' : '') },
          el('div', { className: 'oie-radio' }),
          el('div', { className: 'oie-option-icon', icon: opt.icon }),
          el('div', { className: 'oie-option-text' },
            el('div', { className: 'oie-option-label', textContent: opt.label }),
            el('div', { className: 'oie-option-desc', textContent: opt.desc }),
          ),
        );
        card.addEventListener('click', () => {
          formatOption = opt.id;
          updateParsedSection();
          // P1-5: 切换格式时立即重渲染预览
          updatePreviewContent();
        });
        optionGroup.appendChild(card);
      }
      parsedSection.appendChild(optionGroup);

      // 样式配置栏：挖空模式 + 语法选项整合为一行（去掉多余的"样式设置"标题）
      const styleConfigBar = el('div', { className: 'oie-config-bar oie-style-config' });

      // 挖空模式开关
      const clozeModeCheckbox = el('input', {
        type: 'checkbox',
        checked: clozeMode,
      }) as HTMLInputElement;

      const clozeModeLabel = el('label', { className: 'oie-checkbox-label' },
        clozeModeCheckbox,
        el('span', { textContent: '启用挖空' }),
      );

      // 挖空语法多选复选框组
      const CLOZE_SYNTAX_OPTIONS: { value: ClozeSyntax; label: string }[] = [
        { value: 'cloze-idx-bracket', label: '[[c1::xx]]' },
        { value: 'bracket', label: '[[xx]]' },
        { value: 'brace', label: '{{xx}}' },
        { value: 'tortoise', label: '〖xx〗' },
        { value: 'bold', label: '**xx**' },
        { value: 'bold-italic', label: '***xx***' },
        { value: 'italic', label: '*xx*' },
        { value: 'quote', label: '"xx"' },
      ];

      const clozeSyntaxCheckboxes: HTMLInputElement[] = [];
      const clozeSyntaxGroup = el('div', { className: 'oie-cloze-syntax-group' });
      for (const opt of CLOZE_SYNTAX_OPTIONS) {
        const cb = el('input', {
          type: 'checkbox',
          checked: clozeSyntax.includes(opt.value),
        }) as HTMLInputElement;
        clozeSyntaxCheckboxes.push(cb);
        const cbLabel = el('label', { className: 'oie-cloze-syntax-item' },
          cb,
          el('span', { textContent: opt.label }),
        );
        clozeSyntaxGroup.appendChild(cbLabel);
      }

      // 富文本转换开关
      const convertHighlightCheckbox = el('input', {
        type: 'checkbox',
        checked: convertHighlight,
      }) as HTMLInputElement;
      const convertHighlightLabel = el('label', { className: 'oie-checkbox-label' },
        convertHighlightCheckbox,
        el('span', { textContent: '转换富文本语法' }),
      );

      styleConfigBar.append(
        // 挖空模式 + 语法选项整合为一行（富文本已移至预览/源码标签行）
        el('div', { className: 'oie-opt-group oie-opt-group-inline' },
          el('label', { className: 'oie-opt-label', textContent: '挖空' }),
          clozeModeLabel,
          clozeSyntaxGroup,
        ),
      );

      parsedSection.appendChild(styleConfigBar);

      convertHighlightCheckbox.addEventListener('change', () => {
        convertHighlight = convertHighlightCheckbox.checked;
        updatePreviewContent();
      });

      // 监听挖空模式开关
      clozeModeCheckbox.addEventListener('change', () => {
        clozeMode = clozeModeCheckbox.checked;
        clozeSyntaxGroup.style.opacity = clozeMode ? '1' : '0.4';
        clozeSyntaxGroup.style.pointerEvents = clozeMode ? 'auto' : 'none';
        // 挖空设置仅在导入时生效，不重渲染预览以保留滚动/选择
        if (clozeMode) {
          showStatusHint('挖空已启用：将在导入时按所选语法包裹', 'success');
        } else {
          showStatusHint('挖空已关闭', 'info');
        }
      });

      // 监听挖空语法复选框变化
      const updateClozeSyntax = () => {
        clozeSyntax = clozeSyntaxCheckboxes
          .map((cb, i) => cb.checked ? CLOZE_SYNTAX_OPTIONS[i].value : null)
          .filter((v): v is ClozeSyntax => v !== null);
        if (clozeMode && clozeSyntax.length > 0) {
          showStatusHint(`已选 ${clozeSyntax.length} 种挖空语法：${clozeSyntax.map(s => CLOZE_SYNTAX_OPTIONS.find(o => o.value === s)?.label || s).join(' / ')}`, 'info');
        }
      };
      for (const cb of clozeSyntaxCheckboxes) {
        cb.addEventListener('change', updateClozeSyntax);
      }

      // 创建对话框内轻量级状态提示的闭包（在 parsedSection 之后定义）
      function showStatusHint(text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
        showStatusHintIn(parsedSection, text, type);
      }

      // 初始化选择器状态
      clozeSyntaxGroup.style.opacity = clozeMode ? '1' : '0.4';
      clozeSyntaxGroup.style.pointerEvents = clozeMode ? 'auto' : 'none';

      // Sub-tabs for preview (代码/高亮预览) — 富文本开关与预览/源码标签放在同一行
      const subTabs = el('div', { className: 'oie-sub-tabs oie-sub-tabs-row' });
      const richTextToggle = el('label', { className: 'oie-tab-inline-checkbox' },
        convertHighlightCheckbox,
        el('span', { textContent: '富文本' }),
      );
      const previewTab = el('div', { className: 'oie-sub-tab' + (importSubTab === 'preview' ? ' active' : ''), textContent: '预览' });
      const codeTab = el('div', { className: 'oie-sub-tab' + (importSubTab === 'code' ? ' active' : ''), textContent: '源码' });
      subTabs.append(richTextToggle, previewTab, codeTab);

      // 导入按钮放在 sub-tabs 右侧
      const toolbarGroup = el('div', { className: 'oie-toolbar-group' });
      toolbarGroup.appendChild(importBtn);
      subTabs.appendChild(toolbarGroup);

      previewTab.addEventListener('click', () => {
        importSubTab = 'preview';
        previewTab.className = 'oie-sub-tab active';
        codeTab.className = 'oie-sub-tab';
        updatePreviewContent();
      });
      codeTab.addEventListener('click', () => {
        importSubTab = 'code';
        codeTab.className = 'oie-sub-tab active';
        previewTab.className = 'oie-sub-tab';
        updatePreviewContent();
      });

      parsedSection.appendChild(subTabs);

      // Preview content area
      const previewArea = el('div');
      parsedSection.appendChild(previewArea);

      // P1-5: 防抖 + 加载骨架
      let previewDebounce: number | null = null;
      let isFirstRender = true;
      function updatePreviewContent(immediate: boolean = false) {
        if (previewDebounce !== null) {
          clearTimeout(previewDebounce);
          previewDebounce = null;
        }
        const render = () => {
          previewArea.innerHTML = '';
          if (parsedTree.length === 0) {
            previewArea.appendChild(el('div', { className: 'oie-preview-placeholder', textContent: '无内容' }));
            return;
          }
          // 第一次渲染时直接同步执行（不显示骨架），避免闪烁
          if (isFirstRender) {
            isFirstRender = false;
            doRender();
            return;
          }
          // 非首次渲染：显示骨架屏 80ms 后再渲染，避免快速切换选项时频繁抖动
          previewArea.innerHTML = '';
          const skeleton = el('div', { className: 'oie-preview-skeleton' });
          for (let i = 0; i < 3; i++) {
            const line = el('div', {
              className: 'oie-preview-skeleton-line',
              style: { width: (40 + (i * 17) % 50) + '%' },
            });
            skeleton.appendChild(line);
          }
          previewArea.appendChild(skeleton);
          setTimeout(doRender, 80);
        };
        const doRender = () => {
          previewArea.innerHTML = '';
          if (parsedTree.length === 0) {
            previewArea.appendChild(el('div', { className: 'oie-preview-placeholder', textContent: '无内容' }));
            return;
          }
          // 不转换高亮时，将 fragments 降级为纯文本
          const treeForRender = convertHighlight ? parsedTree : stripHighlightFromTree(parsedTree);
          if (importSubTab === 'preview') {
            const previewHTML = renderImportPreview(treeForRender, formatOption);
            previewArea.appendChild(el('div', {
              className: 'oie-preview-view oie-import-preview',
              innerHTML: previewHTML || '<span class="oie-preview-placeholder">无内容</span>',
            }));
          } else {
            const codeText = renderImportCodeView(treeForRender, formatOption);
            previewArea.appendChild(el('div', {
              className: 'oie-code-view',
              textContent: codeText || '无内容',
            }));
          }
        };
        if (immediate) {
          render();
        } else {
          previewDebounce = window.setTimeout(render, 120);
        }
      }
      updatePreviewContent(true);

      // 关键：渲染完毕后立即更新按钮状态
      updateImportBtn();
    }

    body.append(dropZone, pasteBtn, parsedSection);

    const footer = el('div', { className: 'oie-dialog-footer' },
      el('span', {
        className: 'oie-footer-hint',
        textContent: '提示：拖拽文件到上方区域或点击选择，也可从剪贴板粘贴'
      }),
      el('button', { className: 'oie-btn oie-btn-secondary', textContent: '取消', onClick: close }),
    );

    dialog.append(header, body, footer);
    document.body.appendChild(overlay);
    // 自动聚焦对话框以启用键盘导航
    setTimeout(() => dialog.focus(), 50);

    function close() {
      overlay.remove();
    }
  } catch (err) {
    orca.notify('error', `创建导入对话框失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// EXPORT DIALOG (原生 DOM)
// ============================================================

export function showExportDialog(
  tree: TreeNode[],
  blockCount: number,
  sourceFormat: HighlightSource,
  rootName: string = 'orca-export',
) {
  // 并发对话框检查
  const existingExport = document.getElementById('oie-export-dialog-overlay');
  if (existingExport) existingExport.remove();
  try {
    injectStyles();

    let style: ExportStyle = 'orca';
    let format: ExportFormat = 'outline';
    let richText = true;
    let maxDepth = 6;
    let bodyMode: 'include' | 'onlyH' = 'include';
    let filename = rootName || 'orca-export';
    let subTab: 'code' | 'preview' = 'preview' as 'code' | 'preview';
    // 导出挖空模式
    let exportClozeMode = false;
    let exportClozeSyntax: string[] = ['bold'];

    // 从设置读取默认值
    try {
      const settings = getSettings();
      style = settings.defaultExportStyle as ExportStyle;
      richText = settings.defaultRichText;
      maxDepth = settings.defaultMaxDepth;
      exportClozeMode = settings.exportClozeMode;
      exportClozeSyntax = settings.exportClozeSyntax || ['bold'];
    } catch (err) {
      // 失败时使用默认值继续
    }

    const overlay = el('div', { className: 'oie-overlay oie-themed', id: 'oie-export-dialog-overlay' });
    overlay.addEventListener('click', () => close());
    const dialog = el('div', { className: 'oie-dialog' });
    dialog.addEventListener('click', (e) => e.stopPropagation());
    overlay.appendChild(dialog);

    // Header
    const header = el('div', { className: 'oie-dialog-header' },
      el('div', { className: 'oie-dialog-title', id: 'oie-export-dialog-title' },
        el('span', { icon: 'download' }),
        el('span', { textContent: '导出文件' }),
      ),
      el('button', {
        className: 'oie-dialog-close',
        title: '关闭 (Esc)',
        'aria-label': '关闭',
        onClick: close,
      },
        el('span', { icon: 'close' }),
      ),
    );

    // Body
    const body = el('div', { className: 'oie-dialog-body' });

    // 键盘导航：Esc 关闭，Enter 确认导出（排除输入控件），Tab 焦点陷阱
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Enter' && tree.length > 0) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
          return; // 在输入控件中按 Enter 不触发导出
        }
        e.preventDefault();
        exportBtn.click();
      } else if (e.key === 'Tab') {
        // 焦点陷阱：Tab 循环在对话框内
        const focusable = dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'oie-export-dialog-title');
    dialog.tabIndex = -1;

    // Info bar
    body.appendChild(
      el('div', { className: 'oie-info-bar' },
        el('span', { icon: 'info' }),
        el('span', { textContent: `当前面板包含 ${blockCount} 个块，${tree.length} 个根节点` }),
      )
    );

    // Config bar
    const configBar = el('div', { className: 'oie-config-bar' });

    // Style select
    const styleSelect = el('select', { className: 'oie-select' },
      [el('option', { value: 'logseq', textContent: 'Logseq' }),
       el('option', { value: 'obsidian', textContent: 'Obsidian' }),
       el('option', { value: 'orca', textContent: 'Orca Note' }),
       el('option', { value: 'siyuan', textContent: 'SiYuan (思源)' })]
    ) as HTMLSelectElement;
    styleSelect.value = style;

    // Format select
    const formatSelect = el('select', { className: 'oie-select' }) as HTMLSelectElement;

    // Max depth select
    const depthSelect = el('select', { className: 'oie-select' },
      [el('option', { value: '2', textContent: 'H1~H2' }),
       el('option', { value: '3', textContent: 'H1~H3' }),
       el('option', { value: '4', textContent: 'H1~H4' }),
       el('option', { value: '6', textContent: 'H1~H6' })]
    ) as HTMLSelectElement;
    depthSelect.value = String(maxDepth);

    // Body mode select
    const bodyModeSelect = el('select', { className: 'oie-select' },
      [el('option', { value: 'include', textContent: '保留正文' }),
       el('option', { value: 'onlyH', textContent: '仅标题' })]
    ) as HTMLSelectElement;
    bodyModeSelect.value = bodyMode;

    // Rich text checkbox
    const richTextCheckbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
    richTextCheckbox.checked = richText;

    // Filename input
    const filenameInput = el('input', {
      type: 'text',
      className: 'oie-input',
      placeholder: '文件名',
      style: { width: '120px' }
    }) as HTMLInputElement;
    filenameInput.value = filename;

    configBar.append(
      el('div', { className: 'oie-opt-group' },
        el('label', { className: 'oie-opt-label', textContent: '样式' }),
        styleSelect,
      ),
      el('div', { className: 'oie-opt-group' },
        el('label', { className: 'oie-opt-label', textContent: '格式' }),
        formatSelect,
      ),
      el('div', { className: 'oie-opt-group' },
        el('label', { className: 'oie-opt-label', textContent: '最大深度' }),
        depthSelect,
      ),
      el('div', { className: 'oie-opt-group' },
        el('label', { className: 'oie-opt-label', textContent: '正文处理' }),
        bodyModeSelect,
      ),
      el('div', { className: 'oie-opt-group' },
        el('label', { className: 'oie-opt-label', textContent: '文件名' }),
        filenameInput,
      ),
    );
    body.appendChild(configBar);

    // 导出挖空模式行（独立一行，与导入对话框一致）
    const EXPORT_CLOZE_SYNTAX_OPTIONS: { value: string; label: string }[] = [
      { value: 'cloze-idx-bracket', label: '[[c1::xx]]' },
      { value: 'bracket', label: '[[xx]]' },
      { value: 'brace', label: '{{xx}}' },
      { value: 'tortoise', label: '〖xx〗' },
      { value: 'bold', label: '**xx**' },
      { value: 'bold-italic', label: '***xx***' },
      { value: 'italic', label: '*xx*' },
      { value: 'quote', label: '"xx"' },
    ];

    const exportClozeModeCheckbox = el('input', {
      type: 'checkbox',
      checked: exportClozeMode,
    }) as HTMLInputElement;
    const exportClozeModeLabel = el('label', { className: 'oie-checkbox-label' },
      exportClozeModeCheckbox,
      el('span', { textContent: '启用导出挖空' }),
    );

    const exportClozeSyntaxCheckboxes: HTMLInputElement[] = [];
    const exportClozeSyntaxGroup = el('div', { className: 'oie-cloze-syntax-group' });
    for (const opt of EXPORT_CLOZE_SYNTAX_OPTIONS) {
      const cb = el('input', {
        type: 'checkbox',
        checked: exportClozeSyntax.includes(opt.value),
      }) as HTMLInputElement;
      exportClozeSyntaxCheckboxes.push(cb);
      const cbLabel = el('label', { className: 'oie-cloze-syntax-item' },
        cb,
        el('span', { textContent: opt.label }),
      );
      exportClozeSyntaxGroup.appendChild(cbLabel);
    }

    // 导出挖空行（去掉多余的"样式设置"标题）
    const exportClozeRow = el('div', { className: 'oie-config-bar' },
      el('div', { className: 'oie-opt-group oie-opt-group-inline' },
        el('label', { className: 'oie-opt-label', textContent: '挖空' }),
        exportClozeModeLabel,
        exportClozeSyntaxGroup,
      ),
    );
    body.appendChild(exportClozeRow);

    // 监听挖空模式开关
    exportClozeModeCheckbox.addEventListener('change', () => {
      exportClozeMode = exportClozeModeCheckbox.checked;
      exportClozeSyntaxGroup.style.opacity = exportClozeMode ? '1' : '0.4';
      exportClozeSyntaxGroup.style.pointerEvents = exportClozeMode ? 'auto' : 'none';
      updateContent();
    });

    // 监听挖空语法复选框变化
    const updateExportClozeSyntax = () => {
      exportClozeSyntax = exportClozeSyntaxCheckboxes
        .map((cb, i) => cb.checked ? EXPORT_CLOZE_SYNTAX_OPTIONS[i].value : null)
        .filter((v): v is string => v !== null);
      updateContent();
    };
    for (const cb of exportClozeSyntaxCheckboxes) {
      cb.addEventListener('change', updateExportClozeSyntax);
    }

    // 初始化选择器状态
    exportClozeSyntaxGroup.style.opacity = exportClozeMode ? '1' : '0.4';
    exportClozeSyntaxGroup.style.pointerEvents = exportClozeMode ? 'auto' : 'none';

    // Sub-tabs + 工具按钮（同一行）— 富文本开关与预览/源码标签放在同一行
    const subTabs = el('div', { className: 'oie-sub-tabs oie-sub-tabs-row' });
    const richTextToggle = el('label', { className: 'oie-tab-inline-checkbox' },
      richTextCheckbox,
      el('span', { textContent: '富文本' }),
    );
    const previewTab = el('div', { className: 'oie-sub-tab' + (subTab === 'preview' ? ' active' : ''), textContent: '预览' });
    const codeTab = el('div', { className: 'oie-sub-tab' + (subTab === 'code' ? ' active' : ''), textContent: '源码' });
    subTabs.append(richTextToggle, previewTab, codeTab);

    // 操作按钮组（与"预览（高亮）"标签平齐）
    // 视觉层次：主要操作（导出）用 primary，次要操作（复制、取消）用 secondary，工具按钮用 ghost
    const toolbarGroup = el('div', { className: 'oie-toolbar-group' });

    // 折叠状态切换按钮（合并展开/折叠为一个按钮）
    let isFolded = false;
    const foldToggleBtn = el('button', { className: 'oie-btn oie-btn-ghost oie-btn-sm', title: '切换折叠状态' },
      el('span', { icon: 'chevronDown' }),
      el('span', { textContent: '全部展开' }),
    ) as HTMLButtonElement;
    
    const refreshBtn = el('button', { className: 'oie-btn oie-btn-ghost oie-btn-sm', title: '刷新预览' },
      el('span', { icon: 'refresh' }),
      el('span', { textContent: '刷新' }),
    );
    const copyBtn = el('button', { className: 'oie-btn oie-btn-secondary oie-btn-sm' },
      el('span', { icon: 'copy' }),
      el('span', { textContent: '复制' }),
    );
    const exportBtn = el('button', { className: 'oie-btn oie-btn-primary oie-btn-sm' },
      el('span', { icon: 'download' }),
      el('span', { textContent: '导出' }),
    ) as HTMLButtonElement;
    const cancelBtn = el('button', { className: 'oie-btn oie-btn-secondary oie-btn-sm', textContent: '取消', onClick: close });
    toolbarGroup.append(foldToggleBtn, refreshBtn, copyBtn, cancelBtn, exportBtn);

    subTabs.appendChild(toolbarGroup);
    body.appendChild(subTabs);

    // Content area
    const contentArea = el('div');
    body.appendChild(contentArea);

    const footer = el('div', { className: 'oie-dialog-footer' },
      el('span', {
        className: 'oie-footer-hint',
        textContent: '提示：在工具栏选择样式与格式，预览会实时更新'
      }),
    );

    // 注意：挂载在事件绑定后统一执行，避免"可见但无响应"窗口期

    function updateFormatOptions() {
      formatSelect.innerHTML = '';
      const formats = FORMAT_OPTIONS[style];
      for (const fmt of formats) {
        const opt = el('option', { value: fmt.value, textContent: fmt.label });
        formatSelect.appendChild(opt);
      }
      if (!formats.some(f => f.value === format)) {
        format = formats[0].value;
      }
      formatSelect.value = format;
    }

    function getOpts(): ExportOptions {
      const settings = getSettings();
      return {
        style,
        format,
        richText,
        maxDepth,
        bodyMode,
        sourceFormat,
        filename,
        wordHighlightMode: settings.wordHighlightMode,
        exportClozeMode,
        exportClozeSyntax,
      };
    }

    function updateContent() {
      contentArea.innerHTML = '';
      if (tree.length === 0) {
        contentArea.appendChild(el('div', { className: 'oie-preview-placeholder', textContent: '无内容' }));
        return;
      }

      if (subTab === 'preview') {
        const previewHTML = renderExportPreview(tree, getOpts());
        contentArea.appendChild(el('div', {
          className: 'oie-preview-view',
          innerHTML: previewHTML || '<span class="oie-preview-placeholder">无内容</span>'
        }));
      } else {
        const result = exportTree(tree, getOpts());
        let text = result.content.substring(0, 5000);
        if (result.content.length > 5000) text += '\n\n...(内容过长，请下载完整文件)';
        contentArea.appendChild(el('div', { className: 'oie-code-view', textContent: text }));
      }
    }

    styleSelect.addEventListener('change', () => {
      style = styleSelect.value as ExportStyle;
      updateFormatOptions();
      updateContent();
    });
    formatSelect.addEventListener('change', () => {
      format = formatSelect.value as ExportFormat;
      updateContent();
    });
    depthSelect.addEventListener('change', () => {
      maxDepth = parseInt(depthSelect.value);
      updateContent();
    });
    bodyModeSelect.addEventListener('change', () => {
      bodyMode = bodyModeSelect.value as 'include' | 'onlyH';
      updateContent();
    });
    richTextCheckbox.addEventListener('change', () => {
      richText = richTextCheckbox.checked;
      updateContent();
    });
    filenameInput.addEventListener('input', () => {
      // 过滤非法文件名字符
      filename = filenameInput.value.replace(/[\\/:*?"<>|\r\n\t]/g, '_');
    });

    previewTab.addEventListener('click', () => {
      subTab = 'preview';
      previewTab.className = 'oie-sub-tab active';
      codeTab.className = 'oie-sub-tab';
      updateContent();
    });
    codeTab.addEventListener('click', () => {
      subTab = 'code';
      codeTab.className = 'oie-sub-tab active';
      previewTab.className = 'oie-sub-tab';
      updateContent();
    });

    refreshBtn.addEventListener('click', () => {
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => { refreshBtn.style.transform = ''; }, 300);
      updateContent();
      orca.notify('info', '预览已刷新');
    });

    exportBtn.addEventListener('click', () => {
      if (tree.length === 0) return;
      exportBtn.disabled = true;
      exportBtn.classList.add('oie-btn-pulse');
      orca.notify('info', '正在准备导出...', { title: '导出中' });

      setTimeout(async () => {
        try {
          const result = exportTree(tree, getOpts());
          const status = await downloadFile(result.content, result.filename + '.' + result.extension, result.mimeType);
          if (status === 'downloaded') {
            orca.notify('success', `已导出 ${result.filename}.${result.extension}`, { title: '导出成功' });
          } else if (status === 'cancelled') {
            orca.notify('info', '已取消导出', { title: '导出取消' });
          } else {
            // 兜底：复制到剪贴板
            await navigator.clipboard.writeText(result.content);
            orca.notify('success', '下载失败，已复制到剪贴板', { title: '导出成功（剪贴板）' });
          }
        } catch (err) {
          orca.notify('error', `导出失败: ${err instanceof Error ? err.message : String(err)}`, { title: '导出错误' });
        } finally {
          exportBtn.disabled = false;
          exportBtn.classList.remove('oie-btn-pulse');
          close();
        }
      }, 100);
    });

    copyBtn.addEventListener('click', () => {
      if (tree.length === 0) return;
      const result = exportTree(tree, getOpts());
      navigator.clipboard.writeText(result.content).then(() => {
        orca.notify('success', '已复制到剪贴板');
      }).catch(() => {
        orca.notify('error', '复制失败');
      });
    });

    foldToggleBtn.addEventListener('click', async () => {
      foldToggleBtn.disabled = true;
      try {
        isFolded = !isFolded;
        await setAllBlocksFolded(isFolded);

        // 更新按钮图标和文本
        const iconSpan = foldToggleBtn.querySelector('span:first-child') as HTMLElement | null;
        const textSpan = foldToggleBtn.querySelector('span:last-child');
        if (iconSpan && textSpan) {
          if (isFolded) {
            setIcon(iconSpan, 'chevronDown');
            textSpan.textContent = '全部展开';
          } else {
            setIcon(iconSpan, 'chevronUp');
            textSpan.textContent = '全部折叠';
          }
        }

        // 折叠状态变更后刷新预览
        setTimeout(() => updateContent(), 200);
      } finally {
        foldToggleBtn.disabled = false;
      }
    });

    // Initial render
    updateFormatOptions();
    updateContent();

    dialog.append(header, body, footer);
    document.body.appendChild(overlay);
    // 自动聚焦对话框以启用键盘导航
    setTimeout(() => dialog.focus(), 50);

    function close() {
      overlay.remove();
    }
  } catch (err) {
    orca.notify('error', `创建导出对话框失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// CONTEXT MENU (原生 DOM)
// ============================================================

export function showContextMenu(
  x: number,
  y: number,
  blockId: string | null,
  onImport: () => void,
  onExport: () => void,
  onClearEmpty: () => void,
) {
  injectStyles();

  const existing = document.getElementById('oie-context-menu-container');
  if (existing) existing.remove();

  const container = el('div', { id: 'oie-context-menu-container' });
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  const menu = el('div', {
    className: 'oie-context-menu oie-themed',
    style: { left: adjustedX + 'px', top: adjustedY + 'px' }
  },
    el('div', { className: 'oie-context-menu-header', textContent: '导入 / 导出' }),
    el('div', { className: 'oie-dropdown-item', onClick: () => { close(); onImport(); } },
      el('span', { className: 'oie-dropdown-item-icon', icon: 'upload' }),
      el('span', { textContent: '导入文件到此处' }),
    ),
    el('div', { className: 'oie-dropdown-item', onClick: () => { close(); onExport(); } },
      el('span', { className: 'oie-dropdown-item-icon', icon: 'download' }),
      el('span', { textContent: '导出当前笔记' }),
    ),
    el('div', { className: 'oie-dropdown-divider' }),
    el('div', { className: 'oie-dropdown-item', onClick: () => { close(); onClearEmpty(); } },
      el('span', { className: 'oie-dropdown-item-icon', icon: 'trash' }),
      el('span', { textContent: '清除当前页空块' }),
    ),
  );

  container.appendChild(menu);
  document.body.appendChild(container);

  function handleClickOutside(e: MouseEvent) {
    if (!menu.contains(e.target as Node)) {
      close();
    }
  }
  setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
  }, 0);

  function close() {
    document.removeEventListener('mousedown', handleClickOutside);
    container.remove();
  }
}

// ============================================================
// HEADBAR BUTTON (使用 window.React，由 Orca 渲染树渲染)
// ============================================================

// HeadbarButton 用 window.React（由 Orca 渲染树渲染）
// P1 修复：延迟获取 React，避免模块加载时 React 尚未就绪
const getReact = (): any => {
  const R = (window as any).React;
  if (!R?.createElement) {
    throw new Error('React 未就绪，headbar 按钮不可用');
  }
  return R;
};

export function createHeadbarButton(onImport: () => void, onExport: () => void, onClearEmpty: () => void): any {
  injectStyles();
  return getReact().createElement(HeadbarButton, { onImport, onExport, onClearEmpty });
}

function HeadbarButton({ onImport, onExport, onClearEmpty }: { onImport: () => void; onExport: () => void; onClearEmpty: () => void }) {
  const R = getReact();
  const [open, setOpen] = R.useState(false);
  const ref = R.useRef(null);

  R.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Inline SVG strings - 改用 React.createElement 树，避免 dangerouslySetInnerHTML
  // 导入图标：向上箭头
  const uploadIconEl = R.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
    R.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    R.createElement('polyline', { points: '17 8 12 3 7 8' }),
    R.createElement('line', { x1: 12, y1: 3, x2: 12, y2: 15 }),
  );

  // 导出图标：向下箭头
  const downloadIconEl = R.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
    R.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    R.createElement('polyline', { points: '7 10 12 15 17 10' }),
    R.createElement('line', { x1: 12, y1: 15, x2: 12, y2: 3 }),
  );

  // 切换图标：双向箭头
  const exchangeIconEl = R.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
    R.createElement('polyline', { points: '17 1 21 5 17 9' }),
    R.createElement('path', { d: 'M3 11V9a4 4 0 0 1 4-4h14' }),
    R.createElement('polyline', { points: '7 23 3 19 7 15' }),
    R.createElement('path', { d: 'M21 13v2a4 4 0 0 1-4 4H3' }),
  );

  // 清除空块图标：垃圾桶
  const trashIconEl = R.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
    R.createElement('polyline', { points: '3 6 5 6 21 6' }),
    R.createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
    R.createElement('line', { x1: 10, y1: 11, x2: 10, y2: 17 }),
    R.createElement('line', { x1: 14, y1: 11, x2: 14, y2: 17 }),
  );

  return R.createElement(
    'div',
    { ref, style: { position: 'relative', display: 'inline-flex' } },
    R.createElement(
      'button',
      {
        className: 'oie-headbar-btn',
        onClick: () => setOpen(!open),
        title: '导入 / 导出',
        'aria-label': '导入 / 导出',
        'aria-expanded': open,
      },
      R.createElement('span', {
        className: 'oie-headbar-btn-icon',
      }, exchangeIconEl)
    ),
    open && R.createElement(
      'div',
      { className: 'oie-dropdown', role: 'menu' },
      R.createElement(
        'div',
        {
          className: 'oie-dropdown-item',
          role: 'menuitem',
          tabIndex: 0,
          onClick: () => { setOpen(false); onImport(); },
          onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(false); onImport(); } },
        },
        R.createElement('span', { className: 'oie-dropdown-item-icon' }, uploadIconEl),
        R.createElement('span', null, '导入文件')
      ),
      R.createElement('div', { className: 'oie-dropdown-divider' }),
      R.createElement(
        'div',
        {
          className: 'oie-dropdown-item',
          role: 'menuitem',
          tabIndex: 0,
          onClick: () => { setOpen(false); onExport(); },
          onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(false); onExport(); } },
        },
        R.createElement('span', { className: 'oie-dropdown-item-icon' }, downloadIconEl),
        R.createElement('span', null, '导出文件')
      ),
      R.createElement('div', { className: 'oie-dropdown-divider' }),
      R.createElement(
        'div',
        {
          className: 'oie-dropdown-item',
          role: 'menuitem',
          tabIndex: 0,
          onClick: () => { setOpen(false); onClearEmpty(); },
          onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(false); onClearEmpty(); } },
        },
        R.createElement('span', { className: 'oie-dropdown-item-icon' }, trashIconEl),
        R.createElement('span', null, '清除当前页空块')
      )
    )
  );
}

export { removeStyles };
