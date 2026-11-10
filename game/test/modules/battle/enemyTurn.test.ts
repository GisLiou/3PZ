import { describe, expect, it } from "vitest";
import { getStage, resolveWaveEnemies } from "@modules/battle/logic/stageData";
import { cruiseEase } from "@modules/battle/logic/effects";

describe("敵人的殘數設定", () => {
  it("教學合戰 2 的左慈：先攻普攻、interval 2", () => {
    const stage = getStage("tutorial1");
    const [zuoCi] = resolveWaveEnemies(stage, 1);
    expect(zuoCi!.firstStrike).toBe("attack");
    expect(zuoCi!.attack.interval).toBe(2);
  });
  it("合戰裡可以覆寫 firstStrike／firstCountdown", () => {
    const stage = {
      id: "t",
      waves: [{ enemies: [{ id: "luBu", firstCountdown: 3 }] }],
    };
    expect(resolveWaveEnemies(stage, 0)[0]!.firstCountdown).toBe(3);
  });
  it("所有關卡都通過檢查", () => {
    for (const id of ["tutorial1", "test"])
      expect(() => getStage(id)).not.toThrow();
  });
});

describe("路面前進的速度曲線", () => {
  it("從 0 到 1、單調遞增、中段等速", () => {
    expect(cruiseEase(0, 0.3)).toBe(0);
    expect(cruiseEase(1, 0.3)).toBeCloseTo(1, 10);
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const value = cruiseEase(i / 100, 0.3);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
    const speed = (t: number) =>
      (cruiseEase(t + 1e-4, 0.3) - cruiseEase(t, 0.3)) / 1e-4;
    expect(speed(0.4)).toBeCloseTo(speed(0.6), 3);
    expect(speed(0.3 - 1e-3)).toBeCloseTo(speed(0.4), 1);
  });
});
