import { describe, expect, it } from "vitest";
import {
  applyDragPath,
  createQueuedKindSource,
  findMatchGroups,
  parseBoardNotation,
  pieceKindToLetter,
  refillUpward,
  removeMatchGroups,
  toBoardNotation,
} from "@modules/battle/logic/boardRules";
import tutorial1 from "@data/stages/tutorial1.json";

/** 有錄影結果（final、steps）的盤面才能驗證 */
type RecordedMove = {
  before: string;
  path: number[][];
  queues: string[];
  final: string;
  steps: unknown;
};
const recordedMoves = Object.fromEntries(
  Object.entries(tutorial1.tutorial.moves).filter(
    ([, move]) => "final" in move,
  ),
) as Record<string, RecordedMove>;

/** 用錄影解碼的教學盤面驗證規則：移動 → 消除 → 往上補位 → 連鎖，最後必須得到錄影中的盤面 */
function replay(move: RecordedMove) {
  const grid = parseBoardNotation(move.before);
  applyDragPath(
    grid,
    move.path.map(([row, col]) => ({ row: row!, col: col! })),
  );
  const nextKind = createQueuedKindSource(move.queues, () => "han");
  const clearedPerCascade: Array<Array<[string, number]>> = [];
  for (;;) {
    const groups = findMatchGroups(grid);
    if (!groups.length) break;
    clearedPerCascade.push(
      groups.map((group) => [
        pieceKindToLetter(group.kind),
        group.cells.length,
      ]),
    );
    removeMatchGroups(grid, groups);
    refillUpward(grid, nextKind);
  }
  return { finalBoard: toBoardNotation(grid), clearedPerCascade };
}

describe("教學盤面重播（docs/復刻分析/02_教學戰鬥1.md）", () => {
  for (const [name, move] of Object.entries(recordedMoves)) {
    it(name, () => {
      const result = replay(move);
      expect(result.finalBoard).toBe(move.final);
      expect(result.clearedPerCascade).toEqual(move.steps);
    });
  }
});
