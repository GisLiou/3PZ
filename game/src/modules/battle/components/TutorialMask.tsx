/**
 * 戰鬥的新手教學：遮罩本身是共用的 TutorialOverlay（@ui），這裡只放戰鬥專用的部分；盤面（BoardView）不知道教學的存在。
 *   <TutorialMask />          放在戰鬥畫布最後（蓋在最上層）的標籤；大小＝640×999 版面
 *   TutorialMaskController    overlay：玲玲對話、變暗、高亮（元件 id＝戰鬥畫布的元件 id）
 *                             guideMove()：畫面變暗、只有路徑經過的格子是亮的、畫出路徑與手；手指只能從起點拿起、沿路徑走，
 *                                          走完自動放開；中途放開時小兵沿原路退回起點，重新等玩家照路徑走
 *   runTutorialScript()       執行關卡 JSON 的 script：共用步驟（say、tap、wait、save、goto）＋戰鬥步驟
 */
import { designUnit, translateUnits } from "@core/stage";
import { type BattleScreen } from "../logic/BattleScreen";
import { CanvasPart } from "./BattleCanvas";
import { type TutorialData } from "../logic/stageData";
import {
  createQueuedKindSource,
  parseBoardNotation,
  type BoardGrid,
  type Cell,
  type NextPieceKind,
} from "../logic/boardRules";
import {
  BOARD_HEIGHT,
  CELL_SIZE,
  cellCenterX,
  cellCenterY,
  coalescedSamples,
  isSameCell,
} from "../logic/BoardView";
import {
  DEFAULT_TOUCH_HINT,
  TutorialOverlay,
  runTutorialSteps,
  type TutorialStepHandlers,
} from "@ui";
import {
  TUTORIAL_PART,
  tutorialPartRect,
  tutorialPartStyle,
} from "../logic/battleAssets";

/** 指引時變暗的程度（v5 145 639～148 368 實測：盤面亮度 108 → 65，約 62%）；路徑經過的格子保持明亮 */
const GUIDE_DIM = 0.38;

export class TutorialMaskController {
  /** 共用的教學遮罩（擋操作、變暗、高亮、玲玲對話） */
  readonly overlay: TutorialOverlay;
  /** 指引移動時蓋在盤面上、攔下手指的透明片 */
  private catcher: HTMLDivElement;
  /** 目前要求的路徑（null＝沒有在指引） */
  activePath: Cell[] | null = null;
  private pointerId: number | null = null;

  constructor(
    private battle: BattleScreen,
    host: HTMLElement,
  ) {
    // 元件 id＝敵人 id（'zhouYu'…，還活著的第一個）或戰鬥畫布的元件 id（'portraits'、'hpBar'、'menu'、'board'…）
    // 點擊提示的位置＝<TutorialMask> 標籤的屬性（現讀，熱更新改了就會跟著動）
    const maskProps = () =>
      battle.entries.find((entry) => entry.kind === "tutorialMask")!.props;
    this.overlay = new TutorialOverlay(
      host,
      (id) =>
        battle.enemyLayer.findAlive(id)?.artElement ?? battle.elementOf(id),
      () => {
        const props = maskProps();
        return {
          handX: Number(props.touchHandX),
          handY: Number(props.touchHandY),
          labelX: Number(props.touchLabelX),
          labelY: Number(props.touchLabelY),
          size: Number(props.touchSize),
        };
      },
    );
    this.catcher = document.createElement("div");
    this.catcher.style.cssText =
      "position:absolute;pointer-events:none;touch-action:none";
    this.overlay.top.appendChild(this.catcher);
    this.catcher.addEventListener("pointerdown", this.onPointerDown);
    this.catcher.addEventListener("pointermove", this.onPointerMove);
    this.catcher.addEventListener("pointerup", this.onPointerUp);
    this.catcher.addEventListener("pointercancel", this.onPointerUp);
  }

  destroy() {
    this.overlay.destroy();
  }

