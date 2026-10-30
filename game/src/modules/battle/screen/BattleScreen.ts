/**
 * 戰鬥畫面（直接操作 DOM）：把各區塊組起來，並依序播放一回合的演出。
 *
 * 組成（由下而上疊放）：
 *   scenery/   背景：天空＋透視地面
 *   enemies/   敵方區：敵人、HP 條、攻擊倒數
 *   party/     我方區：武將頭像、HP 條、傷害數字
 *   boardView  盤面（../boardView/）
 *   effects/   效果層：小兵、魂、數字、命中特效，蓋在三個區塊之上、可跨區移動
 *   overlay    覆蓋層：教學對話、路徑指引
 *   topBar/    寶箱與 Menu，固定在螢幕最上方
 * 一回合的各階段在 turn/；版面座標見 ./battleLayout.ts；時間見 ../timing/battleTiming.ts，逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md。
 */
import { wait } from '@core/animation/animate';
import { onStageResize } from '@core/stage/stage';
import { getAssetUrl } from '@core/assets/assetLoader';
import { BATTLE_ASSETS } from '../assets/battleAssets';
import { attackTiming, matchTiming } from '../timing/battleTiming';
import type { BoardGrid, Cell, MatchGroup, NextPieceKind } from '../board/boardRules';
import type { EnemyDefinition, LeaderSkill, PartyMemberDefinition, TurnResult } from '../battleTypes';
import { BoardView } from '../boardView/BoardView';
import { cellCenterX, cellCenterY } from '../boardView/boardGeometry';
import { BOARD_TOP, PORTRAIT_TOP } from './battleLayout';
import { BattleBackground } from './scenery/battleBackground';
import { BattleTopBar } from './topBar/battleTopBar';
import { PartyPanel } from './party/partyPanel';
import { EnemyLayer } from './enemies/enemyLayer';
import { playSoulFlight } from './effects/soulEffect';
import { playVictory, playWaveBanner } from './effects/banners';
import type { BattleContext } from './turn/battleContext';
import { playComboMultiplier } from './turn/comboMultiplierPhase';
import { playLeaderSkill } from './turn/leaderSkillPhase';
import { playPartyAttack } from './turn/partyAttackPhase';
import { playEnemyTurn } from './turn/enemyAttackPhase';
import './battleScreen.css';

/** 回復魂飛往的位置（HP 條右側） */
const HEAL_SOUL_TARGET = { x: 560, y: 470 };

export class BattleScreen implements BattleContext {
  readonly screenElement: HTMLDivElement;
  /** 底部 999 高的版面（敵人、盤面、我方、效果層都在裡面） */
  readonly layoutElement: HTMLDivElement;
  readonly effectLayer: HTMLDivElement;
  /** 覆蓋層：教學對話、路徑指引放這裡 */
  readonly overlayLayer: HTMLDivElement;
  readonly board: BoardView;
  readonly party: PartyPanel;
  readonly enemyLayer: EnemyLayer;
  readonly topBar: BattleTopBar;
  private background: BattleBackground;
  private stopListeningResize: () => void;
  /** 軍略（教學：主角勢力攻擊 1.5 倍）；null＝沒有 */
  leaderSkill: LeaderSkill | null = null;

  constructor(host: HTMLElement, partyMembers: PartyMemberDefinition[], nextKind: NextPieceKind) {
    const screen = (this.screenElement = document.createElement('div'));
    screen.className = 'battle-screen';
    host.appendChild(screen);
    this.background = new BattleBackground(screen);

    const layout = (this.layoutElement = document.createElement('div'));
    layout.className = 'battle-layout';
    layout.innerHTML = '<div class="battle-enemy-layer"></div><div class="battle-party-layer"></div><div class="battle-effect-layer"></div><div class="battle-overlay-layer"></div>';
    screen.appendChild(layout);
    const layer = (name: string) => layout.querySelector<HTMLDivElement>(`.battle-${name}-layer`)!;
    const partyLayer = layer('party');
    this.effectLayer = layer('effect');
    this.overlayLayer = layer('overlay');

    this.board = new BoardView(layout, {
      nextKind,
      onGroupCleared: (group) => this.party.recordGroup(group),
      onGroupVanished: (group, x, y) => void this.playGroupSoul(group, x, y + BOARD_TOP),
    });
    this.board.element.style.backgroundImage = `url(${getAssetUrl(BATTLE_ASSETS.boardGrid)})`;
    layout.insertBefore(this.board.element, partyLayer);

    this.topBar = new BattleTopBar(screen);
    this.party = new PartyPanel(partyLayer, this.effectLayer, partyMembers);
    this.enemyLayer = new EnemyLayer(layer('enemy'), this.effectLayer);
    this.stopListeningResize = onStageResize(() => this.background.layout());
    this.background.layout();
  }

