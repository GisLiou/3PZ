/** 圖集座標表（src/data/atlas/*.json，由 tools/assets/slice-atlas.py 依透明度切出）的型別 */
export interface AtlasPartRect { x: number; y: number; w: number; h: number }
export interface AtlasPart extends AtlasPartRect { i: number }
export interface Atlas { w: number; h: number; parts: AtlasPart[] }
/** 輪播用的一格：[零件序號, 旋轉角度, 停留毫秒] */
export type AtlasFrame = [partIndex: number, rotationDeg: number, durationMs: number];
