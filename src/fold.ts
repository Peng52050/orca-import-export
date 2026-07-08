// ============================================================
// Orca Note 块折叠/展开工具
// 调用 core 后端 API `fold-block` (经 orca.invokeBackend 派发)
// ============================================================

import type { DbId, Block } from './orca.d.ts';

/**
 * 递归遍历块树，对每个有子块的块执行回调
 */
function visitBlocks(
  rootId: DbId,
  blocks: Record<string | DbId, Block>,
  visitor: (blockId: DbId, block: Block) => void,
) {
  const block = blocks[rootId];
  if (!block) return;
  visitor(rootId, block);
  if (block.children) {
    for (const childId of block.children) {
      visitBlocks(childId, blocks, visitor);
    }
  }
}

/**
 * 设置当前面板中所有块的折叠/展开状态
 * 通过 core 后端 API 派发，Orca Note 内部统一处理 foldings
 * @param collapse true=折叠所有，false=展开所有
 * @returns 影响的块数量
 */
export async function setAllBlocksFolded(collapse: boolean): Promise<number> {
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) {
      orca.notify('error', '未找到当前面板');
      return 0;
    }

    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) {
      orca.notify('error', '未找到当前面板');
      return 0;
    }

    // 获取面板根块 ID
    let rootId = panel.viewArgs?.blockId as DbId | undefined;

    // 兜底：尝试用当前光标所在块
    if (rootId === undefined || !state.blocks[rootId]) {
      const cursorBlockId = (panel.viewState as any)?.cursor?.blockId as DbId | undefined;
      if (cursorBlockId && state.blocks[cursorBlockId]) {
        rootId = cursorBlockId;
      } else {
        orca.notify('error', '无法确定当前块');
        return 0;
      }
    }

    // 收集所有需要折叠/展开的块 ID（有子块的块）
    const targetIds: DbId[] = [];
    visitBlocks(rootId, state.blocks, (blockId, block) => {
      if (block.children && block.children.length > 0) {
        targetIds.push(blockId);
      }
    });

    if (targetIds.length === 0) {
      orca.notify('info', '当前面板没有可折叠的块');
      return 0;
    }

    // 通过 core 后端 API 派发折叠/展开命令
    // backend type: 'fold-block', args: (blockId: DbId, fold: boolean)
    let success = 0;
    for (const id of targetIds) {
      try {
        await orca.invokeBackend('fold-block', id, collapse);
        success++;
      } catch (err) {
        console.warn(`[OIE] fold-block failed for id=${id}:`, err);
      }
    }

    orca.notify(
      'success',
      collapse
        ? `已折叠 ${success} 个父块`
        : `已展开 ${success} 个父块`,
    );
    return success;
  } catch (err) {
    console.error('[OIE] setAllBlocksFolded failed:', err);
    orca.notify(
      'error',
      `${collapse ? '折叠' : '展开'}失败: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 0;
  }
}

/**
 * 同步版本（保持向后兼容）
 */
export function setAllBlocksFoldedSync(collapse: boolean): number {
  // 直接使用 viewState.foldings (即时生效，不需要等待后端)
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) {
      orca.notify('error', '未找到当前面板');
      return 0;
    }

    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) return 0;

    if (!panel.viewState) {
      panel.viewState = {};
    }
    const foldings: Record<string, boolean> = panel.viewState.foldings || {};

    let rootId = panel.viewArgs?.blockId as DbId | undefined;
    if (rootId === undefined || !state.blocks[rootId]) {
      const cursorBlockId = (panel.viewState as any)?.cursor?.blockId as DbId | undefined;
      if (cursorBlockId && state.blocks[cursorBlockId]) {
        rootId = cursorBlockId;
      } else {
        orca.notify('error', '无法确定当前块');
        return 0;
      }
    }

    let count = 0;
    visitBlocks(rootId, state.blocks, (blockId, block) => {
      if (!block.children || block.children.length === 0) return;
      if (collapse) {
        foldings[blockId] = true;
      } else {
        delete foldings[blockId];
      }
      count++;
    });

    // 强制触发 valtio 响应式
    panel.viewState.foldings = { ...foldings };

    orca.notify(
      'success',
      collapse ? `已折叠 ${count} 个父块` : `已展开 ${count} 个父块`,
    );
    return count;
  } catch (err) {
    console.error('[OIE] setAllBlocksFoldedSync failed:', err);
    return 0;
  }
}
