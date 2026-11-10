import { describe, expect, it } from "vitest";
import {
  arrangeEnemies,
  arrangeRows,
  scaleOfStars,
} from "@modules/battle/logic/formation";
import { VictoryTracker } from "@modules/battle/logic/stageData";

const F = "front",
  B = "back";

describe("arrangeRows：依星數決定前後排", () => {
  it("1. 五個以下低星（低於 4★）：後前後前後", () => {
    expect(arrangeRows([1, 2, 1, 3, 1])).toEqual([B, F, B, F, B]);
    expect(arrangeRows([1, 2, 1])).toEqual([B, F, B]);
    expect(arrangeRows([1, 1, 1, 1])).toEqual([B, F, F, B]);
  });
  it("2. 兩個四星：左右並排", () => {
    expect(arrangeRows([4, 4])).toEqual([F, F]);
  });
  it("3. 一個四星＋兩個低星：低星站前排、主將站後排（前〔後〕前）", () => {
    expect(arrangeRows([1, 4, 2])).toEqual([F, B, F]);
  });
  it("4. 兩個四星＋兩個低星：前〔後後〕前", () => {
    expect(arrangeRows([1, 4, 4, 2])).toEqual([F, B, B, F]);
  });
  it("5. 單一五星以上：單排", () => {
    expect(arrangeRows([5])).toEqual([F]);
  });
  it("6. 一個五星＋兩個低於五星：前〔後〕前（四星也算低星）", () => {
    expect(arrangeRows([4, 5, 2])).toEqual([F, B, F]);
  });
  it("教學合戰 3：一個四星＋四個低星＝低星都在前排（前前〔後〕前前）", () => {
    expect(arrangeRows([1, 1, 4, 1, 1])).toEqual([F, F, B, F, F]);
  });
});

describe("VictoryTracker：合戰的勝利條件", () => {
  const enemies = (dead: Record<string, boolean>) =>
    Object.entries(dead).map(([id, isDead]) => ({ id, name: id, isDead }));
  it("沒寫＝打倒全部，不顯示提示", () => {
    const tracker = new VictoryTracker(undefined);
    expect(tracker.hint(enemies({ a: false }))).toBe("");
    expect(tracker.isWon(enemies({ a: false }))).toBe(false);
    expect(tracker.isWon(enemies({ a: true }))).toBe(true);
  });
  it("defeat：只要打倒指定的敵人", () => {
    const tracker = new VictoryTracker({ type: "defeat", targets: ["boss"] });
    expect(tracker.isWon(enemies({ boss: true, a: false }))).toBe(true);
    expect(tracker.isWon(enemies({ boss: false, a: true }))).toBe(false);
  });
  it("survive：撐過 N 個敵人回合", () => {
    const tracker = new VictoryTracker({ type: "survive", turns: 2 });
    tracker.recordEnemyTurn();
    expect(tracker.isWon(enemies({ a: false }))).toBe(false);
    tracker.recordEnemyTurn();
    expect(tracker.isWon(enemies({ a: false }))).toBe(true);
  });
  it("combo、damage：一回合達成", () => {
    const combo = new VictoryTracker({ type: "combo", count: 4 });
    combo.recordTurn({ combos: 3, damage: 0 });
    expect(combo.isWon(enemies({ a: false }))).toBe(false);
    combo.recordTurn({ combos: 4, damage: 0 });
    expect(combo.isWon(enemies({ a: false }))).toBe(true);
    const damage = new VictoryTracker({ type: "damage", amount: 500 });
    damage.recordTurn({ combos: 1, damage: 600 });
    expect(damage.isWon(enemies({ a: false }))).toBe(true);
  });
});

