/**
 * 盤面畫面（直接操作 DOM，不經 React，每禎只改 transform）。
 * 負責：小兵的顯示與動畫、拖曳操作、消除 → 補位 → 連鎖的演出。規則本身在 ./boardRules.ts。
 * 檔案後段：格子座標、「N 連擊」字、小兵圖（puzzle_image 各姿勢，data/pieces.json）；演出時間在 boardTiming（毫秒）。
 */
import { currentStage, translateUnits, designUnit } from "@core/stage";
import { wait } from "@core/animate";
import { haptics } from "@core/haptics";
import {
  applyDragPath,
  BOARD_COLUMNS,
  createPiece,
  BOARD_ROWS,
  findMatchGroups,
  refillUpward,
  removeMatchGroups,
  type BoardGrid,
  type Cell,
  type MatchGroup,
  type NextPieceKind,
  type Piece,
  type PieceKind,
} from "./boardRules";
import { renderBitmapText } from "@ui";
import { BATTLE_FONTS, fast } from "./battleAssets";
import { getAssetUrl } from "@core/assetLoader";
import pieces from "@data/pieces.json";
import pieceAtlas from "@data/atlas/puzzle_image.json";

/** 盤面的演出時間（毫秒）：開場滑入、拖曳、消除、補位。主要依據 v1（修復展示 720P，30 fps，每禎 33.3 ms）；v5＝亞修實況（18.69 fps）。逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md */
export const boardTiming = {
  /** 盤面開始滑入（108 561，白色退去後一禎） */
  boardRiseDelayMs: 54,
  /** 小兵走進盤面的時間：原版整片滑入 374 ms（108 561 → 108 935，減速）；放慢到約兩步週期，邊走邊進場才看得出在走路 */
  boardRiseMs: 750,
  /** 盤面滑入的起始位移（設計單位，往下；108 561 時整個盤面還在畫面外） */
  boardRiseDistance: 470,
  /** 拿起小兵：手上的小兵在 holdA / holdB 兩張之間交替 */
  pickUpFrameMs: 107,
  /** 拿起時小兵相對手指的位移（設計單位；v1 114 667：往右 15、往上 54） */
  pickUpOffset: { x: 15, y: -54 },
  /** 被換位的小兵走到隔壁格（v1 114 933 → 115 067，4 禎） */
  swapMoveMs: 133,
  /**
   * 被換位的小兵不是直線過去，而是從拿著的小兵下方繞過去：走到三分之一時往下沉一半、三分之二時沉到最深，最後回到格子。
   * 最深處（設計單位）量測自 v5 147 726～147 780（下沉 31 → 64）。
   */
  swapArcDepth: 64,
  /** 格線緩衝（自訂）：手指要越過目標格邊緣「格子寬 × 這個比例」才交換，避免停在格線上來回抖動 */
  swapDeadZoneRatio: 0.2,
  /** 震動回饋（自訂，原版沒有）：拿起、每次交換 */
  pickUpVibrateMs: 12,
  swapVibrateMs: 6,
  /** 放開到第一組消除（v5 148 422 放開 → 148 689 變白） */
  releaseToFirstClearMs: fast(267),
  // ---- 一組消除（t＝變白那一禎，v1 118 900） ----
  /** 純白剪影（v1 118 900～118 967，3 禎） */
  clearWhiteMs: fast(67),
  /** 白剪影帶粉紅光、忽大忽小（118 967～119 100，4 禎） */
  clearGlowMs: fast(166),
  /** 每組間隔（118 900 → 119 433） */
  groupIntervalMs: fast(533),
  /** 第 N 組（N≥2）的「N連擊」字在變白後一禎出現 */
  comboLabelDelayMs: fast(33),
  comboLabelColorMs: fast(160),
  /** 最後一組消除後到補位開始 */
  lastClearToRefillMs: fast(233),
  /** 往上補位：新小兵從盤面下方走上來（v1 120 600 → 120 900）；不加速，走路的姿勢才看得見 */
  refillMs: 300,
  refillToCascadeMs: fast(34),
  /** 走路動畫每張停留（v5 22 151～24 398） */
  walkFrameMs: 107,
  /** 敵人技能改盤面：發白光、變成新種類時彈一下、每個錯開 */
  convertFlashMs: 160,
  convertPopMs: 240,
  convertStaggerMs: 60,
  /** 走路跨步時小兵抬起的高度（設計單位） */
  walkBob: 6,
  /** 「N 連擊」字淡出（倍率階段逐個消失） */
  comboLabelFadeMs: fast(133),
} as const;

