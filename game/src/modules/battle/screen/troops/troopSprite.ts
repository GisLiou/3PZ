/**
 * 攻擊時衝向敵人的大隻小兵（背面）。素材：遊戲素材/UI等/戰鬥效果/attack<勢力><兵種>.png（256×512 圖集，零件座標由 tools/assets/slice-atlas.py 切出）。
 * 勢力 0 魏、1 吳、2 蜀、3 漢、4 群；兵種 0 騎兵、2 槍兵（其餘兵種之後依武將資料補上）。
 * 影片（v1 123 533～124 400）：紅、紫為槍兵，灰為騎兵；小兵直立背面，左右腳交替前進。
 */
import { getAssetUrl } from '@core/assets/assetLoader';
import { designUnit } from '@core/stage/stage';
import type { AtlasPartRect } from '@ui/atlas';
import type { Faction } from '../../board/pieceKinds';
import weiSpearman from '@data/atlas/attack02.json';
import wuSpearman from '@data/atlas/attack12.json';
import shuSpearman from '@data/atlas/attack22.json';
import hanSpearman from '@data/atlas/attack32.json';
import qunSpearman from '@data/atlas/attack42.json';
import qunCavalry from '@data/atlas/attack40.json';

/** 圖集檔名中的勢力編號 */
const FACTION_INDEX: Record<Faction, number> = { wei: 0, wu: 1, shu: 2, han: 3, qun: 4 };
const SPEARMAN_PARTS: Record<Faction, AtlasPartRect[]> = { wei: weiSpearman.parts, wu: wuSpearman.parts, shu: shuSpearman.parts, han: hanSpearman.parts, qun: qunSpearman.parts };

/** 跑步用的直立背面零件（槍兵：零件 0、2 左右腳；騎兵：零件 1） */
export function getTroopFrames(faction: Faction): { assetId: string; frames: AtlasPartRect[] } {
  if (faction === 'qun') return { assetId: 'UI等/戰鬥效果/attack40', frames: [qunCavalry.parts[1]!] };
  const parts = SPEARMAN_PARTS[faction];
  return { assetId: `UI等/戰鬥效果/attack${FACTION_INDEX[faction]}2`, frames: [parts[0]!, parts[2]!] };
}

/** 把小兵畫在 element（腳底中心為原點），frameIndex 為第幾張 */
export function paintTroopSprite(element: HTMLElement, faction: Faction, frameIndex: number, scale = 0.8) {
  const { assetId, frames } = getTroopFrames(faction), part = frames[frameIndex % frames.length]!;
  Object.assign(element.style, {
    left: designUnit(-part.w * scale / 2), top: designUnit(-part.h * scale), width: designUnit(part.w * scale), height: designUnit(part.h * scale),
    backgroundImage: `url(${getAssetUrl(assetId)})`, backgroundSize: `${designUnit(256 * scale)} ${designUnit(512 * scale)}`,
    backgroundPosition: `${designUnit(-part.x * scale)} ${designUnit(-part.y * scale)}`, backgroundRepeat: 'no-repeat',
  });
}
