/** 九宮格視窗（例：info_window）。slice＝原圖四邊不可拉伸的寬度 */
import type { ReactNode } from 'react';
import { getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import { layoutBoxStyle, type LayoutBoxProps } from './layoutBox';

export interface NineSliceFrameProps extends LayoutBoxProps { assetId: string; slice: number; children?: ReactNode }

export function NineSliceFrame({ assetId, slice, children, ...box }: NineSliceFrameProps) {
  return (
    <div className={box.className} style={{
      ...layoutBoxStyle(box), boxSizing: 'border-box', borderStyle: 'solid', borderWidth: designUnit(slice),
      borderImage: `url(${getAssetUrl(assetId)}) ${slice} fill / ${designUnit(slice)} stretch`, ...box.style,
    }}>{children}</div>
  );
}
