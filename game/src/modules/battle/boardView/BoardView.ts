/**
 * 盤面畫面（直接操作 DOM，不經 React，每禎只改 transform）。
 * 負責：小兵的顯示與動畫、拖曳操作、消除 → 補位 → 連鎖的演出。規則本身在 ../board/。
 * 座標見 ./boardGeometry.ts；動作時間全部取自 ../timing/battleTiming.ts（毫秒）。
 */
import { currentStage, translateUnits, designUnit } from '@core/stage/stage';
import { wait } from '@core/animation/animate';
import { matchTiming } from '../timing/battleTiming';
import {
  applyDragPath, BOARD_COLUMNS, BOARD_ROWS, findMatchGroups, refillUpward, removeMatchGroups,
  type BoardGrid, type Cell, type MatchGroup, type NextPieceKind, type Piece,
} from '../board/boardRules';
import { BOARD_HEIGHT, CELL_SIZE, cellCenterX, cellCenterY } from './boardGeometry';
import { createComboLabel } from './comboLabel';
import { paintPieceSprite, type PiecePose } from './pieceSprite';

type PieceMotion = 'stand' | 'hold' | 'walk';
/** 一個小兵在畫面上的狀態 */
interface PieceView { piece: Piece; element: HTMLDivElement; sprite: HTMLElement; motion: PieceMotion; motionStartedAt: number; pose: PiecePose | ''; white: boolean }
interface DragState { view: PieceView; cell: Cell; path: Cell[]; pointerId: number }

export interface BoardViewHooks {
  /** 一組的格子空出時（魂柱從該組中心升起），x,y＝盤面座標的組中心 */
  onGroupVanished?: (group: MatchGroup, x: number, y: number) => void;
  /** 一組消除開始（第 combo 連擊） */
  onGroupCleared?: (group: MatchGroup, combo: number) => void;
  /** 補位用的新小兵種類 */
  nextKind: NextPieceKind;
}

/** 走路動畫的禎序 */
const WALK_POSES = ['walkA', 'stand', 'walkB', 'stand'] as const;

export class BoardView {
  readonly element: HTMLDivElement;
  private views = new Map<number, PieceView>();
  private grid: BoardGrid = [];
  private frameId = 0;
  private comboLabels: HTMLElement[] = [];
  private drag: DragState | null = null;
  /** 教學：只允許照這條路徑拖曳 */
  forcedPath: Cell[] | null = null;
  /** true＝不接受拖曳（演出中、對話中） */
  isLocked = true;
  /** 玩家放開手指（完成一次移動）時呼叫 */
  onMoveEnd: ((path: Cell[]) => void) | null = null;

  constructor(host: HTMLElement, private hooks: BoardViewHooks) {
    this.element = document.createElement('div');
    this.element.className = 'battle-board';
    host.appendChild(this.element);
    this.element.addEventListener('pointerdown', this.onPointerDown);
    const loop = (now: number) => { this.updateMotions(now); this.frameId = requestAnimationFrame(loop); };
    this.frameId = requestAnimationFrame(loop);
  }

  destroy() { cancelAnimationFrame(this.frameId); this.element.remove(); }

  get currentGrid(): BoardGrid { return this.grid; }

  /** 放上整個盤面（不動畫） */
  setGrid(grid: BoardGrid) {
    this.views.forEach((view) => view.element.remove());
    this.views.clear();
    this.grid = grid;
    for (let row = 0; row < BOARD_ROWS; row++) for (let col = 0; col < BOARD_COLUMNS; col++) {
      const piece = grid[row]![col];
      if (piece) this.placeView(this.createView(piece), cellCenterX(col), cellCenterY(row));
    }
  }

  /** 開場：小兵由盤面下方一列一列走上來（v5 108775～109845） */
  async playIntro(rowDelayMs = 107) {
    for (const view of this.views.values()) view.element.style.opacity = '0';
    const walks: Promise<void>[] = [];
    for (let row = 0; row < BOARD_ROWS; row++) for (let col = 0; col < BOARD_COLUMNS; col++) {
      const view = this.views.get(this.grid[row]![col]!.id)!;
      const fromY = cellCenterY(BOARD_ROWS + 0.5), toY = cellCenterY(row);
      walks.push(wait((BOARD_ROWS - 1 - row) * rowDelayMs).then(() => {
        view.element.style.opacity = '1';
        return this.walkTo(view, cellCenterX(col), fromY, cellCenterX(col), toY, matchTiming.refillMs + row * 40);
      }));
    }
    await Promise.all(walks);
  }

  // ---------- 繪製 ----------
  private createView(piece: Piece): PieceView {
    const element = document.createElement('div');
    element.className = 'piece';
    const sprite = document.createElement('i');
    element.appendChild(sprite);
    this.element.appendChild(element);
    const view: PieceView = { piece, element, sprite, motion: 'stand', motionStartedAt: 0, pose: '', white: false };
    this.views.set(piece.id, view);
    this.setPose(view, 'stand');
    return view;
  }