  destroy() { this.stopListeningResize(); this.board.destroy(); this.screenElement.remove(); }

  // ---------- 敵人 ----------
  setEnemies(definitions: EnemyDefinition[]) { this.enemyLayer.setEnemies(definitions); }
  setEnemiesVisible(visible: boolean) { this.enemyLayer.setVisible(visible); }
  playEnemyEntrance() { return this.enemyLayer.playEntrance(); }
  /** 鎖定第 index 個敵人為目標 */
  setTarget(index: number) { this.enemyLayer.setTarget(index); }
  get enemies() { return this.enemyLayer.enemies; }
  get waveCleared() { return this.enemyLayer.waveCleared; }

  // ---------- 盤面 ----------
  setGrid(grid: BoardGrid) { this.board.setGrid(grid); }
  /** 盤面格子在 battle-layout 座標中的中心（教學指引用） */
  cellCenter(cell: Cell) { return { x: cellCenterX(cell.col), y: cellCenterY(cell.row) + BOARD_TOP }; }

  /** 一組消除後的魂：飛到同勢力武將頭上（桃子飛到 HP 條），之後數字在頭像上開始上數 */
  private async playGroupSoul(group: MatchGroup, x: number, y: number) {
    const party = this.party;
    const targets = group.kind === 'peach'
      ? [HEAL_SOUL_TARGET]
      : party.membersOfFaction(group.kind).map((member) => ({ x: party.centerXOf(member), y: PORTRAIT_TOP - 50 }));
    await playSoulFlight(this.effectLayer, x, y, targets);
    await wait(Math.max(0, matchTiming.damageNumberAppearMs - matchTiming.clearWhiteMs - matchTiming.clearGlowMs - matchTiming.soulRiseMs - matchTiming.soulSpreadMs));
    if (group.kind === 'peach') { await party.setHealText(`+${Math.round(party.pendingHeal)}`, 40, 336, 500); return; }
    for (const member of party.membersOfFaction(group.kind)) party.queueDamageCountUp(member);
  }

  // ---------- 一回合 ----------
  /** 玩家移動後：消除與連鎖 → 連擊倍率 → 軍略 → 攻擊 → 回復 */
  async playTurn(): Promise<TurnResult> {
    const groups = await this.board.resolveMatches();
    const combos = groups.length;
    await this.party.waitForCounting();
    if (!combos) return { groups, combos };
    this.board.setAllDimmed(true);
    const multiplier = 1 + (combos - 1) * 0.25;
    await playComboMultiplier(this, multiplier, combos);
    const hideLeaderSkillBand = this.leaderSkill ? await playLeaderSkill(this, this.leaderSkill) : () => {};
    setTimeout(hideLeaderSkillBand, attackTiming.leaderSkillBandAfterMarchMs);
    await playPartyAttack(this);
    const party = this.party;
    if (party.pendingHeal) { party.hp = Math.min(party.maxHp, party.hp + party.pendingHeal * multiplier); await party.renderHp(); }
    party.pendingHeal = 0;
    await party.setHealText('');
    this.board.clearComboLabels();
    this.board.setAllDimmed(false);
    return { groups, combos };
  }

  /** 敵人回合：殘數減一，歸零者攻擊 */
  playEnemyTurn() { return playEnemyTurn(this); }

  playWaveBanner(wave: number, totalWaves: number) { return playWaveBanner(this.effectLayer, wave, totalWaves); }
  playVictory() { return playVictory(this.effectLayer); }
}
