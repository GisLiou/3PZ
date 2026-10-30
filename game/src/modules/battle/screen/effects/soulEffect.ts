/**
 * 魂（v1 119 133～119 433）：組的格子空出後，一道粉紅白魂柱從組中心升到武將列（100 ms），
 * 再分成每個目標一團、飄到目標上方後消失（167 ms）。
 */
import { getAssetSize, getAssetUrl } from '@core/assets/assetLoader';
import { designUnit, translateUnits } from '@core/stage/stage';
import { BATTLE_ASSETS } from '../../assets/battleAssets';
import { matchTiming } from '../../timing/battleTiming';
import { createImageElement, PORTRAIT_TOP } from '../battleLayout';

/** 魂的粉紅色：原圖是白色雲，原版畫面上帶粉紅（以 CSS 濾鏡上色，見 自製素材 README #10） */
const SOUL_TINT = 'sepia(.5) saturate(4) hue-rotate(280deg) brightness(1.15)';

export async function playSoulFlight(layer: HTMLElement, fromX: number, fromY: number, targets: Array<{ x: number; y: number }>) {
  const soulSize = getAssetSize(BATTLE_ASSETS.soul), soulBackground = `url(${getAssetUrl(BATTLE_ASSETS.soul)}) 0 0/100% 100%`;
  // 魂柱：雲轉直立，底部在組中心，頂端往上拉到武將列
  const column = createImageElement(layer, {
    left: designUnit(-soulSize.height / 2), top: designUnit(-soulSize.width), width: designUnit(soulSize.height), height: designUnit(soulSize.width),
    background: soulBackground, filter: SOUL_TINT, transformOrigin: '50% 100%',
  });
  const startScaleY = 0.9, endScaleY = Math.max(1, (fromY - PORTRAIT_TOP - 30) / soulSize.width);
  await column.animate([
    { transform: translateUnits(fromX, fromY + 20, ` scale(1.1,${startScaleY})`), opacity: 1 },
    { transform: translateUnits(fromX, fromY - 10, ` scale(1.2,${endScaleY})`), opacity: 1 },
  ], { duration: matchTiming.soulRiseMs, fill: 'forwards', easing: 'ease-in' }).finished;
  column.remove();
  // 分成數團，飄到目標
  const startY = PORTRAIT_TOP + 40;
  await Promise.all(targets.map((target) => {
    const puff = createImageElement(layer, {
      left: designUnit(-soulSize.width * 0.25), top: designUnit(-soulSize.height * 0.4), width: designUnit(soulSize.width * 0.5), height: designUnit(soulSize.height * 0.8),
      background: soulBackground, filter: SOUL_TINT,
    });
    return puff.animate([
      { transform: translateUnits(fromX, startY, ' scale(1)'), opacity: 1 },
      { transform: translateUnits((fromX + target.x) / 2, (startY + target.y) / 2, ' scale(.9)'), opacity: 1, offset: 0.5 },
      { transform: translateUnits(target.x, target.y, ' scale(.7)'), opacity: 0 },
    ], { duration: matchTiming.soulSpreadMs, fill: 'forwards' }).finished.then(() => puff.remove());
  }));
}
