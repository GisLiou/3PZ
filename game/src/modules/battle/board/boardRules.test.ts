import { describe, expect, it } from 'vitest';
import { applyDragPath, createQueuedKindSource, findMatchGroups, refillUpward, removeMatchGroups } from './boardRules';
import { parseBoardNotation, toBoardNotation } from './boardNotation';
import { pieceKindToLetter } from './pieceKinds';
import { createSeededRandom } from './seededRandom';
import recordedMoves from './recordings/tutorial1Moves.json';

type RecordedMove = (typeof recordedMoves)[keyof typeof recordedMoves];

/** 用錄影解碼的教學盤面驗證規則：移動 → 消除 → 往上補位 → 連鎖，最後必須得到錄影中的盤面 */
function replay(move: RecordedMove) {
  const grid = parseBoardNotation(move.before);
  applyDragPath(grid, move.path.map(([row, col]) => ({ row: row!, col: col! })));
  const nextKind = createQueuedKindSource(move.queues, () => 'han');
  const clearedPerCascade: Array<Array<[string, number]>> = [];
  for (;;) {
    const groups = findMatchGroups(grid);
    if (!groups.length) break;
    clearedPerCascade.push(groups.map((group) => [pieceKindToLetter(group.kind), group.cells.length]));
    removeMatchGroups(grid, groups);
    refillUpward(grid, nextKind);
  }
  return { finalBoard: toBoardNotation(grid), clearedPerCascade };
}

describe('教學盤面重播（docs/復刻分析/02_教學戰鬥1.md）', () => {
  for (const [name, move] of Object.entries(recordedMoves)) {
    it(name, () => {
      const result = replay(move);
      expect(result.finalBoard).toBe(move.final);
      expect(result.clearedPerCascade).toEqual(move.steps);
    });
  }
});

describe('createSeededRandom', () => {
  it('可重現', () => {
    const a = createSeededRandom(3), b = createSeededRandom(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