  private placeView(view: PieceView, x: number, y: number) { view.element.style.transform = translateUnits(x, y); }

  private setPose(view: PieceView, pose: PiecePose, white = false) {
    if (view.pose === pose && view.white === white) return;
    view.pose = pose; view.white = white;
    paintPieceSprite(view.sprite, view.piece.kind, pose, white);
  }

  /** 每禎更新拿起中、走路中小兵的換圖 */
  private updateMotions(now: number) {
    for (const view of this.views.values()) {
      const elapsed = now - view.motionStartedAt;
      if (view.motion === 'hold') this.setPose(view, Math.floor(elapsed / matchTiming.pickUpFrameMs) % 2 ? 'holdB' : 'holdA', view.white);
      else if (view.motion === 'walk') this.setPose(view, WALK_POSES[Math.floor(elapsed / matchTiming.walkFrameMs) % 4]!, view.white);
    }
  }

  private walkTo(view: PieceView, fromX: number, fromY: number, toX: number, toY: number, durationMs: number) {
    view.motion = 'walk'; view.motionStartedAt = performance.now();
    return view.element.animate([{ transform: translateUnits(fromX, fromY) }, { transform: translateUnits(toX, toY) }], { duration: durationMs, easing: 'linear', fill: 'forwards' })
      .finished.then(() => {
        this.placeView(view, toX, toY);
        view.element.getAnimations().forEach((animation) => animation.cancel());
        view.motion = 'stand';
        this.setPose(view, 'stand');
      });
  }

  // ---------- 拖曳 ----------
  /** 指標位置 → 盤面設計座標 */
  private toBoardPoint(event: PointerEvent) {
    const rect = this.element.getBoundingClientRect(), unitPx = currentStage.unitPx;
    return { x: (event.clientX - rect.left) / unitPx, y: (event.clientY - rect.top) / unitPx };
  }

