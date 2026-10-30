/**
 * 新手教學戰鬥 1 的腳本（v5 108 721～272 231 ms）。腳本順序與對話時間見 docs/復刻分析/02_教學戰鬥1.md §1。
 * 盤面每一步都用錄影解碼的盤面與補位順序，所以結果與錄影一致。
 */
import { sceneRouter } from '@core/navigation/sceneRouter';
import { wait } from '@core/animation/animate';
import { audioService } from '@core/audio/audioService';
import { saveStore } from '@core/storage/saveStore';
import { BattleScreen, createQueuedKindSource, FACTION_NAMES, parseBoardNotation, type NextPieceKind } from '@modules/battle';
import { showNavigatorDialog } from '../guide/navigatorDialog';
import { showDragPathGuide } from '../guide/dragPathGuide';
import { findStarter } from '../starterSelection/starterGenerals';
import { createTutorialParty, getTutorialMove, TUTORIAL_WAVES, ZHOU_YU_INDEX, type TutorialMoveName } from './battle1Setup';
import { TUTORIAL_DIALOGUE as SAY } from './battle1Dialogue';

/** 教學中主角勢力的軍略倍率 */
const STARTER_LEADER_MULTIPLIER = 1.5;
const TOTAL_WAVES = 3;

/** 執行教學戰鬥 1；isActive() 回傳 false 代表場景已離開，腳本中途停止 */
export async function runTutorialBattle1(host: HTMLElement, isActive: () => boolean) {
  const starter = findStarter(saveStore.data.starterFaction);
  const starterLetter = starter.boardLetter;
  let nextKind: NextPieceKind = () => 'peach';
  const battle = new BattleScreen(host, createTutorialParty(starter), (col) => nextKind(col));
  const overlay = battle.overlayLayer;
  const say = (text: string, options?: Parameters<typeof showNavigatorDialog>[2]) => showNavigatorDialog(overlay, text, options);
  battle.leaderSkill = { faction: starter.faction, factionName: FACTION_NAMES[starter.faction], multiplier: STARTER_LEADER_MULTIPLIER };
  // 開發版：自動測試從 window.__tutorialBattle 取得戰鬥畫面
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG) (window as unknown as { __tutorialBattle: BattleScreen }).__tutorialBattle = battle;

  /** 一次指引移動：放上錄影盤面 → 顯示路徑 → 等玩家照路徑拖曳 → 播放回合 */
  const playGuidedMove = async (name: TutorialMoveName) => {
    const move = getTutorialMove(name, starterLetter);
    battle.setGrid(parseBoardNotation(move.before));
    nextKind = createQueuedKindSource(move.queues, () => 'peach');
    const hideGuide = showDragPathGuide(battle, move.path);
    battle.board.forcedPath = move.path;
    battle.board.isLocked = false;
    await new Promise<void>((resolve) => (battle.board.onMoveEnd = () => resolve()));
    battle.board.isLocked = true; battle.board.forcedPath = null;
    hideGuide();
    return battle.playTurn();
  };
  /** 把敵人直接設為死亡並隱藏 */
  const forceDefeat = (enemy: (typeof battle.enemies)[number]) => { enemy.currentHp = 0; enemy.isDead = true; enemy.element.style.opacity = '0'; };

  try {
    audioService.playBackgroundMusic('bg_00002');

    // 合戰 1：黃巾槍兵
    battle.setEnemiesVisible(false);
    battle.setEnemies(TUTORIAL_WAVES[0]!);
    battle.setGrid(parseBoardNotation(getTutorialMove('b1m1', starterLetter).before));
    await Promise.all([battle.playWaveBanner(1, TOTAL_WAVES), battle.board.playIntro()]);
    await say(SAY.welcome, { expression: 'smile' });
    await say(SAY.introduceSelf, { expression: 'smile' });
    await say(SAY.introduceParty, { highlight: { x: 5, y: 400, w: 320, h: 110 } });
    await say(SAY.introduceHp, { highlight: { x: 0, y: 505, w: 640, h: 42 } });
    await say(SAY.introduceMenu, { highlight: { x: 488, y: 42, w: 150, h: 60 } });
    await battle.playEnemyEntrance();
    await wait(300);
    await say(SAY.enemyAppears);
    await say(SAY.firstMoveHint);
    battle.enemyLayer.cannotDie = false;
    await playGuidedMove('b1m1');
    if (!isActive()) return;

    // 合戰 2：左慈
    battle.setEnemies(TUTORIAL_WAVES[1]!);
    battle.setEnemiesVisible(false);
    await battle.playWaveBanner(2, TOTAL_WAVES);
    await battle.playEnemyEntrance();
    await say(SAY.wave2Start, { expression: 'smile' });
    await say(SAY.zuoCiAppears);
    battle.enemyLayer.cannotDie = true;
    await playGuidedMove('b1m2');
    await battle.playEnemyTurn();
    await say(SAY.enemyAttacked);
    await say(SAY.healHint);
    await playGuidedMove('b1m3');
    await say(SAY.healed, { expression: 'smile' });
    battle.enemyLayer.cannotDie = false;
    await playGuidedMove('b1m4');
    if (!isActive()) return;

    // 合戰 3：周瑜＋孫軍弓兵
    await say(SAY.wave3Start);
    battle.setEnemies(TUTORIAL_WAVES[2]!);
    battle.setEnemiesVisible(false);
    await battle.playWaveBanner(3, TOTAL_WAVES);
    await battle.playEnemyEntrance();
    await say(SAY.zhouYuAppears);
    battle.setTarget(ZHOU_YU_INDEX);
    await say(SAY.targetHint);
    battle.enemyLayer.cannotDie = true;
    // 只有周瑜會被打倒（其他人留 1 HP）
    const zhouYu = battle.enemies[ZHOU_YU_INDEX]!;
    await playGuidedMove('b1m5');
    battle.enemies.forEach((enemy) => { if (enemy !== zhouYu) enemy.currentHp = Math.max(1, enemy.currentHp); });
    if (!zhouYu.isDead) forceDefeat(zhouYu);
    await say(SAY.enemyGeneralDefeated, { expression: 'smile' });
    await say(SAY.fiveMatchHint);
    battle.enemyLayer.cannotDie = false;
    // 5 連以上＝全體攻擊（錄影 b1m6：紫 5 顆）
    battle.enemyLayer.target = null;
    const remaining = battle.enemies.filter((enemy) => !enemy.isDead);
    await playGuidedMove('b1m6');
    remaining.forEach((enemy) => { if (!enemy.isDead) forceDefeat(enemy); });
    await battle.playVictory();
    await wait(1200);
    saveStore.update((data) => { data.tutorialStep = 1; });
    sceneRouter.replace('tutorialReward');
  } finally {
    if (!isActive()) battle.destroy();
  }
}
