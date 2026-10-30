/**
 * 戰鬥模組的公開入口：其他模組（例：教學）只從這裡 import。
 *   board/      盤面規則（純邏輯，可測試）
 *   boardView/  盤面畫面（拖曳、消除、補位演出）
 *   screen/     戰鬥畫面（背景、敵方、我方、效果、回合流程）
 *   timing/     演出時間常數
 *   assets/     素材 id 與圖集零件
 */
export * from './board';
export type * from './battleTypes';
export { BattleScreen } from './screen/BattleScreen';
export type { Enemy } from './screen/enemies/enemyLayer';
export { BATTLE_ASSETS } from './assets/battleAssets';
export { TUTORIAL_PART, tutorialPartRect, tutorialPartStyle } from './assets/atlasParts';
/** 教學戰鬥 1 的錄影解碼盤面（教學腳本與規則測試共用） */
export { default as TUTORIAL1_RECORDED_MOVES } from './board/recordings/tutorial1Moves.json';