  private cellAt(x: number, y: number): Cell | null {
    const col = Math.floor(x / CELL_SIZE), row = Math.floor(y / CELL_SIZE);
    return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLUMNS ? { row, col } : null;
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.isLocked || this.drag) return;
    const { x, y } = this.toBoardPoint(event), cell = this.cellAt(x, y);
    if (!cell) return;
    const forcedStart = this.forcedPath?.[0];
    if (forcedStart && (cell.row !== forcedStart.row || cell.col !== forcedStart.col)) return;
    const piece = this.grid[cell.row]![cell.col];
    if (!piece) return;
    const view = this.views.get(piece.id)!;
    this.drag = { view, cell, path: [cell], pointerId: event.pointerId };
    this.element.setPointerCapture(event.pointerId);
    view.motion = 'hold'; view.motionStartedAt = performance.now();
    view.element.classList.add('is-held');
    this.placeView(view, x + matchTiming.pickUpOffset.x, y + matchTiming.pickUpOffset.y);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerUp);
  };

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { x, y } = this.toBoardPoint(event);
    this.placeView(drag.view, Math.max(0, Math.min(640, x)) + matchTiming.pickUpOffset.x, Math.max(0, Math.min(BOARD_HEIGHT, y)) + matchTiming.pickUpOffset.y);
    const target = this.cellAt(Math.max(0, Math.min(639, x)), Math.max(0, Math.min(BOARD_HEIGHT - 1, y)));
    if (!target || (target.row === drag.cell.row && target.col === drag.cell.col)) return;
    if (Math.abs(target.row - drag.cell.row) > 1 || Math.abs(target.col - drag.cell.col) > 1) return;
    if (this.forcedPath) {
      const expected = this.forcedPath[drag.path.length];
      if (!expected || expected.row !== target.row || expected.col !== target.col) return;
    }
    // 交換：被換到的小兵走到手上小兵原本的格子
    const swappedView = this.views.get(this.grid[target.row]![target.col]!.id)!;
    applyDragPath(this.grid, [drag.cell, target]);
    void this.walkTo(swappedView, cellCenterX(target.col), cellCenterY(target.row), cellCenterX(drag.cell.col), cellCenterY(drag.cell.row), matchTiming.swapMoveMs);
    drag.cell = target; drag.path.push(target);
    if (this.forcedPath && drag.path.length === this.forcedPath.length) this.onPointerUp(event);
  };

  private onPointerUp = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    this.drag = null;
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    drag.view.motion = 'stand'; drag.view.element.classList.remove('is-held'); this.setPose(drag.view, 'stand');
    this.placeView(drag.view, cellCenterX(drag.cell.col), cellCenterY(drag.cell.row));
    if (drag.path.length > 1 || !this.forcedPath) this.onMoveEnd?.(drag.path);
  };

  // ---------- 消除與補位 ----------
  /** 執行消除 → 補位 → 連鎖，回傳所有消除組（依順序） */
  async resolveMatches(): Promise<MatchGroup[]> {
    const allGroups: MatchGroup[] = [];
    await wait(matchTiming.releaseToFirstClearMs);
    for (;;) {
      const groups = findMatchGroups(this.grid);
      if (!groups.length) break;
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!;
        allGroups.push(group);
        this.playGroupClear(group, allGroups.length);
        this.hooks.onGroupCleared?.(group, allGroups.length);
        await wait(i < groups.length - 1 ? matchTiming.groupIntervalMs : matchTiming.lastClearToRefillMs);
      }
      removeMatchGroups(this.grid, groups);
      const moves = refillUpward(this.grid, this.hooks.nextKind);
      await Promise.all(moves.map((move) => {
        const view = move.isNew ? this.createView(move.piece) : this.views.get(move.piece.id)!;
        return this.walkTo(view, cellCenterX(move.col), cellCenterY(move.fromRow), cellCenterX(move.col), cellCenterY(move.toRow), matchTiming.refillMs);
      }));
      await wait(matchTiming.refillToCascadeMs);
    }
    return allGroups;
  }

  /**
   * 一組消除（v1 118 900～119 133）：純白剪影 67 ms → 帶粉紅光忽大忽小 166 ms → 格子空出，交給 onGroupVanished 做魂柱。
   * 白剪影是 puzzle_image 圖集裡同姿勢的白色零件。
   */
  private playGroupClear(group: MatchGroup, combo: number) {
    const centerX = group.cells.reduce((sum, cell) => sum + cellCenterX(cell.col), 0) / group.cells.length;
    const centerY = group.cells.reduce((sum, cell) => sum + cellCenterY(cell.row), 0) / group.cells.length;
    const clearedElements: HTMLElement[] = [];
    const totalMs = matchTiming.clearWhiteMs + matchTiming.clearGlowMs;
    const offsetAt = (ms: number) => ms / totalMs;
    const glow = (blur: number, color: string) => `drop-shadow(0 0 ${designUnit(blur)} ${color})`;
    for (const cell of group.cells) {
      const piece = this.grid[cell.row]![cell.col]!;
      const view = this.views.get(piece.id)!;
      this.views.delete(piece.id);
      view.motion = 'stand';
      this.setPose(view, 'stand', true);
      clearedElements.push(view.element);
      const baseTransform = view.sprite.style.transform;
      view.sprite.animate([
        { transform: `${baseTransform} scale(1)`, filter: 'none', offset: 0 },
        { transform: `${baseTransform} scale(1)`, filter: 'none', offset: offsetAt(matchTiming.clearWhiteMs) },
        { transform: `${baseTransform} scale(1.08,1.12)`, filter: glow(8, '#ff8ac8'), opacity: 0.95, offset: offsetAt(matchTiming.clearWhiteMs + 33) },
        { transform: `${baseTransform} scale(.96,1.04)`, filter: glow(10, '#ff9ad0'), opacity: 0.9, offset: offsetAt(matchTiming.clearWhiteMs + 83) },
        { transform: `${baseTransform} scale(1.1,1.15)`, filter: glow(8, '#ffb0dc'), opacity: 0.85, offset: offsetAt(matchTiming.clearWhiteMs + 133) },
        { transform: `${baseTransform} scale(1,1.2)`, filter: glow(6, '#ffc0e0'), opacity: 0.7, offset: 1 },
      ], { duration: totalMs, fill: 'forwards' });
    }
    setTimeout(() => {
      clearedElements.forEach((element) => element.remove());
      this.hooks.onGroupVanished?.(group, centerX, centerY);
    }, totalMs);
    if (combo >= 2) {
      setTimeout(() => void createComboLabel(this.element, combo, centerX, centerY).then((label) => this.comboLabels.push(label)), matchTiming.comboLabelDelayMs);
    }
  }

  /** 第 index 個「N 連擊」字淡出（倍率階段逐個消失，v5 153 933～158 213） */
  fadeComboLabel(index: number) {
    const label = this.comboLabels[index];
    if (label) void label.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 133, fill: 'forwards' });
  }

  clearComboLabels() { this.comboLabels.forEach((label) => label.remove()); this.comboLabels = []; }

  /** 教學指引：整個盤面變暗到約 62%（v5 145 639～148 368 實測：盤面亮度 108 → 65），路徑列不特別提亮。null＝恢復 */
  setGuideDimmed(path: Cell[] | null) {
    for (const view of this.views.values()) view.element.classList.toggle('is-dimmed', !!path);
  }

  /** 演出中整個盤面變暗 */
  setAllDimmed(dimmed: boolean) { this.element.classList.toggle('is-all-dimmed', dimmed); }
}
