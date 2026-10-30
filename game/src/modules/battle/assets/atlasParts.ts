/**
 * 戰鬥用圖集的零件（座標表 data/atlas/*.json 由 tools/assets/slice-atlas.py 依透明度切出）。
 * rotationDeg=-90：零件在圖集中轉 90° 存放，顯示時轉回。
 */
import { atlasPartStyle, type AtlasPartRect } from '@ui/atlas';
import layoutAtlas from '@data/atlas/puzzlelayout.json';
import tutorialAtlas from '@data/atlas/tutorialImg.json';
import effectAtlas from '@data/atlas/effect_data.json';
import { BATTLE_ASSETS } from './battleAssets';

const layoutParts = (layoutAtlas as { parts: AtlasPartRect[] }).parts;
const tutorialParts = (tutorialAtlas as { parts: AtlasPartRect[] }).parts;
const effectParts = (effectAtlas as { parts: AtlasPartRect[] }).parts;

/** puzzlelayout（512×1024）零件用途（對照 docs/復刻分析/02 §3） */
export const LAYOUT_PART = { hpBarBackground: 2, hpBarPink: 5, messageBand: 7, chest: 37, heart: 61, menuText: 51, target: 50, targetRing: 25 } as const;
/** tutorialImg（128×256）零件：0 直條、1 手(右指)、2 橫條、3 手(上指)、4 ▶、5 ●、6 ▼、7 ◀ */
export const TUTORIAL_PART = { verticalBar: 0, handPointRight: 1, horizontalBar: 2, handPointUp: 3, arrowRight: 4, dot: 5, arrowDown: 6, arrowLeft: 7 } as const;
/** effect_data（512×1024）零件：6 紅色血花、13 白色放射光、0 紅色斬線、5 白色弧光 */
export const EFFECT_PART = { redSlash: 0, whiteArc: 5, bloodSplash: 6, whiteRays: 13 } as const;

export const layoutPartStyle = (index: number, scale = 1, rotationDeg = 0) => atlasPartStyle(BATTLE_ASSETS.layoutAtlas, layoutParts[index]!, 512, 1024, scale, rotationDeg);
export const layoutPartRect = (index: number) => layoutParts[index]!;
export const tutorialPartStyle = (index: number, scale = 1) => atlasPartStyle(BATTLE_ASSETS.tutorialAtlas, tutorialParts[index]!, 128, 256, scale);
export const tutorialPartRect = (index: number) => tutorialParts[index]!;
export const effectPartStyle = (index: number, scale = 1) => atlasPartStyle(BATTLE_ASSETS.effectAtlas, effectParts[index]!, 512, 1024, scale);
export const effectPartRect = (index: number) => effectParts[index]!;