/** stand 站著、hold 被拿著、walk 走到別格（補位、交換、開場）、march 原地踏步（前進到下一個合戰） */
type PieceMotion = "stand" | "hold" | "walk" | "march";
/** 一個小兵在畫面上的狀態 */
interface PieceView {
  piece: Piece;
  element: HTMLDivElement;
  sprite: HTMLElement;
  motion: PieceMotion;
  motionStartedAt: number;
  pose: PiecePose | "";
  white: boolean;
  /** 目前正在走的那一段動畫（新的一段開始時取代它） */
  walk: Animation | null;
}
interface DragState {
  view: PieceView;
  cell: Cell;
  path: Cell[];
  pointerId: number;
}

export interface BoardViewHooks {
  /** 一組的格子空出時（魂柱從該組中心升起），x,y＝盤面座標的組中心 */
  onGroupVanished?: (group: MatchGroup, x: number, y: number) => void;
  /** 一組消除開始（第 combo 連擊） */
  onGroupCleared?: (group: MatchGroup, combo: number) => void;
  /** 補位用的新小兵種類 */
  nextKind: NextPieceKind;
}

/** 走路動畫的禎序 */
const WALK_POSES = ["walkA", "stand", "walkB", "stand"] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const isSameCell = (a: Cell, b: Cell) =>
  a.row === b.row && a.col === b.col;
/** 一次 pointermove 中被瀏覽器合併掉的中間點（沒有時就是事件本身） */
export const coalescedSamples = (event: PointerEvent): PointerEvent[] =>
  typeof event.getCoalescedEvents === "function" &&
  event.getCoalescedEvents().length
    ? event.getCoalescedEvents()
    : [event];

/** 格線緩衝：手指要越過「目標格朝向目前格那一側的邊緣」一段距離才算進入（只看有變化的方向，所以盤面最外圈也能換到） */
function hasPassedDeadZone(
  x: number,
  y: number,
  from: Cell,
  target: Cell,
): boolean {
  const inset = CELL_SIZE * boardTiming.swapDeadZoneRatio;
  if (target.col > from.col && x < target.col * CELL_SIZE + inset) return false;
  if (target.col < from.col && x > (target.col + 1) * CELL_SIZE - inset)
    return false;
  if (target.row > from.row && y < target.row * CELL_SIZE + inset) return false;
  if (target.row < from.row && y > (target.row + 1) * CELL_SIZE - inset)
    return false;
  return true;
}

/**
 * 交換時的繞行路徑（v5 147 619～147 833）：三分之一時前進 10%、往外偏一半深度；三分之二時前進 90%、偏到最深；最後到達。
 * 往外偏的方向與移動方向垂直，且朝下（橫向交換＝往下繞；直向交換＝往右繞）。
 */
function arcKeyframes(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  depth: number,
): Keyframe[] {
  const dx = toX - fromX,
    dy = toY - fromY,
    length = Math.hypot(dx, dy) || 1;
  let normalX = -dy / length,
    normalY = dx / length;
  if (normalY < 0 || (normalY === 0 && normalX < 0)) {
    normalX = -normalX;
    normalY = -normalY;
  }
  const at = (progress: number, sink: number) => ({
    transform: translateUnits(
      fromX + dx * progress + normalX * depth * sink,
      fromY + dy * progress + normalY * depth * sink,
    ),
  });
  return [
    { ...at(0, 0), offset: 0 },
    { ...at(0.1, 0.5), offset: 1 / 3 },
    { ...at(0.9, 1), offset: 2 / 3 },
    { ...at(1, 0), offset: 1 },
  ];
}