  /** 指引一次移動：等玩家照 path 拖完（或中途放開）後 resolve 實際走過的路徑 */
  guideMove(path: Cell[]): Promise<Cell[]> {
    const board = this.battle.board,
      origin = this.battle.boardOrigin;
    const boardRect = { x: origin.x, y: origin.y, w: 640, h: BOARD_HEIGHT };
    // 路徑經過的格子（同一格只算一次）
    const pathCells = path.filter(
      (cell, i) => path.findIndex((other) => isSameCell(other, cell)) === i,
    );
    // 整個畫面變暗、只留路徑的格子明亮；只有盤面可以碰（手指再由 catcher 限制在路徑上）。v5：.27 秒淡入
    this.overlay.show({
      dim: GUIDE_DIM,
      highlight: pathCells.map((cell) => ({
        x: origin.x + cellCenterX(cell.col) - CELL_SIZE / 2,
        y: origin.y + cellCenterY(cell.row) - CELL_SIZE / 2,
        w: CELL_SIZE,
        h: CELL_SIZE,
      })),
      touchable: boardRect,
      fadeMs: tutorialTiming.boardShadeFadeMs,
    });
    Object.assign(this.catcher.style, {
      left: designUnit(boardRect.x),
      top: designUnit(boardRect.y),
      width: designUnit(boardRect.w),
      height: designUnit(boardRect.h),
    });
    const hideGuide = showDragPathGuide(
      this.overlay.top,
      path.map((cell) => this.battle.cellCenter(cell)),
    );
    this.activePath = path;
    this.catcher.style.pointerEvents = "auto";
    return new Promise((resolve) => {
      board.onMoveEnd = (moved) => {
        board.onMoveEnd = null;
        this.activePath = null;
        this.pointerId = null;
        this.catcher.style.pointerEvents = "none";
        this.overlay.hide(tutorialTiming.boardShadeFadeMs);
        hideGuide();
        resolve(moved);
      };
    });
  }

  // ---------- 攔下手指，照路徑轉交給盤面 ----------
  private onPointerDown = (event: PointerEvent) => {
    const path = this.activePath,
      board = this.battle.board;
    if (!path || board.dragPath) return;
    const point = board.clientToBoard(event.clientX, event.clientY),
      cell = board.cellAt(point.x, point.y);
    if (
      !cell ||
      !isSameCell(cell, path[0]!) ||
      !board.startDrag(point, event.pointerId)
    )
      return;
    this.pointerId = event.pointerId;
    this.catcher.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    const board = this.battle.board;
    for (const sample of coalescedSamples(event)) {
      const path = this.activePath,
        moved = board.dragPath;
      if (!path || !moved) return;
      board.moveDrag(
        this.constrain(
          board.clientToBoard(sample.clientX, sample.clientY),
          path,
          moved,
        ),
      );
      // 照路徑走完：自動放開
      if (board.dragPath?.length === path.length) {
        board.endDrag();
        return;
      }
    }
  };

  /** 放開：照路徑走完才算數；沒走完就沿原路退回起點、放回去，重新等玩家照路徑走 */
  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    const board = this.battle.board,
      path = this.activePath,
      moved = board.dragPath;
    if (!path || !moved) return;
    if (moved.length >= path.length) {
      board.endDrag();
      return;
    }
    for (let i = moved.length - 2; i >= 0; i--) {
      const cell = moved[i]!;
      board.moveDrag({ x: cellCenterX(cell.col), y: cellCenterY(cell.row) });
    }
    board.cancelDrag();
  };

  /** 手指位置投影到「目前格子中心 → 路徑下一格中心」這段線上：小兵只能沿路徑走，不會換到路徑外的格子 */
  private constrain(
    point: { x: number; y: number },
    path: Cell[],
    moved: readonly Cell[],
  ) {
    const current = moved[moved.length - 1]!,
      next = path[moved.length];
    const from = { x: cellCenterX(current.col), y: cellCenterY(current.row) };
    if (!next) return from;
    const dx = cellCenterX(next.col) - from.x,
      dy = cellCenterY(next.row) - from.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - from.x) * dx + (point.y - from.y) * dy) /
          (dx * dx + dy * dy),
      ),
    );
    return { x: from.x + dx * t, y: from.y + dy * t };
  }
}

