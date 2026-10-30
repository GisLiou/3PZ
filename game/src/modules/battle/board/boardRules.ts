/**
 * 盤面規則（純 TypeScript，不碰畫面，可單元測試）。
 * 規則取自參考影片逐禎觀察（docs/復刻分析/02_教學戰鬥1.md）：
 * - 7 欄 × 5 列，第 0 列在最上方（靠近敵人）。
 * - 拖曳：拿起一個小兵沿路徑移動，經過的格子與手上的小兵互換。
 * - 成陣：同種 3 個以上縱或橫排成一列；同種且相連的成陣格合為一組（一組＝一連擊）。
 * - 補位：本作小兵「往上」走——剩下的小兵往上補位，新小兵從盤面「下方」進場（v7 101287～101559 ms）。
 */
import { LETTER_TO_PIECE_KIND, type PieceKind } from './pieceKinds';

export const BOARD_COLUMNS = 7;
export const BOARD_ROWS = 5;

export interface Cell { row: number; col: number }
export interface Piece { id: number; kind: PieceKind }
/** grid[列][欄]；null＝空格 */
export type BoardGrid = (Piece | null)[][];
/** 一組成陣（一連擊） */
export interface MatchGroup { kind: PieceKind; cells: Cell[] }
/** 補位時一個小兵的移動；isNew＝新進場的小兵（fromRow 在盤面下緣之外） */
export interface RefillMove { piece: Piece; col: number; fromRow: number; toRow: number; isNew: boolean }
/** 補位用的新小兵種類來源（依欄位決定） */
export type NextPieceKind = (col: number) => PieceKind;

let nextPieceId = 1;
export const createPiece = (kind: PieceKind): Piece => ({ id: nextPieceId++, kind });

/** 拖曳路徑：從 path[0] 拿起，依序與 path[i] 交換。回傳每一步的交換對（給畫面做動畫） */
export function applyDragPath(grid: BoardGrid, path: Cell[]): Array<[Cell, Cell]> {
  const swaps: Array<[Cell, Cell]> = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!, to = path[i]!;
    [grid[from.row]![from.col], grid[to.row]![to.col]] = [grid[to.row]![to.col]!, grid[from.row]![from.col]!];
    swaps.push([from, to]);
  }
  return swaps;
}

/** 找出所有成陣組。排序：最左欄優先，同欄則最上列優先（v5 148689 起依欄由左至右消除） */
export function findMatchGroups(grid: BoardGrid): MatchGroup[] {
  const matched: boolean[][] = grid.map((row) => row.map(() => false));
  const kindAt = (row: number, col: number) => grid[row]?.[col]?.kind;
  for (let row = 0; row < BOARD_ROWS; row++) for (let col = 0; col < BOARD_COLUMNS; col++) {
    const kind = kindAt(row, col);
    if (!kind) continue;
    if (col + 2 < BOARD_COLUMNS && kindAt(row, col + 1) === kind && kindAt(row, col + 2) === kind) {
      for (let c = col; c < BOARD_COLUMNS && kindAt(row, c) === kind; c++) matched[row]![c] = true;
    }
    if (row + 2 < BOARD_ROWS && kindAt(row + 1, col) === kind && kindAt(row + 2, col) === kind) {
      for (let r = row; r < BOARD_ROWS && kindAt(r, col) === kind; r++) matched[r]![col] = true;
    }
  }
  // 把相連的同種成陣格合成一組（深度優先搜尋）
  const visited: boolean[][] = grid.map((row) => row.map(() => false));
  const groups: MatchGroup[] = [];
  for (let col = 0; col < BOARD_COLUMNS; col++) for (let row = 0; row < BOARD_ROWS; row++) {
    if (!matched[row]![col] || visited[row]![col]) continue;
    const kind = kindAt(row, col)!, cells: Cell[] = [], stack: Cell[] = [{ row, col }];
    visited[row]![col] = true;
    while (stack.length) {
      const cell = stack.pop()!;
      cells.push(cell);
      for (const [dRow, dCol] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const r = cell.row + dRow, c = cell.col + dCol;
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLUMNS && matched[r]![c] && !visited[r]![c] && kindAt(r, c) === kind) {
          visited[r]![c] = true; stack.push({ row: r, col: c });
        }
      }
    }
    groups.push({ kind, cells: cells.sort((a, b) => a.col - b.col || a.row - b.row) });
  }
  const leftmostCol = (group: MatchGroup) => Math.min(...group.cells.map((cell) => cell.col));
  const topmostRow = (group: MatchGroup) => Math.min(...group.cells.map((cell) => cell.row));
  return groups.sort((a, b) => leftmostCol(a) - leftmostCol(b) || topmostRow(a) - topmostRow(b));
}

export function removeMatchGroups(grid: BoardGrid, groups: MatchGroup[]) {
  for (const group of groups) for (const { row, col } of group.cells) grid[row]![col] = null;
}

/**
 * 往上補位：每欄剩下的小兵往上靠齊，空出的下方格由新小兵補上。
 * nextKind(col) 給新小兵的種類（教學用錄影解碼的佇列；一般戰鬥用亂數）。
 * 新小兵的 fromRow 從盤面下緣之外開始（BOARD_ROWS, BOARD_ROWS+1, …）。
 */
export function refillUpward(grid: BoardGrid, nextKind: NextPieceKind): RefillMove[] {
  const moves: RefillMove[] = [];
  for (let col = 0; col < BOARD_COLUMNS; col++) {
    let writeRow = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      const piece = grid[row]![col];
      if (!piece) continue;
      if (row !== writeRow) {
        grid[writeRow]![col] = piece; grid[row]![col] = null;
        moves.push({ piece, col, fromRow: row, toRow: writeRow, isNew: false });
      }
      writeRow++;
    }
    const emptyCount = BOARD_ROWS - writeRow;
    for (let i = 0; i < emptyCount; i++) {
      const piece = createPiece(nextKind(col));
      grid[writeRow + i]![col] = piece;
      moves.push({ piece, col, fromRow: BOARD_ROWS + i, toRow: writeRow + i, isNew: true });
    }
  }
  return moves;
}

/** 依每欄的佇列字串（盤面記法字母）產生補位種類（教學）；佇列用完後改用 fallback */
export function createQueuedKindSource(queues: string[], fallback: NextPieceKind): NextPieceKind {
  const positions = queues.map(() => 0);
  return (col: number): PieceKind => {
    const queue = queues[col] ?? '';
    if (positions[col]! < queue.length) return LETTER_TO_PIECE_KIND[queue[positions[col]!++]!]!;
    return fallback(col);
  };
}
