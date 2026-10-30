/** 命中與死亡的特效（畫在效果層）：爆光、放射光、光環、斬線、死亡煙霧、敵人攻擊的血花 */
import { getAssetSize, getAssetUrl } from '@core/assets/assetLoader';
import { designUnit, translateUnits } from '@core/stage/stage';
import { BATTLE_ASSETS } from '../../assets/battleAssets';
import { EFFECT_PART, effectPartRect, effectPartStyle } from '../../assets/atlasParts';
import { attackTiming } from '../../timing/battleTiming';
import { createImageElement } from '../battleLayout';

/** 以素材原尺寸 × scale 建立一個置中於原點的特效圖 */
function createCenteredEffect(layer: HTMLElement, assetId: string, scale: number, extraStyle: Partial<CSSStyleDeclaration> = {}) {
  const size = getAssetSize(assetId);
  return createImageElement(layer, {
    left: designUnit(-size.width * scale / 2), top: designUnit(-size.height * scale / 2), width: designUnit(size.width * scale), height: designUnit(size.height * scale),
    backgroundImage: `url(${getAssetUrl(assetId)})`, backgroundSize: '100% 100%', ...extraStyle,
  });
}

/**
 * 命中爆光：attackeffect2 由小放大再淡出，加上放射光與光環（v1 124 200～124 467，約 267 ms）。
 * withSlash＝加上斬線（attackeffect1）。
 */
export async function playHitBurst(layer: HTMLElement, x: number, y: number, filter = '', withSlash = false) {
  const burst = createCenteredEffect(layer, BATTLE_ASSETS.hitBurst, 0.85, { filter });
  const rays = createCenteredEffect(layer, BATTLE_ASSETS.hitRays, 0.45, { filter });
  const ring = createCenteredEffect(layer, BATTLE_ASSETS.hitRing, 0.7, { filter });
  const duration = attackTiming.hitEffectMs;
  const effects = [burst, rays, ring];
  const animations = [
    burst.animate([
      { transform: translateUnits(x, y, ' scale(.25)'), opacity: 1 }, { transform: translateUnits(x, y, ' scale(1)'), opacity: 1, offset: 0.4 },
      { transform: translateUnits(x, y, ' scale(1.15)'), opacity: 1, offset: 0.75 }, { transform: translateUnits(x, y, ' scale(1.25)'), opacity: 0 },
    ], { duration }).finished,
    rays.animate([{ transform: translateUnits(x, y + 40, ' scale(.3)'), opacity: 1 }, { transform: translateUnits(x, y + 40, ' scale(1.1)'), opacity: 0 }], { duration }).finished,
    ring.animate([{ transform: translateUnits(x, y, ' scale(.3)'), opacity: 0.9 }, { transform: translateUnits(x, y, ' scale(1.2)'), opacity: 0 }], { duration }).finished,
  ];
  if (withSlash) {
    const slash = createCenteredEffect(layer, BATTLE_ASSETS.hitSlash, 0.6);
    effects.push(slash);
    animations.push(slash.animate([
      { transform: translateUnits(x, y, ' rotate(-30deg) scale(.6,.4)'), opacity: 1 }, { transform: translateUnits(x, y, ' rotate(-30deg) scale(1,1)'), opacity: 1, offset: 0.35 },
      { transform: translateUnits(x, y, ' rotate(-30deg) scale(1.1,1.1)'), opacity: 0 },
    ], { duration: duration + 60 }).finished);
  }
  await Promise.all(animations);
  effects.forEach((element) => element.remove());
}

/** 死亡煙霧：三團煙往左、中、右散開（原版黑色爆炸素材尚未找到，以濾鏡調暗，見 自製素材 README #13） */
export function playEnemyDeathSmoke(layer: HTMLElement, x: number, y: number) {
  BATTLE_ASSETS.deathSmoke.forEach((assetId, index) => {
    const smoke = createCenteredEffect(layer, assetId, 1, { filter: 'brightness(.25) sepia(.6)' });
    const spread = (index - 1) * 0.9;
    void smoke.animate(
      [{ transform: translateUnits(x, y, ' scale(.6)'), opacity: 0.9 }, { transform: translateUnits(x + spread * 70, y - 20 - index * 6, ' scale(1.6)'), opacity: 0 }],
      { duration: attackTiming.enemyDeathSmokeMs, fill: 'forwards' },
    ).finished.then(() => smoke.remove());
  });
}

/** 敵人攻擊時身上濺出的紅色血花（effect_data 零件 6），每 53 ms 一個 */
export function playBloodSplashes(layer: HTMLElement, spots: Array<[number, number]>) {
  const rect = effectPartRect(EFFECT_PART.bloodSplash), scale = 0.55;
  spots.forEach(([x, y], index) => {
    const splash = createImageElement(layer, { ...effectPartStyle(EFFECT_PART.bloodSplash, scale), left: designUnit(-rect.w * scale / 2), top: designUnit(-rect.h * scale / 2) });
    void splash.animate(
      [{ transform: translateUnits(x, y, ' scale(.4)'), opacity: 0 }, { transform: translateUnits(x, y, ' scale(1)'), opacity: 1, offset: 0.25 }, { transform: translateUnits(x, y, ' scale(1.1)'), opacity: 0 }],
      { duration: attackTiming.bloodSplashMs, delay: index * attackTiming.enemyStrikeBlinkMs, fill: 'backwards' },
    ).finished.then(() => splash.remove());
  });
}

/** 全畫面泛紅（敵人攻擊；原版實作不明，以半透明紅色矩形代替，見 自製素材 README #14） */
export function playScreenRedFlash(screen: HTMLElement) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, { position: 'absolute', inset: '0', background: 'rgba(230,40,20,.38)', pointerEvents: 'none', zIndex: '6', opacity: '0' });
  screen.appendChild(overlay);
  void overlay.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: attackTiming.enemyStrikeRedFlashMs }).finished.then(() => overlay.remove());
}
