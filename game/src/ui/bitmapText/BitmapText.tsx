/**
 * 顯示點陣字（React）。h＝顯示高度（設計單位），省略則用原字高。
 * anchor：x,y 代表的位置（'center' 置中、'right' 右對齊）。
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { designUnit } from '@core/stage/stage';
import { getCachedBitmapText, renderBitmapText, type RenderedText } from './renderBitmapText';

export interface BitmapTextProps {
  font: string;
  text: string;
  color?: string;
  h?: number;
  x?: number;
  y?: number;
  anchor?: 'left' | 'center' | 'right';
  spacing?: number;
  style?: CSSProperties;
  className?: string;
}

export function BitmapText({ font, text, color, h, x = 0, y = 0, anchor = 'left', spacing = 0, style, className }: BitmapTextProps) {
  const [rendered, setRendered] = useState<RenderedText | null>(() => getCachedBitmapText(font, text, color, spacing) ?? null);
  useEffect(() => {
    let mounted = true;
    void renderBitmapText(font, text, color, spacing).then((result) => mounted && setRendered(result));
    return () => { mounted = false; };
  }, [font, text, color, spacing]);
  if (!rendered) return null;
  const scale = h ? h / rendered.height : 1, width = rendered.width * scale, height = rendered.height * scale;
  const left = anchor === 'center' ? x - width / 2 : anchor === 'right' ? x - width : x;
  return <i className={className} style={{ position: 'absolute', left: designUnit(left), top: designUnit(y), width: designUnit(width), height: designUnit(height), display: 'block', pointerEvents: 'none', background: `url(${rendered.url}) 0 0/100% 100% no-repeat`, ...style }} />;
}
