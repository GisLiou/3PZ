/**
 * 共用 UI 元件（全部以原版素材組成，座標與尺寸一律用 640 寬的設計單位：x, y, w, h）。
 * resources-auto 的素材本身就是 640 設計尺寸，所以「原圖尺寸 = 設計尺寸」，不另外縮放。
 *   components.tsx  Sprite、NineSliceFrame、TextLabel、SpriteButton、layoutBoxStyle、uiAsset
 *   atlas.tsx       圖集零件：AtlasPartSprite、AtlasAnimation、atlasPartStyle（座標表 data/atlas/*.json）
 *   bitmapText.tsx  原版點陣字：BitmapText、renderBitmapText
 *   TutorialOverlay.ts  教學遮罩（擋操作、變暗、高亮、玲玲對話）與 JSON 教學步驟執行器 runTutorialSteps
 */
export * from "./components";
export * from "./atlas";
export * from "./bitmapText";
export * from "./TutorialOverlay";
