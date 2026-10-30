/**
 * 圖集零件顯示（React）：圖集沒有座標檔，座標由 tools/assets/slice-atlas.py 依透明度切出（src/data/atlas/*.json）。
 * 不產生新像素：直接用 CSS 取圖集中的一塊；rotationDeg=-90 表示零件在圖集中被轉 90° 存放，顯示時轉回。
 */
import type { CSSProperties } from 'react';
import { getAsset } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import type { Atlas } from './atlasTypes';

export interface AtlasPartSpriteProps {
  atlasAssetId: string;
  atlas: Atlas;
  partIndex: number;
  rotationDeg?: number;
  /** 顯示中心（設計單位） */
  centerX: number;
  centerY: number;
  /** 相對圖集原尺寸的縮放 */
  scale?: number;
  style?: CSSProperties;
}

export function AtlasPartSprite({ atlasAssetId, atlas, partIndex, rotationDeg = 0, centerX, centerY, scale = 1, style }: AtlasPartSpriteProps) {
  const part = atlas.parts[partIndex]!, image = getAsset(atlasAssetId);
  const width = part.w * scale, height = part.h * scale;
  return (
    <i style={{
      position: 'absolute', left: designUnit(centerX - width / 2), top: designUnit(centerY - height / 2), width: designUnit(width), height: designUnit(height),
      display: 'block', pointerEvents: 'none',
      backgroundImage: `url(${image.url})`, backgroundSize: `${designUnit(atlas.w * scale)} ${designUnit(atlas.h * scale)}`,
      backgroundPosition: `${designUnit(-part.x * scale)} ${designUnit(-part.y * scale)}`, transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined, ...style,
    }} />
  );
}