export class BoardView {
  readonly element: HTMLDivElement;
  private views = new Map<number, PieceView>();
  private grid: BoardGrid = [];
  private frameId = 0;
  private comboLabels: HTMLElement[] = [];
  private drag: DragState | null = null;
  /** true＝不接受手指拖曳（演出中、對話中）。教學遮罩蓋在盤面上時，操作由遮罩透過 startDrag／moveDrag／endDrag 轉交 */
  isLocked = true;
  /** 玩家放開手指（完成一次移動，至少換過一格）時呼叫 */
  onMoveEnd: ((path: Cell[]) => void) | null = null;

  constructor(
    host: HTMLElement,
    private hooks: BoardViewHooks,
  ) {
    this.element = document.createElement("div");
    this.element.className = "battle-board";
    // 盤面變暗用的黑片（setAllDimmed）
    const dim = document.createElement("i");
    dim.className = "board-dim";
    this.element.appendChild(dim);
    host.appendChild(this.element);
    this.element.addEventListener("pointerdown", this.onPointerDown);
    const loop = (now: number) => {
      this.updateMotions(now);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    this.element.remove();
  }

  get currentGrid(): BoardGrid {
    return this.grid;
  }

  /** 放上整個盤面（不動畫） */
  setGrid(grid: BoardGrid) {
    this.views.forEach((view) => view.element.remove());
    this.views.clear();
    this.grid = grid;
    for (let row = 0; row < BOARD_ROWS; row++)
      for (let col = 0; col < BOARD_COLUMNS; col++) {
        const piece = grid[row]![col];
        if (piece)
          this.placeView(
            this.createView(piece),
            cellCenterX(col),
            cellCenterY(row),
          );
      }
  }

  /**
   * 開場：整個盤面的小兵一起從下方走進來（原版 v5 108 561 → 108 935 為整片滑入；這裡放慢並換走路姿勢、跨步時抬起，到定位後站好）。
   * 彼此間距不變（整片一起移動，不是一列一列走上來）；盤面格線底圖不動。
   * 用 CSS 的 translate 屬性做位移，與小兵本身定位用的 transform 疊加、互不干擾；換姿勢由 updateMotions 每禎處理。
   */
  async playIntro() {
    const { boardRiseDelayMs, boardRiseMs, boardRiseDistance } = boardTiming;
    const startedAt = performance.now() + boardRiseDelayMs;
    const rises = [...this.views.values()].map((view) => {
      view.motion = "walk";
      view.motionStartedAt = startedAt;
      return view.element
        .animate(
          [
            { translate: `0 ${designUnit(boardRiseDistance)}` },
            { translate: "0 0" },
          ],
          // 大致等速走進來，最後一小段放慢站定
          {
            duration: boardRiseMs,
            delay: boardRiseDelayMs,
            easing: "cubic-bezier(.3,.45,.55,1)",
            fill: "backwards",
          },
        )
        .finished.then(() => {
          if (view.walk) return; // 已經開始走別的路（例：開場中就被拖曳）
          view.motion = "stand";
          this.setPose(view, "stand");
        });
    });
    await Promise.all(rises);
  }

  // ---------- 繪製 ----------
  private createView(piece: Piece): PieceView {
    const element = document.createElement("div");
    element.className = "piece";
    const sprite = document.createElement("i");
    element.appendChild(sprite);
    this.element.appendChild(element);
    const view: PieceView = {
      piece,
      element,
      sprite,
      motion: "stand",
      motionStartedAt: 0,
      pose: "",
      white: false,
      walk: null,
    };
    this.views.set(piece.id, view);
    this.setPose(view, "stand");
    return view;
  }

  private placeView(view: PieceView, x: number, y: number) {
    view.element.style.transform = translateUnits(x, y);
  }

  private setPose(view: PieceView, pose: PiecePose, white = false) {
    if (view.pose === pose && view.white === white) return;
    view.pose = pose;
    view.white = white;
    paintPieceSprite(view.sprite, view.piece.kind, pose, white);
  }

  /** 每禎更新拿起中、走路中小兵的換圖 */
  private updateMotions(now: number) {
    for (const view of this.views.values()) {
      const elapsed = now - view.motionStartedAt;
      let bob = 0;
      if (view.motion === "hold")
        this.setPose(
          view,
          Math.floor(elapsed / boardTiming.pickUpFrameMs) % 2
            ? "holdB"
            : "holdA",
          view.white,
        );
      else if (view.motion === "walk" || view.motion === "march") {
        const pose =
          WALK_POSES[
            Math.floor(Math.max(0, elapsed) / boardTiming.walkFrameMs) % 4
          ]!;
        this.setPose(view, pose, view.white);
        // 跨步時身體微微抬起，走路才有上下起伏（不是平移滑過去）
        if (pose !== "stand") bob = boardTiming.walkBob;
      }
      const translate = bob ? `0 ${designUnit(-bob)}` : "";
      if (view.sprite.style.translate !== translate)
        view.sprite.style.translate = translate;
    }
  }

  /**
   * 原地踏步（前進到下一個合戰時，整個部隊一起走）：on＝開始、off＝停下站好。
   * 正在走路（補位、交換）或拿著的小兵不受影響。
   */
  setMarching(on: boolean) {
    const now = performance.now();
    for (const view of this.views.values()) {
      if (on && view.motion === "stand") {
        view.motion = "march";
        view.motionStartedAt =
          now - (view.piece.id % 2) * boardTiming.walkFrameMs;
      } else if (!on && view.motion === "march") {
        view.motion = "stand";
        this.setPose(view, "stand", view.white);
      }
    }
  }

  /**
   * 走到目的地（補位、交換共用）。
   * 同一個小兵還在走上一段時（例：手指快速來回），先取消上一段；上一段結束時不會再動到新的這一段。
   * arcDepth：交換時從下方繞過去的深度（設計單位；0＝直線，見 boardTiming.swapArcDepth）。
   */
  private walkTo(
    view: PieceView,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number,
    arcDepth = 0,
  ) {
    view.walk?.cancel();
    view.motion = "walk";
    view.motionStartedAt = performance.now();
    const keyframes = arcDepth
      ? arcKeyframes(fromX, fromY, toX, toY, arcDepth)
      : [
          { transform: translateUnits(fromX, fromY) },
          { transform: translateUnits(toX, toY) },
        ];
    const walk = (view.walk = view.element.animate(keyframes, {
      duration: durationMs,
      easing: "linear",
      fill: "forwards",
    }));
    return walk.finished.then(
      () => {
        if (view.walk !== walk) return; // 已被下一段取代
        this.placeView(view, toX, toY);
        walk.cancel();
        view.walk = null;
        view.motion = "stand";
        this.setPose(view, "stand");
      },
      () => {
        /* 被下一段取消：不用處理 */
      },
    );
  }

  // ---------- 拖曳 ----------
  /** 螢幕座標 → 盤面設計座標（盤面左上為 0,0） */
  clientToBoard(clientX: number, clientY: number) {
    const rect = this.element.getBoundingClientRect(),
      unitPx = currentStage.unitPx;
    return {
      x: (clientX - rect.left) / unitPx,
      y: (clientY - rect.top) / unitPx,
    };
  }

  cellAt(x: number, y: number): Cell | null {
    const col = Math.floor(x / CELL_SIZE),
      row = Math.floor(y / CELL_SIZE);
    return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLUMNS
      ? { row, col }
      : null;
  }

  /** 拖曳中走過的格子（第一格＝拿起的格子）；沒在拖曳時為 null */
  get dragPath(): readonly Cell[] | null {
    return this.drag?.path ?? null;
  }

  /**
   * 拿起盤面座標 point 所在格子的小兵。成功回傳 true。
   * 一般由手指觸發；教學遮罩攔下手指後也用這組 API（startDrag → moveDrag → endDrag）操作盤面。
   */
  startDrag(point: { x: number; y: number }, pointerId = -1): boolean {
    if (this.drag) return false;
    const cell = this.cellAt(point.x, point.y),
      piece = cell && this.grid[cell.row]![cell.col];
    if (!cell || !piece) return false;
    const view = this.views.get(piece.id)!;
    this.drag = { view, cell, path: [cell], pointerId };
    haptics.pulse(boardTiming.pickUpVibrateMs);
    view.motion = "hold";
    view.motionStartedAt = performance.now();
    view.element.classList.add("is-held");
    this.placeView(
      view,
      point.x + boardTiming.pickUpOffset.x,
      point.y + boardTiming.pickUpOffset.y,
    );
    return true;
  }

  /** 拿著的小兵移到盤面座標 point：小兵跟著手指；進到別的格子時，一格一格交換過去 */
  moveDrag(point: { x: number; y: number }) {
    const drag = this.drag;
    if (!drag) return;
    const { x, y } = point;
    this.placeView(
      drag.view,
      clamp(x, 0, 640) + boardTiming.pickUpOffset.x,
      clamp(y, 0, BOARD_HEIGHT) + boardTiming.pickUpOffset.y,
    );
    // 手指滑出盤面時，以盤面邊緣的格子為準（拖曳不中斷）
    const boardX = clamp(x, 0, 640 - 0.01),
      boardY = clamp(y, 0, BOARD_HEIGHT - 0.01);
    const target = this.cellAt(boardX, boardY);
    if (
      !target ||
      isSameCell(target, drag.cell) ||
      !hasPassedDeadZone(boardX, boardY, drag.cell, target)
    )
      return;
    // 一次走一格（可斜走），中間經過的格子依序交換
    while (!isSameCell(drag.cell, target)) {
      this.swapInto(drag, {
        row: drag.cell.row + Math.sign(target.row - drag.cell.row),
        col: drag.cell.col + Math.sign(target.col - drag.cell.col),
      });
    }
  }

  /** 放下拿著的小兵；走過至少一格時呼叫 onMoveEnd */
  endDrag() {
    this.dropHeld(true);
  }

  /** 放下拿著的小兵但不算一次移動（不呼叫 onMoveEnd）；教學中途放開時，小兵先退回起點再用這個放下 */
  cancelDrag() {
    this.dropHeld(false);
  }

  private dropHeld(countsAsMove: boolean) {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    drag.view.motion = "stand";
    drag.view.element.classList.remove("is-held");
    this.setPose(drag.view, "stand");
    this.placeView(
      drag.view,
      cellCenterX(drag.cell.col),
      cellCenterY(drag.cell.row),
    );
    if (countsAsMove && drag.path.length > 1) this.onMoveEnd?.(drag.path);
  }

  /** 拿著的小兵移進隔壁格 next：原本在 next 的小兵從下方繞到拿著的小兵原本的格子 */
  private swapInto(drag: DragState, next: Cell) {
    const swappedView = this.views.get(this.grid[next.row]![next.col]!.id)!;
    applyDragPath(this.grid, [drag.cell, next]);
    void this.walkTo(
      swappedView,
      cellCenterX(next.col),
      cellCenterY(next.row),
      cellCenterX(drag.cell.col),
      cellCenterY(drag.cell.row),
      boardTiming.swapMoveMs,
      boardTiming.swapArcDepth,
    );
    drag.cell = next;
    drag.path.push(next);
    haptics.pulse(boardTiming.swapVibrateMs);
  }

  // 手指操作：轉成上面的 API
  private onPointerDown = (event: PointerEvent) => {
    if (
      this.isLocked ||
      !this.startDrag(
        this.clientToBoard(event.clientX, event.clientY),
        event.pointerId,
      )
    )
      return;
    this.element.setPointerCapture(event.pointerId);
    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerup", this.onPointerUp);
    this.element.addEventListener("pointercancel", this.onPointerUp);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.drag?.pointerId) return;
    // 兩次 pointermove 之間，瀏覽器會把手指經過的點合併掉；逐一處理（getCoalescedEvents），快速滑動才不會漏格
    for (const sample of coalescedSamples(event))
      this.moveDrag(this.clientToBoard(sample.clientX, sample.clientY));
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.drag?.pointerId) return;
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.endDrag();
  };

  // ---------- 消除與補位 ----------
  /** 執行消除 → 補位 → 連鎖，回傳所有消除組（依順序） */
  async resolveMatches(): Promise<MatchGroup[]> {
    const allGroups: MatchGroup[] = [];
    await wait(boardTiming.releaseToFirstClearMs);
    for (;;) {
      const groups = findMatchGroups(this.grid);
      if (!groups.length) break;
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!;
        allGroups.push(group);
        this.playGroupClear(group, allGroups.length);
        this.hooks.onGroupCleared?.(group, allGroups.length);
        await wait(
          i < groups.length - 1
            ? boardTiming.groupIntervalMs
            : boardTiming.lastClearToRefillMs,
        );
      }
      removeMatchGroups(this.grid, groups);
      const moves = refillUpward(this.grid, this.hooks.nextKind);
      await Promise.all(
        moves.map((move) => {
          const view = move.isNew
            ? this.createView(move.piece)
            : this.views.get(move.piece.id)!;
          return this.walkTo(
            view,
            cellCenterX(move.col),
            cellCenterY(move.fromRow),
            cellCenterX(move.col),
            cellCenterY(move.toRow),
            boardTiming.refillMs,
          );
        }),
      );
      await wait(boardTiming.refillToCascadeMs);
    }
    return allGroups;
  }

  /**
   * 一組消除（v1 118 900～119 133）：純白剪影 67 ms → 帶粉紅光忽大忽小 166 ms → 格子空出，交給 onGroupVanished 做魂柱。
   * 白剪影是 puzzle_image 圖集裡同姿勢的白色零件。
   */
  private playGroupClear(group: MatchGroup, combo: number) {
    const centerX =
      group.cells.reduce((sum, cell) => sum + cellCenterX(cell.col), 0) /
      group.cells.length;
    const centerY =
      group.cells.reduce((sum, cell) => sum + cellCenterY(cell.row), 0) /
      group.cells.length;
    const clearedElements: HTMLElement[] = [];
    const totalMs = boardTiming.clearWhiteMs + boardTiming.clearGlowMs;
    const offsetAt = (ms: number) => ms / totalMs;
    const glow = (blur: number, color: string) =>
      `drop-shadow(0 0 ${designUnit(blur)} ${color})`;
    for (const cell of group.cells) {
      const piece = this.grid[cell.row]![cell.col]!;
      const view = this.views.get(piece.id)!;
      this.views.delete(piece.id);
      view.motion = "stand";
      this.setPose(view, "stand", true);
      clearedElements.push(view.element);
      const baseTransform = view.sprite.style.transform;
      view.sprite.animate(
        [
          { transform: `${baseTransform} scale(1)`, filter: "none", offset: 0 },
          {
            transform: `${baseTransform} scale(1)`,
            filter: "none",
            offset: offsetAt(boardTiming.clearWhiteMs),
          },
          {
            transform: `${baseTransform} scale(1.08,1.12)`,
            filter: glow(8, "#ff8ac8"),
            opacity: 0.95,
            offset: offsetAt(boardTiming.clearWhiteMs + fast(33)),
          },
          {
            transform: `${baseTransform} scale(.96,1.04)`,
            filter: glow(10, "#ff9ad0"),
            opacity: 0.9,
            offset: offsetAt(boardTiming.clearWhiteMs + fast(83)),
          },
          {
            transform: `${baseTransform} scale(1.1,1.15)`,
            filter: glow(8, "#ffb0dc"),
            opacity: 0.85,
            offset: offsetAt(boardTiming.clearWhiteMs + fast(133)),
          },
          {
            transform: `${baseTransform} scale(1,1.2)`,
            filter: glow(6, "#ffc0e0"),
            opacity: 0.7,
            offset: 1,
          },
        ],
        { duration: totalMs, fill: "forwards" },
      );
    }
    setTimeout(() => {
      clearedElements.forEach((element) => element.remove());
      this.hooks.onGroupVanished?.(group, centerX, centerY);
    }, totalMs);
    if (combo >= 2) {
      setTimeout(
        () =>
          void createComboLabel(this.element, combo, centerX, centerY).then(
            (label) => this.comboLabels.push(label),
          ),
        boardTiming.comboLabelDelayMs,
      );
    }
  }

  /** 第 index 個「N 連擊」字淡出（倍率階段逐個消失，v5 153 933～158 213） */
  fadeComboLabel(index: number) {
    const label = this.comboLabels[index];
    if (label)
      void label.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: boardTiming.comboLabelFadeMs,
        fill: "forwards",
      });
  }

  clearComboLabels() {
    this.comboLabels.forEach((label) => label.remove());
    this.comboLabels = [];
  }

  /** 演出中整個盤面變暗 */
  /**
   * 敵人技能改盤面：隨機 count 個小兵（from 種類之一；省略＝任何種類）換成 to，已經是 to 的不選。
   * 換的小兵先發白光再變成新種類（彈一下）。回傳實際換了幾個。
   */
  async convertPieces(to: PieceKind, count: number, from?: PieceKind[]) {
    const candidates: Cell[] = [];
    for (let row = 0; row < BOARD_ROWS; row++)
      for (let col = 0; col < BOARD_COLUMNS; col++) {
        const kind = this.grid[row]![col]?.kind;
        if (kind && kind !== to && (!from || from.includes(kind)))
          candidates.push({ row, col });
      }
    // 洗牌後取前 count 個
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    const chosen = candidates.slice(0, count);
    await Promise.all(
      chosen.map(async ({ row, col }, index) => {
        await wait(index * boardTiming.convertStaggerMs);
        const old = this.views.get(this.grid[row]![col]!.id)!;
        await old.element.animate(
          [{ filter: "brightness(1)" }, { filter: "brightness(4)" }],
          { duration: boardTiming.convertFlashMs, fill: "forwards" },
        ).finished;
        old.element.remove();
        this.views.delete(old.piece.id);
        const piece = createPiece(to);
        this.grid[row]![col] = piece;
        const view = this.createView(piece);
        this.placeView(view, cellCenterX(col), cellCenterY(row));
        await view.sprite.animate(
          [
            { filter: "brightness(4)", scale: "0.6" },
            { filter: "brightness(1.5)", scale: "1.15", offset: 0.6 },
            { filter: "brightness(1)", scale: "1" },
          ],
          { duration: boardTiming.convertPopMs },
        ).finished;
      }),
    );
    return chosen.length;
  }

  setAllDimmed(dimmed: boolean) {
    this.element.classList.toggle("is-all-dimmed", dimmed);
  }
}

