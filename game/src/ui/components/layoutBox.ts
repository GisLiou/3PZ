/** 共用的定位屬性：x/y/寬/高皆為設計單位（640 寬），省略的不設定 */
import type { CSSProperties } from 'react';
import { designUnit } from '@core/stage/stage';

export interface LayoutBoxProps { x?: number; y?: number; w?: number; h?: number; style?: CSSProperties; className?: string }

export const layoutBoxStyle = ({ x, y, w, h }: LayoutBoxProps): CSSProperties => ({
  position: 'absolute', left: x != null ? designUnit(x) : undefined, top: y != null ? designUnit(y) : undefined,
  width: w != null ? designUnit(w) : undefined, height: h != null ? designUnit(h) : undefined,
});
