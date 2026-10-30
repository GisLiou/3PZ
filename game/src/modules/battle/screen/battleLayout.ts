/**
 * 戰鬥版面常數與共用的 DOM 小工具。
 * 版面以「底部 999 設計單位」為基準（由上而下）：
 *   敵方區（天空、地面、敵人）  頂端～y405
 *   我方區（頭像 y405、100×100，x10+105n；HP 條 y510～545）
 *   盤面（y540～997，7×5，每格 91.43）
 * 螢幕較高時敵方區域往上延伸。
 */
import { designUnit } from '@core/stage/stage';
import { renderBitmapText } from '@ui/bitmapText';
import { layoutPartRect, layoutPartStyle } from '../assets/atlasParts';

/** 底部基準版面的高度 */
export const BATTLE_LAYOUT_HEIGHT = 999;
/** 盤面上緣 */
export const BOARD_TOP = 540;
/** 武將頭像上緣 */
export const PORTRAIT_TOP = 405;
/** 第 index 位武將頭像的左緣與中心 */
export const portraitLeft = (index: number) => 10 + 105 * index;
export const portraitCenterX = (index: number) => portraitLeft(index) + 50;

export type TextAnchor = 'left' | 'right' | 'center';

/**
 * 把點陣字畫到 element 上（取代原本內容）。text 為空字串時隱藏。
 * height＝顯示字高；x,y＝錨點位置（設計單位）。
 */
export async function setBitmapTextImage(element: HTMLElement, font: string, text: string, color: string, height: number, x: number, y: number, anchor: TextAnchor = 'left') {
  if (!text) { element.style.display = 'none'; return; }
  const rendered = await renderBitmapText(font, text, color);
  const width = rendered.width * (height / rendered.height);
  const left = anchor === 'right' ? x - width : anchor === 'center' ? x - width / 2 : x;
  Object.assign(element.style, { display: 'block', left: designUnit(left), top: designUnit(y), width: designUnit(width), height: designUnit(height), background: `url(${rendered.url}) 0 0/100% 100% no-repeat` });
}

/** 建立一個絕對定位的 <i>，套上指定樣式並放進 parent */
export function createImageElement(parent: HTMLElement | null, style: Partial<CSSStyleDeclaration> = {}, className?: string): HTMLElement {
  const element = document.createElement('i');
  if (className) element.className = className;
  Object.assign(element.style, style);
  parent?.appendChild(element);
  return element;
}

/** puzzlelayout 中轉 90° 存放的零件，轉回後放在 (x,y)、拉成 width×height */
export function createRotatedLayoutPart(index: number, x: number, y: number, width: number, height: number) {
  const rect = layoutPartRect(index), element = document.createElement('i');
  Object.assign(element.style, layoutPartStyle(index));
  const scaleX = height / rect.w, scaleY = width / rect.h;
  Object.assign(element.style, {
    width: designUnit(height), height: designUnit(width), left: designUnit(x + width / 2 - height / 2), top: designUnit(y + height / 2 - width / 2), transform: 'rotate(-90deg)',
    backgroundSize: `${designUnit(512 * scaleX)} ${designUnit(1024 * scaleY)}`, backgroundPosition: `${designUnit(-rect.x * scaleX)} ${designUnit(-rect.y * scaleY)}`,
  });
  return element;
}

/** 重新觸發 CSS 動畫 class（例：晃動） */
export function restartCssAnimation(element: HTMLElement, className: string) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