/** 盤面座標：盤面左上為 (0,0)，設計單位；格子 640/7 見方 */
export const CELL_SIZE = 640 / BOARD_COLUMNS;
export const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;
/** 第 col 欄的中心 x */
export const cellCenterX = (col: number) => CELL_SIZE * (col + 0.5);
/** 第 row 列的中心 y（可大於最後一列，用於盤面下方進場的小兵） */
export const cellCenterY = (row: number) => CELL_SIZE * (row + 0.5);

/** 「N連擊」：原版字型 BFComboNumber，先紅後黃（v5 149224 → 149438） */
/** 字高（v5 149 706 量測）：數字 32、連擊 30 */
const NUMBER_HEIGHT = 32;
const WORD_HEIGHT = 30;

export async function createComboLabel(
  parent: HTMLElement,
  combo: number,
  x: number,
  y: number,
): Promise<HTMLElement> {
  const [number, word] = await Promise.all([
    renderBitmapText(BATTLE_FONTS.comboNumber, String(combo)),
    renderBitmapText(BATTLE_FONTS.comboNumber, "連撃"),
  ]);
  const label = document.createElement("div");
  label.className = "combo-label";
  label.style.transform = translateUnits(x, y);
  const numberWidth = number.width * (NUMBER_HEIGHT / number.height),
    wordWidth = word.width * (WORD_HEIGHT / word.height);
  label.innerHTML =
    `<i style="background:url(${number.url}) 0 0/100% 100%;width:${designUnit(numberWidth)};height:${designUnit(NUMBER_HEIGHT)};left:${designUnit(-numberWidth / 2)};top:${designUnit(-NUMBER_HEIGHT)}"></i>` +
    `<i style="background:url(${word.url}) 0 0/100% 100%;width:${designUnit(wordWidth)};height:${designUnit(WORD_HEIGHT)};left:${designUnit(-wordWidth / 2)};top:0"></i>`;
  parent.appendChild(label);
  const reddish = "hue-rotate(-40deg) saturate(1.6)";
  label.animate(
    [
      { opacity: 0, filter: reddish },
      { opacity: 1, filter: reddish, offset: 0.3 },
      { opacity: 1, filter: "none" },
    ],
    { duration: boardTiming.comboLabelColorMs + fast(50), fill: "forwards" },
  );
  return label;
}

