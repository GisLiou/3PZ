/**
 * 戰鬥場景：讀取關卡 JSON（data/stages/<關卡>.json）並執行。新增關卡＝新增一個 JSON，不用寫程式。
 *   場景 id "battle"，參數 { stage: 關卡檔名 }；開發版網址 #scene=battle&stage=test 可直接開。
 * 關卡格式（合戰、敵人、勝利條件、教學）見 docs/關卡格式.md，讀取與檢查在 logic/stageData.ts。
 * 一般戰鬥：自由轉珠 → 我方攻擊 → 勝利條件達成就前往下一個合戰，否則敵人回合；教學（tutorial.script）照步驟執行。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { audioService } from "@core/audioService";
import { saveStore } from "@core/saveStore";
import type { BattleScreen } from "../logic/BattleScreen";
import type { EnemyDefinition } from "../logic/battleAssets";
import { StandardBattleLayout } from "./StandardBattleLayout";
import { runTutorialScript, TutorialMaskController } from "./TutorialMask";
import { TutorialLayout } from "./TutorialLayout";
import { BattleMenuDialog } from "./BattleMenuDialog";
import {
  createParty,
  createWaveEnemies,
  findStarter,
  type StarterGeneral,
} from "../logic/units";
import {
  getStage,
  resolveWaveEnemies,
  VictoryTracker,
  type Stage,
} from "../logic/stageData";
import {
  createPiece,
  FACTION_NAMES,
  findMatchGroups,
  PIECE_KINDS,
  type BoardGrid,
  type PieceKind,
} from "../logic/boardRules";

// ---------- 場景 ----------
export function BattleScene({ stage = "tutorial1" }: { stage?: string }) {
  const data = useMemo(() => getStage(stage), [stage]);
  const party = useMemo(
    () => createParty(data.party, findStarter(saveStore.data.starterFaction)),
    [data],
  );
  /** 目前的戰鬥畫面；熱更新重建或離開場景後，舊的關卡流程會自己停下來 */
  const current = useRef<BattleScreen | null>(null);
  /** Menu 對話框是否開著 */
  const [menuOpen, setMenuOpen] = useState(false);
  /** 關卡流程的操作（Menu 的「跳過這個合戰」） */
  const controls = useRef(new StageControls());
  useEffect(() => {
    return () => {
      current.current = null;
    };
  }, []);

  const onReady = (battle: BattleScreen) => {
    current.current = battle;
    const mask = data.tutorial
      ? new TutorialMaskController(battle, battle.elementOf("tutorialMask"))
      : null;
    // 開發版：自動測試從 window.__battle、__tutorialMask 取得戰鬥畫面與遮罩
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG)
      Object.assign(window, { __battle: battle, __tutorialMask: mask });
    const isActive = () => current.current === battle;
    // Menu 按鈕（battle.css 讓它可以點）：點了打開 Menu 對話框（教學中被遮罩擋住，點不到）
    const menuButton = battle.elementOf("menu");
    menuButton.addEventListener("click", () => setMenuOpen(true));
    controls.current = new StageControls();
    void runStage(battle, data, mask, isActive, controls.current).catch(
      (error) => {
        // 場景離開後畫面已清除，後續演出出錯是正常的
        if (isActive()) console.error(error);
      },
    );
  };

  // 教學接在故事畫面的全白之後：底色用白色，戰鬥畫面建立前不會閃一下黑色
  return (
    <div
      className="scene"
      style={{ background: data.tutorial ? "#fff" : "#000" }}
    >
      <StandardBattleLayout party={party} onReady={onReady}>
        {/* 教學關卡才有：教學遮罩（設定在 TutorialLayout.tsx） */}
        {data.tutorial && <TutorialLayout />}
      </StandardBattleLayout>
      {menuOpen && (
        <BattleMenuDialog
          canSkipWave={data.endless === true}
          onSkipWave={() => {
            controls.current.requestSkipWave();
            setMenuOpen(false);
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

// ---------- 關卡流程 ----------
const randomKind = (): PieceKind =>
  PIECE_KINDS[Math.floor(Math.random() * PIECE_KINDS.length)]!;

/** 隨機盤面（一開始不會有已經成陣的組） */
function createRandomGrid(): BoardGrid {
  const grid: BoardGrid = Array.from({ length: 5 }, () =>
    Array.from({ length: 7 }, () => createPiece(randomKind())),
  );
  for (
    let groups = findMatchGroups(grid);
    groups.length;
    groups = findMatchGroups(grid)
  ) {
    for (const group of groups) {
      const cell = group.cells[0]!;
      grid[cell.row]![cell.col] = createPiece(randomKind());
    }
  }
  return grid;
}

/**
 * 關卡流程的外部操作：requestSkipWave()＝跳過目前的合戰（無限關卡測試用）。
 * 在等玩家轉珠時立刻生效；演出途中按的話，等到下次輪到玩家時生效。
 */
class StageControls {
  private skipPending = false;
  private wake: (() => void) | null = null;
  requestSkipWave() {
    this.skipPending = true;
    this.wake?.();
  }
  /** 等玩家轉完珠，或被要求跳過合戰（回傳 "skip"） */
  waitForPlayer(battle: BattleScreen): Promise<"move" | "skip"> {
    return new Promise((resolve) => {
      const finish = (action: "move" | "skip") => {
        this.wake = null;
        battle.board.onMoveEnd = () => {};
        this.skipPending = false;
        resolve(action);
      };
      if (this.skipPending) return finish("skip");
      battle.board.onMoveEnd = () => finish("move");
      this.wake = () => finish("skip");
    });
  }
}

async function runStage(
  battle: BattleScreen,
  stage: Stage,
  mask: TutorialMaskController | null,
  isActive: () => boolean,
  controls: StageControls,
) {
  const starter: StarterGeneral = findStarter(saveStore.data.starterFaction);
  const totalWaves = stage.waves.length;
  const refillKind =
    stage.board.refill === "random" ? randomKind : () => "peach" as const;
  battle.nextKind = refillKind;
  if (stage.leaderSkill) {
    const faction =
      stage.leaderSkill.faction === "starter"
        ? starter.faction
        : stage.leaderSkill.faction;
    battle.leaderSkill = {
      faction,
      factionName: FACTION_NAMES[faction],
      multiplier: stage.leaderSkill.multiplier,
    };
  }
  audioService.playBackgroundMusic(stage.waves[0]!.bgm ?? stage.bgm);

  /** 目前合戰的勝利條件 */
  let victory = new VictoryTracker(stage.waves[0]!.victory);
  const updateHint = () => battle.setVictoryHint(victory.hint(battle.enemies));
  /** 準備第 index 個合戰的敵人：載入立繪、量看得到的寬度，算出大小與站位（不蓋到 Menu 與我方頭像） */
  const prepareWave = (index: number) =>
    createWaveEnemies(
      resolveWaveEnemies(stage, index),
      battle.enemyLayer.verticalLimits(),
    );
  /** 放上第 index 個合戰的敵人（先不出現）、換勝利條件與背景音樂 */
  const placeWave = (index: number, enemies: EnemyDefinition[]) => {
    const wave = stage.waves[index]!;
    battle.setEnemies(enemies);
    battle.setEnemiesVisible(false);
    victory = new VictoryTracker(wave.victory);
    if (wave.bgm) audioService.playBackgroundMusic(wave.bgm);
  };
  /** 第 index 個合戰（0 起算）：第 2 個起先往前走（路面推進、小兵踏步），再放上敵人並顯示「合戰 n/總數」 */
  const showWave = async (index: number) => {
    battle.setVictoryHint("");
    // 往前走的同時準備下一個合戰的敵人
    const preparing = prepareWave(index);
    if (index > 0) await battle.playAdvance();
    placeWave(index, await preparing);
    await battle.playWaveBanner(index + 1, totalWaves);
    updateHint();
  };
  placeWave(0, await prepareWave(0));

  // ---- 教學：照步驟執行（TutorialMask.tsx） ----
  if (stage.tutorial) {
    updateHint();
    await runTutorialScript(battle, mask!, stage.tutorial, {
      totalWaves,
      refillKind,
      showWave,
      createRandomGrid,
      playerLetter: starter.boardLetter,
      isActive,
    });
    return;
  }

  // ---- 一般戰鬥 ----
  battle.setGrid(createRandomGrid());
  await Promise.all([
    battle.playWaveBanner(1, totalWaves),
    battle.board.playIntro(),
  ]);
  updateHint();
  await battle.playEnemyEntrance();
  let wave = 0,
    chests = 0;
  /** 一回合：我方攻擊 →（還沒過關）敵人回合。回傳這個合戰是否過關 */
  const playRound = async () => {
    const turn = await battle.playTurn();
    if (!isActive()) return false;
    victory.recordTurn(turn);
    if (victory.isWon(battle.enemies)) return true;
    await battle.playEnemyTurn();
    if (!isActive()) return false;
    victory.recordEnemyTurn();
    updateHint();
    // 敗北畫面尚未復刻：HP 歸零時補滿
    if (battle.party.hp <= 0) {
      battle.party.hp = battle.party.maxHp;
      await battle.party.renderHp();
    }
    return victory.isWon(battle.enemies);
  };
  while (isActive()) {
    battle.board.isLocked = false;
    const action = await controls.waitForPlayer(battle);
    battle.board.isLocked = true;
    if (!isActive()) return;
    if (action === "skip") {
      // Menu 的「跳過這個合戰」：敵人直接退場，前往下一個合戰（不算寶箱）
      await battle.playEnemiesRetreat();
    } else if (!(await playRound())) {
      continue;
    } else {
      // 過關：剩下的敵人退場
      await battle.playEnemiesRetreat();
      battle.setChestCount(++chests);
    }
    wave++;
    if (wave >= totalWaves) {
      if (!stage.endless) {
        battle.setVictoryHint("");
        await battle.playVictory();
        return;
      }
      wave = 0;
    }
    await showWave(wave);
    await battle.playEnemyEntrance();
  }
}
