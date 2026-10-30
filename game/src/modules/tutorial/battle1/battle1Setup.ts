/**
 * 教學戰鬥 1 的資料：部隊、三個合戰的敵人、每一步的盤面。
 * 盤面與補位順序來自錄影逐格解碼（battle/board/recordings/tutorial1Moves.json，規則測試 boardRules.test.ts 全數通過）。
 * 錄影的玩家選了蜀（劉備），盤面中的 G＝主角勢力；選魏／吳時把 G 換成 B／R。
 */
import { TUTORIAL1_RECORDED_MOVES, type Cell, type EnemyDefinition, type PartyMemberDefinition } from '@modules/battle';
import type { StarterGeneral } from '../starterSelection/starterGenerals';

const VOICE_ASSETS = '武將圖鑑語音';
const ART_ASSETS = '武將圖鑑立繪';

/** 部隊：主角＋漢軍劍兵＋群雄弓兵（v5 148 422 頭像比對）。攻擊力由傷害數字反推：42／87／92（見 docs §4） */
export function createTutorialParty(starter: StarterGeneral): PartyMemberDefinition[] {
  return [
    { id: 'starter', faction: starter.faction, attack: 42, recovery: 11, hp: 40, portraitAssetId: starter.portraitAssetId },
    { id: 'hanSwordsman', faction: 'han', attack: 87, recovery: 11, hp: 33, portraitAssetId: `${VOICE_ASSETS}/4.漢/Others3/S&M/ch_40200040_s` },
    { id: 'qunArcher', faction: 'qun', attack: 92, recovery: 11, hp: 33, portraitAssetId: `${VOICE_ASSETS}/5.群/Others3/S&M/ch_50100044_s` },
  ];
}

const sunArcher = (id: string, x: number, y: number): EnemyDefinition => (
  { id, artAssetId: `${ART_ASSETS}/2.吳/ch_20100039_ll孫軍弓兵`, faction: 'wu', hp: 400, attack: 10, attackInterval: 2, x, y, scale: 0.3 }
);

/** 三個合戰的敵人（位置量測自 v5 146 281、175 067、240 128） */
export const TUTORIAL_WAVES: EnemyDefinition[][] = [
  [{ id: 'yellowTurbanSpearman', artAssetId: `${ART_ASSETS}/5.群/ch_50300048_ll黄巾槍兵`, faction: 'qun', hp: 300, attack: 10, attackInterval: 2, x: 320, y: 340, scale: 0.32 }],
  [{ id: 'zuoCi', name: '左慈', showName: true, artAssetId: `${ART_ASSETS}/5.群/ch_50600053_ll【大宛馬】左慈`, faction: 'qun', hp: 600, attack: 20, attackInterval: 1, x: 320, y: 335, scale: 0.42 }],
  [
    sunArcher('sunArcher1', 85, 420),
    sunArcher('sunArcher2', 200, 390),
    { id: 'zhouYu', artAssetId: `${ART_ASSETS}/2.吳/ch_21600037_ll周瑜`, faction: 'wu', hp: 900, attack: 30, attackInterval: 2, x: 320, y: 420, scale: 0.36 },
    sunArcher('sunArcher3', 440, 390),
    sunArcher('sunArcher4', 555, 420),
  ],
];
/** 第三合戰中周瑜的位置（教學會鎖定他） */
export const ZHOU_YU_INDEX = 2;

type RecordedMove = { before: string; path: number[][]; queues: string[] };
const RECORDED_MOVES = TUTORIAL1_RECORDED_MOVES as unknown as Record<string, RecordedMove>;

/** 把錄影中的 G（蜀）與玩家選的勢力字母互換 */
const swapStarterLetter = (notation: string, letter: string) =>
  letter === 'G' ? notation : [...notation].map((char) => (char === 'G' ? letter : char === letter ? 'G' : char)).join('');

/** 教學的一步：起始盤面、規定的拖曳路徑、每欄的補位佇列 */
export interface TutorialMove { before: string; path: Cell[]; queues: string[] }
/** 步驟名稱：b1m1～b1m6＝教學戰鬥 1 第 1～6 次移動 */
export type TutorialMoveName = keyof typeof TUTORIAL1_RECORDED_MOVES | 'b1m2';

export function getTutorialMove(name: TutorialMoveName, starterLetter: string): TutorialMove {
  if (name === 'b1m2') {
    // 第 2 步（讓左慈攻擊）：b1m1 結束的盤面，把 (0,6) 移到 (0,5)，不成陣（錄影 b1m1 final → b1m3 before 的差異）
    return { before: swapStarterLetter('SPGSPGP/PVSPGSG/PVGVGSS/SSPVVGV/VGSPVPP', starterLetter), path: [{ row: 0, col: 6 }, { row: 0, col: 5 }], queues: [] };
  }
  const move = RECORDED_MOVES[name]!;
  return {
    before: swapStarterLetter(move.before, starterLetter),
    path: move.path.map(([row, col]) => ({ row: row!, col: col! })),
    queues: move.queues.map((queue) => swapStarterLetter(queue, starterLetter)),
  };
}
