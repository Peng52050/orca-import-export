#!/usr/bin/env node
// ============================================================
// orca-import-export 自动打包脚本
// 每次 vite build 后自动调用 (postbuild)
// 也可单独运行: npm run zip
// ============================================================

import { existsSync, statSync, copyFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 项目根目录
const ROOT = resolve(__dirname, '..');
// 父目录 (与 .zip 同级)
const PARENT = resolve(ROOT, '..');

// 读取 package.json 版本号
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const VERSION = pkg.version || '0.0.0';

// 必要的文件/目录（CONTRIBUTING 要求：package.json, dist/, LICENSE, icon）
const REQUIRED = [
  { src: join(ROOT, 'dist'), type: 'dir',  name: 'dist/' },
  { src: join(ROOT, 'icon.png'), type: 'file', name: 'icon.png' },
  { src: join(ROOT, 'package.json'), type: 'file', name: 'package.json' },
  { src: join(ROOT, 'LICENSE'), type: 'file', name: 'LICENSE' },
  { src: join(ROOT, 'README.md'), type: 'file', name: 'README.md' },
];

// 临时目录
const TMP_DIR = join(PARENT, '.tmp_zip_build');
const STAGE_DIR = join(TMP_DIR, 'orca-import-export');

// ★ 带版本和日期的 zip 文件名: orca-import-export_v2.6.0_20260703_171349.zip
function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
const ZIP_FILE = join(PARENT, `orca-import-export_v${VERSION}_${getTimestamp()}.zip`);

const PLUGIN_NAME = 'orca-import-export';
const isWindows = process.platform === 'win32';

function log(tag, msg) {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
  };
  const color = tag === 'OK' ? colors.green : tag === 'WARN' ? colors.yellow : tag === 'ERR' ? colors.red : colors.cyan;
  console.log(`${color}[${tag}]${colors.reset} ${msg}`);
}

function checkPrereqs() {
  log('INFO', `工作目录: ${ROOT}`);
  for (const item of REQUIRED) {
    if (!existsSync(item.src)) {
      log('WARN', `缺少 ${item.name} (${item.src})`);
      if (item.name === 'dist/') {
        log('ERR', 'dist 目录不存在，请先运行 npm run build');
        process.exit(1);
      }
      log('WARN', `跳过 ${item.name}`);
    } else {
      const size = statSync(item.src).size;
      log('OK', `找到 ${item.name} (${formatSize(size)})`);
    }
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function copyRecursive(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function stageFiles() {
  log('INFO', `准备暂存目录: ${STAGE_DIR}`);
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(STAGE_DIR, { recursive: true });

  for (const item of REQUIRED) {
    if (!existsSync(item.src)) continue;
    const dest = join(STAGE_DIR, item.name.replace(/\/$/, ''));
    if (item.type === 'dir') {
      log('OK', `拷贝目录 ${item.name}`);
      copyRecursive(item.src, dest);
    } else {
      log('OK', `拷贝文件 ${item.name}`);
      copyFileSync(item.src, dest);
    }
  }
}

function zipWithPowerShell() {
  log('INFO', '使用 PowerShell Compress-Archive 打包...');
  // 清理旧的固定名称 zip（兼容历史版本）
  const oldZip = join(PARENT, 'orca-import-export.zip');
  if (existsSync(oldZip)) {
    rmSync(oldZip);
    log('OK', '已删除旧版固定名称 zip');
  }
  // 清理超过 10 个的旧版本 zip（保留最近 10 个）
  try {
    const files = readdirSync(PARENT)
      .filter(f => f.startsWith('orca-import-export_v') && f.endsWith('.zip'))
      .map(f => ({ name: f, mtime: statSync(join(PARENT, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        rmSync(join(PARENT, files[i].name));
        log('OK', `清理旧 zip: ${files[i].name}`);
      }
    }
  } catch (e) {
    // 忽略清理错误
  }
  const psScript = `
$ErrorActionPreference = 'Stop'
Compress-Archive -Path "${STAGE_DIR}" -DestinationPath "${ZIP_FILE}" -Force
`;
  // 在 Windows 上优先查找 powershell.exe 完整路径（TRAE IDE 终端可能 PATH 不含 System32）
  const psCandidates = [
    'powershell',
    'powershell.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    process.env.SystemRoot ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe` : '',
  ].filter(Boolean);
  let result = null;
  let lastErr = null;
  for (const ps of psCandidates) {
    try {
      result = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        stdio: 'inherit',
        shell: false,
      });
      if (result.status === 0 || result.error === undefined) break;
    } catch (e) {
      lastErr = e;
    }
    if (result && result.status === 0) break;
  }
  if (!result || result.status !== 0) {
    log('ERR', `PowerShell 打包失败${lastErr ? ': ' + lastErr.message : ''}`);
    process.exit(1);
  }
}

function zipWithNode() {
  // 简易 zip 实现 (使用 Node 内置能力：写入 .zip 头 + 中心目录)
  // 注: 实际生产环境建议使用 archiver，这里给出最小化实现
  log('WARN', '非 Windows 平台: 此脚本主要面向 Windows PowerShell');
  log('ERR', '未实现跨平台 zip，请使用 archiver 或手动打包');
  process.exit(1);
}

function cleanup() {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
    log('OK', '清理临时目录');
  }
}

function main() {
  log('INFO', `=== ${PLUGIN_NAME} 自动打包 ===`);
  try {
    checkPrereqs();
    stageFiles();
    if (isWindows) {
      zipWithPowerShell();
    } else {
      zipWithNode();
    }
    const finalSize = statSync(ZIP_FILE).size;
    log('OK', `=== 打包完成: ${ZIP_FILE} (${formatSize(finalSize)}) ===`);
  } catch (err) {
    log('ERR', `打包失败: ${err.message}`);
    process.exit(1);
  } finally {
    cleanup();
  }
}

main();
