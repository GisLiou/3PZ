/** 戰鬥的資料型別：部隊成員、敵人的定義（由關卡／教學資料提供）與戰鬥中的狀態 */
import type { Faction } from './board/pieceKinds';
import type { MatchGroup } from './board/boardRules';

/** 我方武將（部隊成員）的定義 */
export interface PartyMemberDefinition {
  id: string;
  faction: Faction;
  attack: number;
  recovery: number;
  hp: number;
  /** 頭像素材 id */
  portraitAssetId: string;
}

/** 敵人的定義。x,y＝腳底位置（底部 999 版面的設計單位），scale＝立繪縮放 */
export interface EnemyDefinition {
  id: string;
  name?: string;
  /** 立繪素材 id */
  artAssetId: string;
  faction: Faction;
  hp: number;
  attack: number;
  /** 每幾回合攻擊一次（頭上「殘 N」的起始值） */
  attackInterval: number;
  x: number;
  y: number;
  scale: number;
  /** 是否在腳下顯示名牌 */
  showName?: boolean;
}

/** 軍略（大將技能）：指定勢力的武將攻擊力變為 multiplier 倍 */
export interface LeaderSkill { faction: Faction; factionName: string; multiplier: number }

/** 一回合的結果 */
export interface TurnResult { groups: MatchGroup[]; combos: number }
