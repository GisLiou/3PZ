/** 教學用的變暗遮罩：整個畫面變暗，可留一個明亮的洞（以 4 片矩形組成） */
import { designUnit } from '@core/stage/stage';

export interface Rect { x: number; y: number; w: number; h: number }

/** 戰鬥版面以底部 999 為基準，螢幕較高時上方還有空間，所以往上多蓋 1000 */
const EXTRA_TOP = 1000;

export function createDimOverlay(host: HTMLElement, hole?: Rect, alpha = 0.5): HTMLElement {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
  const addPanel = (x: number, y: number, w: number, h: number) => {
    const panel = document.createElement('i');
    panel.style.cssText = `position:absolute;left:${designUnit(x)};top:${designUnit(y)};width:${designUnit(w)};height:${designUnit(h)};background:rgba(0,0,0,${alpha})`;
    overlay.appendChild(panel);
  };
  if (!hole) addPanel(0, -EXTRA_TOP, 640, 999 + EXTRA_TOP);
  else {
    addPanel(0, -EXTRA_TOP, 640, hole.y + EXTRA_TOP);
    addPanel(0, hole.y + hole.h, 640, 999 - hole.y - hole.h);
    addPanel(0, hole.y, hole.x, hole.h);
    addPanel(hole.x + hole.w, hole.y, 640 - hole.x - hole.w, hole.h);
  }
  host.appendChild(overlay);
  return overlay;
}
