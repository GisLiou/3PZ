/** 單張素材圖；w/h 省略時用原圖尺寸（resources-auto 的素材本身就是 640 設計尺寸） */
import { getAsset } from '@core/assets/assetLoader';
import { layoutBoxStyle, type LayoutBoxProps } from './layoutBox';

export interface SpriteProps extends LayoutBoxProps {
  assetId: string;
  /** 'center'：x/y 代表圖的中心 */
  anchor?: 'center';
}

export function Sprite({ assetId, x = 0, y = 0, w, h, style, className, anchor }: SpriteProps) {
  const asset = getAsset(assetId), width = w ?? asset.width, height = h ?? asset.height;
  const left = anchor === 'center' ? x - width / 2 : x, top = anchor === 'center' ? y - height / 2 : y;
  return (
    <i className={className} style={{
      ...layoutBoxStyle({ x: left, y: top, w: width, h: height }),
      display: 'block', backgroundImage: `url(${asset.url})`, backgroundSize: '100% 100%', pointerEvents: 'none', ...style,
    }} />
  );
}
