/**
 * 盤面記法：每列 7 個字母、列與列以 '/' 分隔，由上而下（例 'PGVSGVS/GVSGVSP/...'）。
 * 字母對照見 pieceKinds.ts（B 魏、R 吳、G 蜀、V 漢、S 群、P 桃）；空格記為 '.'。
 */
import { createPiece, type BoardGrid } from './boardRules';
import { LETTER_TO_PIECE_KIND, pieceKindToLetter } from './pieceKinds';

export function parseBoardNotation(notation: string): BoardGrid {
  return notation.split('/').map((row) => [...row].map((letter) => createPiece(LETTER_TO_PIECE_KIND[letter]!)));
}

export const toBoardNotation = (grid: BoardGrid) =>
  grid.map((row) => row.map((piece) => (piece ? pieceKindToLetter(piece.kind) : '.')).join('')).join('/');