/** 教學遮罩標籤：x, y＝遮罩左上（通常不用動，遮罩大小＝640×999 版面） */
export const TutorialMask = (props: {
  x?: number;
  y?: number;
  /** 點擊提示（tap 步驟）：以高亮範圍「右緣、上下置中」為原點，手與「タッチ!」的左上角，以及兩張圖的邊長 */
  touchHandX?: number;
  touchHandY?: number;
  touchLabelX?: number;
  touchLabelY?: number;
  touchSize?: number;
}) => (
  <CanvasPart
    kind="tutorialMask"
    box="layout"
    props={props}
    defaults={{
      x: 0,
      y: 0,
      touchHandX: DEFAULT_TOUCH_HINT.handX,
      touchHandY: DEFAULT_TOUCH_HINT.handY,
      touchLabelX: DEFAULT_TOUCH_HINT.labelX,
      touchLabelY: DEFAULT_TOUCH_HINT.labelY,
      touchSize: DEFAULT_TOUCH_HINT.size,
    }}
  />
);

// ---------- 教學步驟執行器（關卡 JSON 的 script） ----------
/** 執行器需要的戰鬥流程工具（由 BattleScene 提供） */
interface TutorialContext {
  totalWaves: number;
  refillKind: NextPieceKind;
  /** 第 index 個合戰（0 起算）：第 2 個起先往前走，再放上敵人（先不出現）並顯示「合戰 n/總數」 */
  showWave: (index: number) => Promise<void>;
  createRandomGrid: () => BoardGrid;
  /** 玩家選的勢力在盤面記法中的字母 */
  playerLetter: string;
  isActive: () => boolean;
}

/**
 * 依序執行 script 的每一步（每一步一個物件）。
 * 共用步驟（say、tap、wait、save、goto，遮罩參數 highlight／dim／dimArea／touchable…）見 @ui 的 runTutorialSteps；
 * 元件 id＝敵人 id（例：{ "tap": "zhouYu" }＝只能點周瑜，點了就鎖定）或 StandardBattleLayout 的元件 id（'portraits'、'hpBar'、'menu'、'board'…）。戰鬥步驟：
 *   { "intro": move 名稱或 "random" }  開場：全白退去、「合戰 1/n」、盤面由下往上滑入
 *   { "wave": n }            換第 n 個合戰（顯示「合戰 n/總數」，敵人先不出現）
 *   { "enemiesEnter": true } 敵人登場
 *   { "guidedMove": move }   指定路徑的移動（只有盤面可以碰、只允許照路徑轉珠），接著播放一回合與敵人回合（「殘 N」少 1，數到 0 就攻擊）
 *   { "enemyTurn": true }    多插一個敵人回合（一般不需要）　　{ "cannotDie": true/false }  敵人 HP 最少留 1
 *   { "target": 敵人 id／null }  直接鎖定／解除目標（不用玩家點）　　{ "defeat": 敵人 id／"all" }  直接打倒
 *   { "victory": true }
 */
