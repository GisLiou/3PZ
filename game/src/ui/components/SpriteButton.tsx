/**
 * 素材按鈕：按下時換成 _dark 版本（原版的按下效果），放開且手指仍在按鈕上才觸發 onTap。
 * 用 pointer 事件而非 click，手機上沒有 300ms 延遲。
 */
import { useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { getAsset } from '@core/assets/assetLoader';
import { layoutBoxStyle, type LayoutBoxProps } from './layoutBox';

export interface SpriteButtonProps extends LayoutBoxProps {
  assetId: string;
  /** 按下時的素材（通常是 xxx_dark） */
  pressedAssetId?: string;
  onTap?: () => void;
  children?: ReactNode;
  disabled?: boolean;
}

export function SpriteButton({ assetId, pressedAssetId, onTap, children, disabled, ...box }: SpriteButtonProps) {
  const [pressed, setPressed] = useState(false);
  const asset = getAsset(pressed && pressedAssetId ? pressedAssetId : assetId);
  const width = box.w ?? asset.width, height = box.h ?? asset.height;
  const release = (event: ReactPointerEvent, shouldFire: boolean) => {
    if (!pressed) return;
    setPressed(false);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (shouldFire && !disabled && inside) onTap?.();
  };
  return (
    <button type="button" disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)} onPointerUp={(event) => release(event, true)} onPointerCancel={(event) => release(event, false)} onPointerLeave={(event) => release(event, false)}
      style={{ ...layoutBoxStyle({ ...box, w: width, h: height }), border: 0, padding: 0, background: `url(${asset.url}) 0 0/100% 100% no-repeat`, cursor: 'pointer', ...box.style }}>
      {children}
    </button>
  );
}
