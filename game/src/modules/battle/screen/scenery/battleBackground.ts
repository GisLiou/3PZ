/**
 * 戰鬥背景：天空（bg_board_000000）＋透視地面（./groundRenderer.ts）。
 * 天空與地面依螢幕高度延伸：地平線固定在頭像上方 200（v5 205/405），天空往上拉長。
 */
import { getAssetUrl } from '@core/assets/assetLoader';
import { currentStage, designUnit } from '@core/stage/stage';
import { BATTLE_ASSETS } from '../../assets/battleAssets';
import { BATTLE_LAYOUT_HEIGHT, BOARD_TOP } from '../battleLayout';
import { drawGround, GROUND_TOP } from './groundRenderer';

/** bg_board_000000：天空在上 41%（512 中的 210） */
const SKY_SHARE = 0.41;

export class BattleBackground {
  readonly element: HTMLDivElement;
  private sky: HTMLElement;
  private groundClip: HTMLElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'battle-background';
    this.element.innerHTML = '<i class="battle-sky"></i><div class="battle-ground-clip"><i class="battle-ground"></i></div>';
    parent.appendChild(this.element);
    this.sky = this.element.querySelector<HTMLElement>('.battle-sky')!;
    this.groundClip = this.element.querySelector<HTMLElement>('.battle-ground-clip')!;
    this.sky.style.backgroundImage = `url(${getAssetUrl(BATTLE_ASSETS.sky)})`;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${designUnit(640)};height:${designUnit(BOARD_TOP - GROUND_TOP)}`;
    this.element.querySelector('.battle-ground')!.appendChild(canvas);
    drawGround(canvas, getAssetUrl(BATTLE_ASSETS.ground), BOARD_TOP);
  }

  /** 依目前舞台高度重新排版（螢幕尺寸改變時呼叫） */
  layout() {
    const extraTop = currentStage.height - BATTLE_LAYOUT_HEIGHT, horizonY = extraTop + GROUND_TOP;
    const skyHeight = Math.max(640, (horizonY + 30) / SKY_SHARE);
    Object.assign(this.sky.style, { top: designUnit(horizonY + 30 - skyHeight * SKY_SHARE - 30), height: designUnit(skyHeight) });
    Object.assign(this.groundClip.style, { top: designUnit(horizonY), height: designUnit(extraTop + BOARD_TOP - horizonY) });
  }
}
