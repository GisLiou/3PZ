/**
 * 一般 UI 元件：layoutBoxStyle（x, y, w, h）、uiAsset、Sprite、NineSliceFrame、TextLabel、SpriteButton。
 */
/** 共用的定位屬性：x/y/寬/高皆為設計單位（640 寬），省略的不設定 */
import {
  type CSSProperties,
  type ReactNode,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { designUnit } from "@core/stage";
import { getAsset, getAssetUrl } from "@core/assetLoader";

export interface LayoutBoxProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  style?: CSSProperties;
  className?: string;
}

export const layoutBoxStyle = ({
  x,
  y,
  w,
  h,
}: LayoutBoxProps): CSSProperties => ({
  position: "absolute",
  left: x != null ? designUnit(x) : undefined,
  top: y != null ? designUnit(y) : undefined,
  width: w != null ? designUnit(w) : undefined,
  height: h != null ? designUnit(h) : undefined,
});

/** 介面素材 id 捷徑：uiAsset('title') === 'UI等/界面/resources-auto/title' */
export const uiAsset = (name: string) => `UI等/界面/resources-auto/${name}`;

/** 單張素材圖；w/h 省略時用原圖尺寸（resources-auto 的素材本身就是 640 設計尺寸） */
export interface SpriteProps extends LayoutBoxProps {
  assetId: string;
  /** 'center'：x/y 代表圖的中心 */
  anchor?: "center";
}

export function Sprite({
  assetId,
  x = 0,
  y = 0,
  w,
  h,
  style,
  className,
  anchor,
}: SpriteProps) {
  const asset = getAsset(assetId),
    width = w ?? asset.width,
    height = h ?? asset.height;
  const left = anchor === "center" ? x - width / 2 : x,
    top = anchor === "center" ? y - height / 2 : y;
  return (
    <i
      className={className}
      style={{
        ...layoutBoxStyle({ x: left, y: top, w: width, h: height }),
        display: "block",
        backgroundImage: `url(${asset.url})`,
        backgroundSize: "100% 100%",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

/** 九宮格視窗（例：info_window）。slice＝原圖四邊不可拉伸的寬度 */
export interface NineSliceFrameProps extends LayoutBoxProps {
  assetId: string;
  slice: number;
  children?: ReactNode;
}

export function NineSliceFrame({
  assetId,
  slice,
  children,
  ...box
}: NineSliceFrameProps) {
  return (
    <div
      className={box.className}
      style={{
        ...layoutBoxStyle(box),
        boxSizing: "border-box",
        borderStyle: "solid",
        borderWidth: designUnit(slice),
        borderImage: `url(${getAssetUrl(assetId)}) ${slice} fill / ${designUnit(slice)} stretch`,
        ...box.style,
      }}
    >
      {children}
    </div>
  );
}

/** 文字：原版樣式為白字黑描邊（系統繁中字型＋CSS 描邊）。size／stroke 為設計單位 */
export interface TextLabelProps extends LayoutBoxProps {
  children: ReactNode;
  size?: number;
  color?: string;
  /** 描邊粗細；0＝不描邊 */
  stroke?: number;
  strokeColor?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

export function TextLabel({
  children,
  size = 26,
  color = "#fff",
  stroke = 4,
  strokeColor = "#000",
  align,
  bold = true,
  ...box
}: TextLabelProps) {
  return (
    <span
      className={box.className}
      style={{
        ...layoutBoxStyle(box),
        fontSize: designUnit(size),
        lineHeight: 1.25,
        color,
        fontWeight: bold ? 900 : 500,
        textAlign: align,
        WebkitTextStroke: stroke
          ? `${designUnit(stroke)} ${strokeColor}`
          : undefined,
        paintOrder: "stroke fill",
        whiteSpace: "pre-wrap",
        ...box.style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * 素材按鈕：按下時換成 _dark 版本（原版的按下效果），放開且手指仍在按鈕上才觸發 onTap。
 * 用 pointer 事件而非 click，手機上沒有 300ms 延遲。
 */
export interface SpriteButtonProps extends LayoutBoxProps {
  assetId: string;
  /** 按下時的素材（通常是 xxx_dark） */
  pressedAssetId?: string;
  onTap?: () => void;
  children?: ReactNode;
  disabled?: boolean;
}

export function SpriteButton({
  assetId,
  pressedAssetId,
  onTap,
  children,
  disabled,
  ...box
}: SpriteButtonProps) {
  const [pressed, setPressed] = useState(false);
  const asset = getAsset(pressed && pressedAssetId ? pressedAssetId : assetId);
  const width = box.w ?? asset.width,
    height = box.h ?? asset.height;
  const release = (event: ReactPointerEvent, shouldFire: boolean) => {
    if (!pressed) return;
    setPressed(false);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (shouldFire && !disabled && inside) onTap?.();
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={(event) => release(event, true)}
      onPointerCancel={(event) => release(event, false)}
      onPointerLeave={(event) => release(event, false)}
      style={{
        ...layoutBoxStyle({ ...box, w: width, h: height }),
        border: 0,
        padding: 0,
        background: `url(${asset.url}) 0 0/100% 100% no-repeat`,
        cursor: "pointer",
        ...box.style,
      }}
    >
      {children}
    </button>
  );
}
