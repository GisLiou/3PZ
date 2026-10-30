/**
 * 玲玲（教學嚮導）的對話視窗：畫面變暗（可留洞）、玲玲全身圖、對話框與「確定」鈕；點「確定」才繼續。
 * 版面量測自 v5 113 537 ms，640×999 設計單位：
 *   變暗：黑色 50%　玲玲 naviBase_s 縮 0.967、左緣 -12、頂 505
 *   視窗 info_window x120 y600 400×340，文字左緣 165、字高 24　確定鈕 button_mini_2 (240,835)
 */
import { getAsset, getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import { uiAsset } from '@ui/components';
import { BATTLE_ASSETS } from '@modules/battle';
import { tutorialTiming } from '../tutorialTiming';
import { createDimOverlay, type Rect } from './dimOverlay';

export interface NavigatorDialogOptions {
  /** 表情（笑臉）。表情零件的合成位置尚未解出，目前不影響畫面（docs/復刻分析/02 §待確認） */
  expression?: 'smile';
  /** 保持明亮的範圍（例：介紹 HP 條時留出 HP 條） */
  highlight?: Rect;
  /** 不顯示玲玲 */
  hideNavigator?: boolean;
}

const NAVIGATOR_SCALE = 0.967;

export function showNavigatorDialog(host: HTMLElement, text: string, options: NavigatorDialogOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0';
    createDimOverlay(layer, options.highlight);
    const navigator = getAsset(BATTLE_ASSETS.navigatorLingling);
    const windowUrl = getAssetUrl(uiAsset('info_window')), buttonUrl = getAssetUrl(uiAsset('button_mini_2')), buttonPressedUrl = getAssetUrl(uiAsset('button_mini_2_dark'));
    const navigatorHtml = options.hideNavigator ? ''
      : `<i style="position:absolute;left:${designUnit(-12)};top:${designUnit(505)};width:${designUnit(navigator.width * NAVIGATOR_SCALE)};height:${designUnit(navigator.height * NAVIGATOR_SCALE)};background:url(${navigator.url}) 0 0/100% 100%"></i>`;
    layer.insertAdjacentHTML('beforeend', navigatorHtml
      + `<div class="tutorial-dialog" style="position:absolute;left:${designUnit(120)};top:${designUnit(600)};width:${designUnit(400)};height:${designUnit(340)};box-sizing:border-box;border:${designUnit(40)} solid transparent;border-image:url(${windowUrl}) 40 fill/${designUnit(40)} stretch">
          <div style="position:absolute;left:${designUnit(5)};top:${designUnit(28)};width:${designUnit(320)};font:700 ${designUnit(24)}/1.45 'PingFang TC','Noto Sans TC',sans-serif;color:#fff;white-space:pre-wrap">${text}</div>
          <button style="position:absolute;left:${designUnit(80)};top:${designUnit(195)};width:${designUnit(159)};height:${designUnit(66)};border:0;padding:0;background:url(${buttonUrl}) 0 0/100% 100%;font:900 ${designUnit(28)}/${designUnit(66)} sans-serif;color:#fff;-webkit-text-stroke:${designUnit(5)} #3a0806;paint-order:stroke fill;letter-spacing:${designUnit(4)}">確定</button>
        </div>`);
    host.appendChild(layer);
    const confirmButton = layer.querySelector('button')!;
    confirmButton.addEventListener('pointerdown', () => (confirmButton.style.backgroundImage = `url(${buttonPressedUrl})`));
    confirmButton.addEventListener('pointerup', () => { layer.remove(); resolve(); });
    void layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tutorialTiming.dialogFadeInMs }).finished;
  });
}