export async function runTutorialScript(
  battle: BattleScreen,
  mask: TutorialMaskController,
  data: TutorialData,
  context: TutorialContext,
) {
  const { totalWaves, refillKind, showWave } = context;
  /** 錄影盤面（換成玩家的勢力字母） */
  const getMove = (name: string) => {
    const move = data.moves?.[name];
    if (!move) throw new Error(`關卡沒有 moves.${name}`);
    const swap = (text: string) =>
      swapLetters(
        text,
        data.starterLetter ?? context.playerLetter,
        context.playerLetter,
      );
    return {
      before: swap(move.before),
      path: move.path.map(([row, col]) => ({ row: row!, col: col! })),
      queues: move.queues.map(swap),
    };
  };
  const findEnemy = (id: string) =>
    battle.enemies.find((enemy) => enemy.id === id && !enemy.isDead);

  const battleSteps: TutorialStepHandlers = {
    intro: async (step) => {
      const name = String(step.intro);
      battle.setGrid(
        name === "random"
          ? context.createRandomGrid()
          : parseBoardNotation(getMove(name).before),
      );
      // 白色先蓋住，等背景畫好再一起開始：白色退去、「合戰 1/n」、盤面滑入（v5 108 507～）
      const fadeFromWhite = battle.playFadeFromWhite(battle.backgroundReady);
      battle.setBoardGridVisible(false);
      await battle.backgroundReady;
      await Promise.all([
        fadeFromWhite,
        battle.playWaveBanner(1, totalWaves),
        battle.board.playIntro(),
      ]);
      // 格線出現的確切時間未確認（110 540 之後畫面被對話遮暗），暫定在開場結束時
      battle.setBoardGridVisible(true);
    },
    wave: (step) => showWave(Number(step.wave) - 1),
    enemiesEnter: () => battle.playEnemyEntrance(),
    guidedMove: async (step) => {
      const move = getMove(String(step.guidedMove));
      battle.setGrid(parseBoardNotation(move.before));
      battle.nextKind = createQueuedKindSource(move.queues, refillKind);
      await mask.guideMove(move.path);
      await battle.playTurn();
      // 接著是一般的敵人回合：「殘 N」少 1，數到 0 的敵人攻擊（攻擊時機由敵人的 interval／firstCountdown／firstStrike 決定）
      if (battle.enemies.some((enemy) => !enemy.isDead))
        await battle.playEnemyTurn();
    },
    enemyTurn: () => battle.playEnemyTurn(),
    cannotDie: (step) => {
      battle.enemyLayer.cannotDie = step.cannotDie === true;
    },
    target: (step) => {
      const enemy = step.target ? findEnemy(String(step.target)) : undefined;
      battle.setTarget(enemy ? battle.enemies.indexOf(enemy) : -1);
    },
    // 直接打倒：HP 歸零並播放一般的死亡演出（變黑 → 爆光 → 煙霧）
    defeat: async (step) => {
      const targets =
        step.defeat === "all"
          ? battle.enemies.filter((enemy) => !enemy.isDead)
          : [findEnemy(String(step.defeat))];
      targets.forEach((enemy) => enemy && (enemy.currentHp = 0));
      await battle.enemyLayer.resolveDeaths();
    },
    victory: () => battle.playVictory(),
  };
  await runTutorialSteps(
    data.script,
    mask.overlay,
    battleSteps,
    context.isActive,
  );
}

/** 把盤面記法中的兩個字母互換（例：錄影的 G 換成玩家勢力的字母） */
function swapLetters(notation: string, from: string, to: string) {
  if (from === to) return notation;
  return [...notation]
    .map((char) => (char === from ? to : char === to ? from : char))
    .join("");
}

/**
 * 拖曳路徑指引：畫出路徑、手沿路徑來回（guideMove 使用；盤面變暗由遮罩處理）。
 * 版面量測自 v5 146 281 ms：白條（tutorialImg 2／0）粗 22，起點白點（5），終點三角（4/6/7），手（3）沿路徑移動。
 */
const LINE_THICKNESS = 22;
const DOT_SCALE = 0.4;
const ARROW_SCALE = 0.3;
const HAND_SCALE = 0.55;
/** tutorialImg 圖集尺寸 */
const ATLAS_WIDTH = 128,
  ATLAS_HEIGHT = 256;