/**
 * 小兵圖：全部取自圖集 遊戲素材/UI等/戰鬥效果/puzzle_image.png（無座標檔，零件座標見 data/atlas/puzzle_image.json）。
 * 每個勢力 13 個姿勢（站立、拿起 A/B、走路 A/B、正面、舉手…），姿勢對應表 data/pieces.json 的 poses 的產生方式見 docs/復刻分析/02_教學戰鬥1.md §2。
 * 部分零件在圖集中轉 90° 存放（rot=-90），顯示時轉回；白色剪影零件（white）用於消除時變白；剪影的存放角度與彩色零件不同時另記 whiteRot。
 */
/** 小兵姿勢。facingFront＝正面朝玩家；armsOpen＝雙手張開（跳起）；raiseHand＝舉手（武將頭上） */
export type PiecePose =
  | "stand"
  | "holdA"
  | "holdB"
  | "walkA"
  | "walkB"
  | "facingFront"
  | "raiseHand"
  | "armsOpen";
interface PoseDefinition {
  part: number;
  rot: number;
  white?: number;
  /** 白色剪影在圖集中的角度（與彩色零件不同時才寫；data/pieces.json） */
  whiteRot?: number;
}
const POSES = pieces.poses as unknown as Record<
  PieceKind,
  Record<string, PoseDefinition>
