/**
 * 小兵圖：全部取自圖集 遊戲素材/UI等/戰鬥效果/puzzle_image.png（無座標檔，零件座標見 data/atlas/puzzle_image.json）。
 * 每個勢力 13 個姿勢（站立、拿起 A/B、走路 A/B、正面、舉手…），姿勢對應表 data/pieces/piecePoses.json 的產生方式見 docs/復刻分析/02_教學戰鬥1.md §2。
 * 部分零件在圖集中轉 90° 存放（rot=-90），顯示時轉回；白色剪影零件（white）用於消除時變白。
 */
import { getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import { PIECE_ATLAS_ASSET_ID, pieceAtlas } from '@data/pieces/pieceAtlas';
import posesJson from '@data/pieces/piecePoses.json';
import type { PieceKind } from '../board/pieceKinds';

/** 小兵姿勢。facingFront＝正面朝玩家；armsOpen＝雙手張開（跳起）；raiseHand＝舉手（武將頭上） */
export type PiecePose = 'stand' | 'holdA' | 'holdB' | 'walkA' | 'walkB' | 'facingFront' | 'raiseHand' | 'armsOpen';
interface PoseDefinition { part: number; rot: number; white?: number }
const POSES = posesJson as unknown as Record<PieceKind, Record<string, PoseDefinition>>;

/** 取得姿勢定義；沒有該姿勢（例：桃子沒有拿起／走路）時一律用站立圖 */
export function getPoseDefinition(kind: PieceKind, pose: PiecePose): PoseDefinition {
  const poses = POSES[kind];
  return poses[pose] ?? poses.stand!;
}

/**
 * 把一個 <i> 設成指定的小兵姿勢。元素以自身中心為基準（外層負責定位）。
 * white=true 時改用同姿勢的白色剪影（沒有剪影的姿勢退回站立剪影）。
 */
export function paintPieceSprite(element: HTMLElement, kind: PieceKind, pose: PiecePose, white = false) {
  let definition = getPoseDefinition(kind, pose);
  if (white && definition.white == null) definition = getPoseDefinition(kind, 'stand');
  const part = pieceAtlas.parts[white ? definition.white! : definition.part]!;
  const style = element.style;
  style.width = designUnit(part.w);
  style.height = designUnit(part.h);
  style.marginLeft = designUnit(-part.w / 2);
  style.marginTop = designUnit(-part.h / 2);
  style.backgroundImage = `url(${getAssetUrl(PIECE_ATLAS_ASSET_ID)})`;
  style.backgroundSize = `${designUnit(pieceAtlas.w)} ${designUnit(pieceAtlas.h)}`;
  style.backgroundPosition = `${designUnit(-part.x)} ${designUnit(-part.y)}`;
  style.transform = definition.rot ? `rotate(${definition.rot}deg)` : '';
}
