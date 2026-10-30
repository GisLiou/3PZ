/** 文字：原版樣式為白字黑描邊（系統繁中字型＋CSS 描邊）。size／stroke 為設計單位 */
import type { ReactNode } from 'react';
import { designUnit } from '@core/stage/stage';
import { layoutBoxStyle, type LayoutBoxProps } from './layoutBox';

export interface TextLabelProps extends LayoutBoxProps {
  children: ReactNode;
  size?: number;
  color?: string;
  /** 描邊粗細；0＝不描邊 */
  stroke?: number;
  strokeColor?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

export function TextLabel({ children, size = 26, color = '#fff', stroke = 4, strokeColor = '#000', align, bold = true, ...box }: TextLabelProps) {
  return (
    <span className={box.className} style={{
      ...layoutBoxStyle(box), fontSize: designUnit(size), lineHeight: 1.25, color, fontWeight: bold ? 900 : 500, textAlign: align,
      WebkitTextStroke: stroke ? `${designUnit(stroke)} ${strokeColor}` : undefined, paintOrder: 'stroke fill', whiteSpace: 'pre-wrap', ...box.style,
    }}>{children}</span>
  );
}
