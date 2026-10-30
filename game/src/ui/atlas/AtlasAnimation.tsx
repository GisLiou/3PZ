/** 依時間軸輪播圖集零件（例：小兵走路）。frames＝[零件序號, 旋轉角度, 停留毫秒] */
import { useEffect, useState } from 'react';
import { AtlasPartSprite, type AtlasPartSpriteProps } from './AtlasPartSprite';
import type { AtlasFrame } from './atlasTypes';

export interface AtlasAnimationProps extends Omit<AtlasPartSpriteProps, 'partIndex' | 'rotationDeg'> { frames: AtlasFrame[] }

export function AtlasAnimation({ frames, ...spriteProps }: AtlasAnimationProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setFrameIndex((frameIndex + 1) % frames.length), frames[frameIndex]![2]);
    return () => clearTimeout(timer);
  }, [frameIndex, frames]);
  const [partIndex, rotationDeg] = frames[frameIndex]!;
  return <AtlasPartSprite {...spriteProps} partIndex={partIndex} rotationDeg={rotationDeg} />;
}
