/**
 * 戰鬥用素材 id（全部為 遊戲素材/ 的原版檔案，路徑＝素材 id）。
 * 圖集零件序號見 ./atlasParts.ts。
 */
import type { Faction, PieceKind } from '../board/pieceKinds';

export const BATTLE_ASSETS = {
  sky: 'UI等/戰鬥背景/bg_board/bg_board_000000',
  ground: 'UI等/ground/ground_000000',
  boardGrid: 'UI等/戰鬥效果/新建文件夾/pazzle_grid',
  menuButton: 'UI等/戰鬥效果/新建文件夾/button',
  partyHpGauge: 'UI等/戰鬥效果/新建文件夾/pazzle_myhpgauge',
  enemyHpFrame: 'UI等/戰鬥效果/新建文件夾/HPBarFrame1',
  enemyHpFill: 'UI等/戰鬥效果/新建文件夾/HPGaugeBase',
  enemyNamePlate: 'UI等/戰鬥效果/新建文件夾/namePlate',
  layoutAtlas: 'UI等/戰鬥效果/puzzlelayout',
  tutorialAtlas: 'UI等/戰鬥效果/tutorialImg',
  effectAtlas: 'UI等/戰鬥效果/effect_data',
  victoryChar1: 'UI等/戰鬥特效/win_efe01', victoryChar2: 'UI等/戰鬥特效/win_efe02', victoryChar3: 'UI等/戰鬥特效/win_efe03', victoryLight: 'UI等/戰鬥特效/win_efe04',
  hitBurst: 'UI等/戰鬥特效/attackeffect2',
  hitSlash: 'UI等/戰鬥特效/attackeffect1',
  hitRays: 'UI等/戰鬥特效/attackeffect14',
  hitRing: 'UI等/戰鬥特效/attackeffect16',
  /** 右上角的勢力相剋圖 */
  factionRelationChart: 'UI等/勢力相剋/L/adv_sa_468301_l',
  /** 魂（白色雲，畫面上以濾鏡染成粉紅） */
  soul: 'UI等/戰鬥特效/ef_souldrop00',
  /** 敵人死亡的煙霧 */
  deathSmoke: ['UI等/戰鬥特效/ef_souldrop03', 'UI等/戰鬥特效/ef_souldrop04', 'UI等/戰鬥特效/ef_souldrop05'],
  /** 戰鬥中的玲玲（全身）；表情零件 eye_/mouth_/mayu_*_s 的合成位置尚未解出（docs/復刻分析/02 §待確認） */
  navigatorLingling: 'UI等/鈴鈴/naviBase_s',
} as const;

/** 勢力光焰（軍略發動時武將頭上的光，kouyou_*） */
export const FACTION_AURA_ASSETS: Record<Faction, string> = {
  wei: 'UI等/戰鬥特效/kouyou_blue_1', wu: 'UI等/戰鬥特效/kouyou_red1', shu: 'UI等/戰鬥特效/kouyou_green1',
  han: 'UI等/戰鬥特效/kouyou_purple1', qun: 'UI等/戰鬥特效/kouyou_gray1',
};

/** 傷害數字顏色（v5 149385：蜀綠 84、漢紫 129、群白 92） */
export const DAMAGE_NUMBER_COLORS: Record<PieceKind, string> = { wei: '#3aa8ff', wu: '#ff3a2a', shu: '#9cff3a', han: '#d070ff', qun: '#ffffff', peach: '#9cff3a' };

/** 點陣字型（遊戲素材/UI等/字體 的檔名） */
export const BATTLE_FONTS = {
  number: 'BFBattleNum',
  comboNumber: 'BFComboNumber',
  enemyCountdown: 'BFEnemyCountDown',
  waveLabel: 'BF_BattleCnt',
  waveNumber: 'BF_BattleCntNum',
} as const;
