/**
 * 小兵珠子（盤面上的小兵）的圖集。圖集：遊戲素材/UI等/戰鬥效果/puzzle_image.png（無座標檔，座標見 data/atlas/puzzle_image.json）。
 * 各勢力的姿勢對照表在 ./piecePoses.json（姿勢名稱 → 零件序號；pNN＝尚未辨識的姿勢，暫以零件序號稱呼）。
 * 走路動畫的禎序與時間取自 v5 亞修實況 22151～24398 ms「連線中」視窗兩側的魏軍小兵（逐禎比對，見 docs/復刻分析/01_開場流程.md）。
 */
import atlasJson from '../atlas/puzzle_image.json';
import type { Atlas, AtlasFrame } from '@ui/atlas';

export const PIECE_ATLAS_ASSET_ID = 'UI等/戰鬥效果/puzzle_image';
export const pieceAtlas = atlasJson as Atlas;

/** 零件在圖集中被轉 90°（順時針）存放的，顯示時轉回 -90° */
const STORED_ROTATED = -90;

/** 魏軍小兵正面走路：51（左腳）→ 15（站立，旋轉存放）→ 80（右腳）→ 15，每張約 107 ms，一輪 428 ms */
export const WEI_SOLDIER_WALK_FRAMES: AtlasFrame[] = [[51, 0, 107], [15, STORED_ROTATED, 107], [80, 0, 107], [15, STORED_ROTATED, 107]];
