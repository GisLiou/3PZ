/**
 * 小兵珠子的種類：五個勢力（魏、吳、蜀、漢、群）＋桃子（回復）。
 * 勢力名稱使用漢語拼音（wei＝魏、wu＝吳、shu＝蜀、han＝漢、qun＝群），peach＝桃子。
 */
export type Faction = 'wei' | 'wu' | 'shu' | 'han' | 'qun';
export type PieceKind = Faction | 'peach';

export const PIECE_KINDS: PieceKind[] = ['wei', 'wu', 'shu', 'han', 'qun', 'peach'];

/** 勢力的中文名稱 */
export const FACTION_NAMES: Record<Faction, string> = { wei: '魏', wu: '吳', shu: '蜀', han: '漢', qun: '群' };

/**
 * 盤面記法的字母 → 種類（錄影解碼用；以顏色命名）：
 * B 藍＝魏、R 紅＝吳、G 綠＝蜀、V 紫＝漢、S 灰＝群、P 桃
 */
export const LETTER_TO_PIECE_KIND: Record<string, PieceKind> = { B: 'wei', R: 'wu', G: 'shu', S: 'qun', V: 'han', P: 'peach' };

export const pieceKindToLetter = (kind: PieceKind) => Object.entries(LETTER_TO_PIECE_KIND).find(([, value]) => value === kind)![0];
