/** 盤面座標：盤面左上為 (0,0)，設計單位；格子 640/7 見方 */
import { BOARD_COLUMNS, BOARD_ROWS } from '../board/boardRules';

export const CELL_SIZE = 640 / BOARD_COLUMNS;
export const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;
/** 第 col 欄的中心 x */
export const cellCenterX = (col: number) => CELL_SIZE * (col + 0.5);
/** 第 row 列的中心 y（可大於最後一列，用於盤面下方進場的小兵） */
export const cellCenterY = (row: number) => CELL_SIZE * (row + 0.5);
