/**
 * 共用 UI 元件（全部以原版素材組成，座標與尺寸一律用 640 寬的設計單位）。
 * resources-auto 的素材本身就是 640 設計尺寸，所以「原圖尺寸 = 設計尺寸」，不另外縮放。
 */
export { layoutBoxStyle, type LayoutBoxProps } from './layoutBox';
export { uiAsset } from './uiAsset';
export { Sprite, type SpriteProps } from './Sprite';
export { NineSliceFrame, type NineSliceFrameProps } from './NineSliceFrame';
export { TextLabel, type TextLabelProps } from './TextLabel';
export { SpriteButton, type SpriteButtonProps } from './SpriteButton';