>;

/** 取得姿勢定義；沒有該姿勢（例：桃子沒有拿起／走路）時一律用站立圖 */
export function getPoseDefinition(
  kind: PieceKind,
  pose: PiecePose,
): PoseDefinition {
  const poses = POSES[kind];
  return poses[pose] ?? poses.stand!;
}

/**
 * 把一個 <i> 設成指定的小兵姿勢。元素以自身中心為基準（外層負責定位）。
 * white=true 時改用同姿勢的白色剪影（沒有剪影的姿勢退回站立剪影）。
 */
export function paintPieceSprite(
  element: HTMLElement,
  kind: PieceKind,
  pose: PiecePose,
  white = false,
) {
  let definition = getPoseDefinition(kind, pose);
  if (white && definition.white == null)
    definition = getPoseDefinition(kind, "stand");
  const part = pieceAtlas.parts[white ? definition.white! : definition.part]!;
  const style = element.style;
  style.width = designUnit(part.w);
  style.height = designUnit(part.h);
  style.marginLeft = designUnit(-part.w / 2);
  style.marginTop = designUnit(-part.h / 2);
  style.backgroundImage = `url(${getAssetUrl(pieces.atlas)})`;
  style.backgroundSize = `${designUnit(pieceAtlas.w)} ${designUnit(pieceAtlas.h)}`;
  style.backgroundPosition = `${designUnit(-part.x)} ${designUnit(-part.y)}`;
  const rot = white ? (definition.whiteRot ?? definition.rot) : definition.rot;
  style.transform = rot ? `rotate(${rot}deg)` : "";
}