/** 在 host 上顯示路徑指引；points＝路徑上各格中心（host 的座標）。回傳收起指引的函式 */
function showDragPathGuide(
  host: HTMLElement,
  points: Array<{ x: number; y: number }>,
): () => void {
  const layer = document.createElement("div");
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none";
  const createPart = (index: number, scale = 1) => {
    const element = document.createElement("i");
    Object.assign(element.style, tutorialPartStyle(index, scale));
    layer.appendChild(element);
    return element;
  };

  // 路徑：每一段拉長一條白條
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!,
      to = points[i]!,
      isHorizontal = from.y === to.y;
    const x = Math.min(from.x, to.x) - (isHorizontal ? 0 : LINE_THICKNESS / 2),
      y = Math.min(from.y, to.y) - (isHorizontal ? LINE_THICKNESS / 2 : 0);
    const width = isHorizontal ? Math.abs(from.x - to.x) : LINE_THICKNESS,
      height = isHorizontal ? LINE_THICKNESS : Math.abs(from.y - to.y);
    const partIndex = isHorizontal
        ? TUTORIAL_PART.horizontalBar
        : TUTORIAL_PART.verticalBar,
      rect = tutorialPartRect(partIndex);
    const line = createPart(partIndex);
    Object.assign(line.style, {
      left: designUnit(x),
      top: designUnit(y),
      width: designUnit(width),
      height: designUnit(height),
      backgroundSize: `${designUnit((ATLAS_WIDTH * width) / rect.w)} ${designUnit((ATLAS_HEIGHT * height) / rect.h)}`,
      backgroundPosition: `${designUnit((-rect.x * width) / rect.w)} ${designUnit((-rect.y * height) / rect.h)}`,
    });
  }

  // 起點白點
  const dotRect = tutorialPartRect(TUTORIAL_PART.dot),
    dot = createPart(TUTORIAL_PART.dot, DOT_SCALE);
  dot.style.left = designUnit(points[0]!.x - (dotRect.w * DOT_SCALE) / 2);
  dot.style.top = designUnit(points[0]!.y - (dotRect.h * DOT_SCALE) / 2);

  // 終點三角：依最後一段的方向
  const last = points[points.length - 1]!,
    beforeLast = points[points.length - 2] ?? points[0]!;
  const arrowIndex =
    last.x > beforeLast.x
      ? TUTORIAL_PART.arrowRight
      : last.x < beforeLast.x
        ? TUTORIAL_PART.arrowLeft
        : TUTORIAL_PART.arrowDown;
  const arrowRect = tutorialPartRect(arrowIndex),
    arrow = createPart(arrowIndex, ARROW_SCALE);
  arrow.style.left = designUnit(last.x - (arrowRect.w * ARROW_SCALE) / 2);
  arrow.style.top = designUnit(last.y - (arrowRect.h * ARROW_SCALE) / 2);
  if (last.y < beforeLast.y) arrow.style.transform = "rotate(180deg)";

  // 手：沿路徑移動，到終點停一下再回到起點
  const handRect = tutorialPartRect(TUTORIAL_PART.handPointUp),
    hand = createPart(TUTORIAL_PART.handPointUp, HAND_SCALE);
  hand.style.left = designUnit(-handRect.w * HAND_SCALE * 0.22);
  hand.style.top = designUnit(-4);
  host.appendChild(layer);
  const keyframes = points.map((point, i) => ({
    transform: translateUnits(point.x, point.y),
    offset: (i / (points.length - 1)) * tutorialTiming.guideHandMoveShare,
  }));
  const handAnimation = hand.animate(
    [...keyframes, { transform: translateUnits(last.x, last.y), offset: 1 }],
    { duration: tutorialTiming.guideHandCycleMs, iterations: Infinity },
  );

  return () => {
    handAnimation.cancel();
    layer.remove();
  };
}

/** 戰鬥教學（盤面變暗、路徑指引）的演出時間（毫秒），來源 v5 亞修實況（每禎 53.5 ms），逐禎紀錄見 docs/復刻分析/02_教學戰鬥1.md */
const tutorialTiming = {
  /** 指引時盤面變暗／恢復 */
  boardShadeFadeMs: 270,
  /** 手沿路徑移動一輪（v5 145 746 → 147 352 回到起點） */
  guideHandCycleMs: 1606,
  /** 一輪中手在移動的比例（其餘時間停在終點） */
  guideHandMoveShare: 0.8,
} as const;