describe("scaleOfStars／arrangeEnemies：大小與位置", () => {
  /** 一個敵人：stars 星、立繪看得到的寬度 artWidth（原圖像素）、高 470 */
  const enemy = (stars: number, artWidth: number) => {
    const scale = scaleOfStars(stars, artWidth);
    return { stars, scale, visibleWidth: artWidth * scale, artHeight: 470 };
  };
  /** 寬鬆的上下範圍（不會限制大小） */
  const roomy = { top: -1000, bottom: 1000 };
  it("大小比例：1★、2★ 1.0，3★ 1.15，4★ 1.5，5★ 1.75，6★ 以上至少 2.0 且寬度放大到 640", () => {
    const base = scaleOfStars(1, 450);
    expect(scaleOfStars(2, 450) / base).toBeCloseTo(1);
    expect(scaleOfStars(3, 450) / base).toBeCloseTo(1.15);
    expect(scaleOfStars(4, 450) / base).toBeCloseTo(1.5);
    expect(scaleOfStars(5, 450) / base).toBeCloseTo(1.75);
    expect(scaleOfStars(7, 2000) / base).toBeCloseTo(2);
    expect(enemy(6, 853).visibleWidth).toBeCloseTo(640);
  });
  it("1 個 6★：站在畫面正中央", () => {
    expect(arrangeEnemies([enemy(6, 853)], roomy)[0]!.x).toBeCloseTo(320);
  });
  it("立繪頂端不超過 top（不蓋到 Menu）：先整排往下移，最多到 bottom，還放不下才縮小", () => {
    const limits = { top: 50, bottom: 420 };
    // 6★ 寬圖（853 → 縮放 0.75，高 352）：前排腳底 340 時頂端 -12 → 往下移到頂端 50（腳底 402）
    const [boss] = arrangeEnemies([enemy(6, 853)], limits);
    expect(boss!.y).toBeCloseTo(50 + 470 * (640 / 853));
    expect(boss!.scale).toBeCloseTo(640 / 853);
    // 6★ 很窄很高：移到 bottom 還不夠 → 縮小到剛好
    const [tall] = arrangeEnemies([enemy(6, 200)], limits);
    expect(tall!.y).toBeCloseTo(420);
    expect(tall!.y - 470 * tall!.scale).toBeCloseTo(50);
    // 低星不受影響
    expect(arrangeEnemies([enemy(1, 360)], limits)[0]!.y).toBe(340);
  });
  /** 相鄰兩人看得到的部分重疊多少（負數＝有空隙） */
  const overlap = (list: ReturnType<typeof enemy>[]) => {
    const places = arrangeEnemies(list, roomy);
    const spans = list
      .map((item, i) => {
        const half = (item.visibleWidth * places[i]!.scale) / item.scale / 2;
        return [places[i]!.x - half, places[i]!.x + half];
      })
      .sort((a, b) => a[0]! - b[0]!);
    return Math.max(
      ...spans.slice(1).map((span, i) => spans[i]![1]! - span[0]!),
    );
  };
  it("4★ 之間、5★ 之間不重疊", () => {
    expect(overlap([enemy(4, 512), enemy(4, 440)])).toBeLessThan(0);
    expect(overlap([enemy(5, 327), enemy(5, 327)])).toBeLessThan(0);
  });
  it("兩個寬的 5★ 放不下時：縮小到放得下，仍不重疊、不超出畫面", () => {
    const list = [enemy(5, 853), enemy(5, 327)];
    expect(overlap(list)).toBeLessThan(0);
    const places = arrangeEnemies(list, roomy);
    const half = (i: number) =>
      (list[i]!.visibleWidth * places[i]!.scale) / list[i]!.scale / 2;
    expect(places[0]!.x - half(0)).toBeGreaterThanOrEqual(8 - 1e-6);
    expect(places[1]!.x + half(1)).toBeLessThanOrEqual(632 + 1e-6);
  });
  it("5★ 以上配 4★：可以重疊", () => {
    expect(overlap([enemy(4, 684), enemy(5, 853)])).toBeGreaterThan(0);
  });
  it("空間有剩時撐開：3 個低星之間有空隙但不會分散到兩邊", () => {
    const list = [enemy(1, 360), enemy(1, 360), enemy(1, 360)];
    const places = arrangeEnemies(list, roomy);
    const gap = places[1]!.x - places[0]!.x - list[0]!.visibleWidth;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(60 + 1e-9);
  });
  it("空間不夠時用滿可視寬度：教學合戰 3 的五人兩端都在畫面內", () => {
    const list = [
      enemy(1, 365),
      enemy(1, 365),
      enemy(4, 453),
      enemy(1, 365),
      enemy(1, 365),
    ];
    const places = arrangeEnemies(list, roomy);
    expect(places[0]!.x - list[0]!.visibleWidth / 2).toBeCloseTo(8);
    expect(places[4]!.x + list[4]!.visibleWidth / 2).toBeCloseTo(632);
  });
});
