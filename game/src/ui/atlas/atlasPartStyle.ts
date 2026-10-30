/**
 * 圖集零件 → 行內樣式（給直接操作 DOM 的畫面使用，例如戰鬥）。
 * 不產生新像素：用 background-position 取圖集中的一塊。rotationDeg=-90：零件在圖集中轉 90° 存放，顯示時轉回。
 */
import { getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import type { AtlasPartRect } from './atlasTypes';

export function atlasPartStyle(atlasAssetId: string, part: AtlasPartRect, atlasWidth: number, atlasHeight: number, scale = 1, rotationDeg = 0): Partial<CSSStyleDeclaration> {
  return {
    position: 'absolute', display: 'block',
    width: designUnit(part.w * scale), height: designUnit(part.h * scale),
    backgroundImage: `url(${getAssetUrl(atlasAssetId)})`,
    backgroundSize: `${designUnit(atlasWidth * scale)} ${designUnit(atlasHeight * scale)}`,
    backgroundPosition: `${designUnit(-part.x * scale)} ${designUnit(-part.y * scale)}`,
    transform: rotationDeg ? `rotate(${rotationDeg}deg)` : '',
  };
}
