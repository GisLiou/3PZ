/**
 * 圖集零件：型別、atlasPartStyle、AtlasPartSprite、AtlasAnimation。
 */
/** 圖集座標表（src/data/atlas/*.json，由 _開發工具_不需修改/素材轉檔/slice-atlas.py 依透明度切出）的型別 */
import { getAssetUrl, getAsset } from "@core/assetLoader";
import { designUnit } from "@core/stage";
import { type CSSProperties, useEffect, useState } from "react";

export interface AtlasPartRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AtlasPart extends AtlasPartRect {
  i: number;
}
export interface Atlas {
  w: number;
  h: number;
  parts: AtlasPart[];
}
/** 輪播用的一格：[零件序號, 旋轉角度, 停留毫秒] */
export type AtlasFrame = [
  partIndex: number,
  rotationDeg: number,
  durationMs: number,
];

/**
 * 圖集零件 → 行內樣式（給直接操作 DOM 的畫面使用，例如戰鬥）。
 * 不產生新像素：用 background-position 取圖集中的一塊。rotationDeg=-90：零件在圖集中轉 90° 存放，顯示時轉回。
 */
export function atlasPartStyle(
  atlasAssetId: string,
  part: AtlasPartRect,
  atlasWidth: number,
  atlasHeight: number,
  scale = 1,
  rotationDeg = 0,
): Partial<CSSStyleDeclaration> {
  return {
    position: "absolute",
    display: "block",
    width: designUnit(part.w * scale),
    height: designUnit(part.h * scale),
    backgroundImage: `url(${getAssetUrl(atlasAssetId)})`,
    backgroundSize: `${designUnit(atlasWidth * scale)} ${designUnit(atlasHeight * scale)}`,
    backgroundPosition: `${designUnit(-part.x * scale)} ${designUnit(-part.y * scale)}`,
    transform: rotationDeg ? `rotate(${rotationDeg}deg)` : "",
  };
}

/**
 * 圖集零件顯示（React）：圖集沒有座標檔，座標由 _開發工具_不需修改/素材轉檔/slice-atlas.py 依透明度切出（src/data/atlas/*.json）。
 * 不產生新像素：直接用 CSS 取圖集中的一塊；rotationDeg=-90 表示零件在圖集中被轉 90° 存放，顯示時轉回。
 */
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

export function AtlasPartSprite({
  atlasAssetId,
  atlas,
  partIndex,
  rotationDeg = 0,
  centerX,
  centerY,
  scale = 1,
  style,
}: AtlasPartSpriteProps) {
  const part = atlas.parts[partIndex]!,
    image = getAsset(atlasAssetId);
  const width = part.w * scale,
    height = part.h * scale;
  return (
    <i
      style={{
        position: "absolute",
        left: designUnit(centerX - width / 2),
        top: designUnit(centerY - height / 2),
        width: designUnit(width),
        height: designUnit(height),
        display: "block",
        pointerEvents: "none",
        backgroundImage: `url(${image.url})`,
        backgroundSize: `${designUnit(atlas.w * scale)} ${designUnit(atlas.h * scale)}`,
        backgroundPosition: `${designUnit(-part.x * scale)} ${designUnit(-part.y * scale)}`,
        transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
        ...style,
      }}
    />
  );
}

/** 依時間軸輪播圖集零件（例：小兵走路）。frames＝[零件序號, 旋轉角度, 停留毫秒] */
export interface AtlasAnimationProps
  extends Omit<AtlasPartSpriteProps, "partIndex" | "rotationDeg"> {
  frames: AtlasFrame[];
}

export function AtlasAnimation({
  frames,
  ...spriteProps
}: AtlasAnimationProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  useEffect(() => {
    const timer = setTimeout(
      () => setFrameIndex((frameIndex + 1) % frames.length),
      frames[frameIndex]![2],
    );
    return () => clearTimeout(timer);
  }, [frameIndex, frames]);
  const [partIndex, rotationDeg] = frames[frameIndex]!;
  return (
    <AtlasPartSprite
      {...spriteProps}
      partIndex={partIndex}
      rotationDeg={rotationDeg}
    />
  );
}
