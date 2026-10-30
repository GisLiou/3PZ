/**
 * 拖曳路徑指引：畫出路徑、手沿路徑來回，盤面除路徑外變暗。
 * 版面量測自 v5 146 281 ms：白條（tutorialImg 2／0）粗 22，起點白點（5），終點三角（4/6/7），手（3）沿路徑移動。
 */
import { designUnit, translateUnits } from '@core/stage/stage';
import { TUTORIAL_PART, tutorialPartRect, tutorialPartStyle, type BattleScreen, type Cell } from '@modules/battle';
import { tutorialTiming } from '../tutorialTiming';

const LINE_THICKNESS = 22;
const DOT_SCALE = 0.4;
const ARROW_SCALE = 0.3;
const HAND_SCALE = 0.55;
/** tutorialImg 圖集尺寸 */
const ATLAS_WIDTH = 128, ATLAS_HEIGHT = 256;

/** 顯示路徑指引；回傳收起指引的函式 */
export function showDragPathGuide(battle: BattleScreen, path: Cell[]): () => void {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const points = path.map((cell) => battle.cellCenter(cell));
  const createPart = (index: number, scale = 1) => {
    const element = document.createElement('i');
    Object.assign(element.style, tutorialPartStyle(index, scale));
    layer.appendChild(element);
    return element;
  };

  // 路徑：每一段拉長一條白條
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!, to = points[i]!, isHorizontal = from.y === to.y;
    const x = Math.min(from.x, to.x) - (isHorizontal ? 0 : LINE_THICKNESS / 2), y = Math.min(from.y, to.y) - (isHorizontal ? LINE_THICKNESS / 2 : 0);
    const width = isHorizontal ? Math.abs(from.x - to.x) : LINE_THICKNESS, height = isHorizontal ? LINE_THICKNESS : Math.abs(from.y - to.y);
    const partIndex = isHorizontal ? TUTORIAL_PART.horizontalBar : TUTORIAL_PART.verticalBar, rect = tutorialPartRect(partIndex);
    const line = createPart(partIndex);
    Object.assign(line.style, {
      left: designUnit(x), top: designUnit(y), width: designUnit(width), height: designUnit(height),
      backgroundSize: `${designUnit(ATLAS_WIDTH * width / rect.w)} ${designUnit(ATLAS_HEIGHT * height / rect.h)}`,
      backgroundPosition: `${designUnit(-rect.x * width / rect.w)} ${designUnit(-rect.y * height / rect.h)}`,
    });
  }

  // 起點白點
  const dotRect = tutorialPartRect(TUTORIAL_PART.dot), dot = createPart(TUTORIAL_PART.dot, DOT_SCALE);
  dot.style.left = designUnit(points[0]!.x - dotRect.w * DOT_SCALE / 2); dot.style.top = designUnit(points[0]!.y - dotRect.h * DOT_SCALE / 2);

  // 終點三角：依最後一段的方向
  const last = points[points.length - 1]!, beforeLast = points[points.length - 2] ?? points[0]!;
  const arrowIndex = last.x > beforeLast.x ? TUTORIAL_PART.arrowRight : last.x < beforeLast.x ? TUTORIAL_PART.arrowLeft : TUTORIAL_PART.arrowDown;
  const arrowRect = tutorialPartRect(arrowIndex), arrow = createPart(arrowIndex, ARROW_SCALE);
  arrow.style.left = designUnit(last.x - arrowRect.w * ARROW_SCALE / 2); arrow.style.top = designUnit(last.y - arrowRect.h * ARROW_SCALE / 2);
  if (last.y < beforeLast.y) arrow.style.transform = 'rotate(180deg)';

  // 手：沿路徑移動，到終點停一下再回到起點
  const handRect = tutorialPartRect(TUTORIAL_PART.handPointUp), hand = createPart(TUTORIAL_PART.handPointUp, HAND_SCALE);
  hand.style.left = designUnit(-handRect.w * HAND_SCALE * 0.22); hand.style.top = designUnit(-4);
  battle.overlayLayer.appendChild(layer);
  const keyframes = points.map((point, i) => ({ transform: translateUnits(point.x, point.y), offset: (i / (points.length - 1)) * tutorialTiming.guideHandMoveShare }));
  const handAnimation = hand.animate([...keyframes, { transform: translateUnits(last.x, last.y), offset: 1 }], { duration: tutorialTiming.guideHandCycleMs, iterations: Infinity });

  battle.board.setGuideDimmed(path);
  return () => { handAnimation.cancel(); layer.remove(); battle.board.setGuideDimmed(null); };
}
