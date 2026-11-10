/**
 * 戰鬥畫面（直接操作 DOM）：依畫布上的元件標籤建立需要大量動畫的零件，並依序播放一回合的演出。
 *
 * 畫面由哪些元件組成、放在哪裡、誰蓋在誰上面，都由元件標籤決定（標準組合見 ./StandardBattleLayout.tsx）。
 * 這個類別只負責：
 *   build()    依標籤建立背景、敵人、盤面、效果層、小兵層、我方部隊、自訂元件（UI 元件由 React 自己畫）
 *   playTurn() 一回合的演出順序（各階段的演出在檔案後段：連擊倍率、軍略、我方攻擊、敵人回合）
 * 演出時間在 turnTiming（毫秒），逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md。
 */
import { wait, nextFrame } from "@core/animate";
import { onStageResize, designUnit, translateUnits } from "@core/stage";
import { getAssetUrl, getAssetSize } from "@core/assetLoader";
import {
  BATTLE_ASSETS,
  type EnemyDefinition,
  type LeaderSkill,
  type PartyMemberDefinition,
  type TurnResult,
  FACTION_AURA_ASSETS,
  LAYOUT_PART,
  BATTLE_FONTS,
  DAMAGE_NUMBER_COLORS,
  createImageElement,
  createRotatedLayoutPart,
  restartCssAnimation,
  setBitmapTextImage,
  fast,
} from "./battleAssets";
import { BoardView, cellCenterX, cellCenterY } from "./BoardView";
import {
  type BoardGrid,
  type Cell,
  type MatchGroup,
  type NextPieceKind,
} from "./boardRules";
import {
  layoutOrigin,
  type CanvasPartEntry,
  type HudState,
} from "../components/BattleCanvas";
import {
  BattleBackground,
  playFadeFromWhite,
  playSoulFlight,
  playVictory,
  playWaveBanner,
  playHitBurst,
  paintTroopSprite,
  isRangedTroop,
  playMeleeStrike,
  playRangedAttack,
  troopFrameCount,
  playBloodSplashes,
  playScreenRedFlash,
  playEnemyAttackFx,
  playSkillName,
} from "./effects";
import { type EnemyActionData } from "./stageData";
import { audioService } from "@core/audioService";
import { PartyPanel, EnemyLayer, type Enemy, type PartyMember } from "./units";
import "../styles/battle.css";
import { boardTiming } from "./BoardView";
import { effectTiming } from "./effects";
import { unitTiming } from "./units";

/** 一回合各階段的演出時間（毫秒）：連擊倍率、軍略、衝鋒、命中、敵人攻擊。逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md */
export const turnTiming = {
  /** 數字在武將頭像上出現（119 433），隨即往上移到頭像上方（119 467） */
  damageNumberAppearMs: fast(533),
  /** 跳動週期：一上一下 267 ms；亮度閃一次 533 ms（121 900、122 433、122 967） */
  tokenHopMs: fast(267),
  tokenFlashMs: fast(533),
  /** 軍略（v5 158 534） */
  leaderSkillCountMs: fast(600),
  /** 數字落到頭像上（123 400 → 123 467） */
  damageNumberDropMs: fast(67),
  /** 小兵走向敵人（123 533 → 124 200 第一隻命中），命中依序錯開約 200 ms（124 200、124 400、124 733） */
  marchMs: fast(667),
  marchStaggerMs: fast(200),
  /** 前往下一個合戰：路面往前推進的時間（原版約 6 秒，期間有玲玲對話；不對話時縮短） */
  advanceMs: 1500,
  /** 勝利條件達成時，剩下的敵人退場 */
  enemyRetreatMs: fast(500),
  /** 攻擊動作每張（揮砍、突刺、劈斬、拉弓、揮扇、攤開竹簡） */
  attackFrameMs: fast(110),
  afterAttackMs: fast(300),
  /** 命中：小兵變白 67 ms 後淡出共 267 ms；敵人紅色受擊 167 ms */
  hitWhiteMs: fast(67),
  /** 命中前一禎全黑（v1 124 167、v5 159 711） */
  hitBlackMs: fast(33),
  /** 軍略訊息帶在小兵出發後留多久（v5 158 800 出發、159 390 消失） */
  leaderSkillBandAfterMarchMs: fast(540),
  /** 命中後小兵淡出 */
  troopFadeMs: fast(267),
  splashToDamageNumberMs: fast(160),
  enemyStrikeCountMs: fast(430),
  enemyStrikeHoldMs: fast(600),
  /** 敵人攻擊的傷害數字淡出 */
  enemyDamageFadeMs: fast(200),
} as const;

/** 由 BattleScreen 建立內容的元件種類 */
const BUILT_KINDS = new Set([
  "scenery",
  "enemies",
  "board",
  "effects",
  "troops",
  "waveBanner",
]);
/** 槍兵衝鋒圖的原圖高度（<Troops h> 換算縮放用） */
const TROOP_IMAGE_HEIGHT = 105;
/** 魂往上飛到頭像上方多少 */
const SOUL_ABOVE_PORTRAIT = 50;

export class BattleScreen implements BattleContext {
  /** 整個戰鬥畫面的根元素（畫布） */
  readonly screenElement: HTMLElement;
  /** 畫布上的元件（依圖層順序） */
  readonly entries: CanvasPartEntry[];
  effectLayer!: HTMLElement;
  troopLayer!: HTMLElement;
  private troops: CanvasPartEntry | null = null;
  /** 衝鋒小兵的縮放（<Troops h> ÷ 槍兵原圖高 105；沒有 <Troops> 時 0.95） */
  get troopScale() {
    return this.troops
      ? Number(this.troops.props.h) / TROOP_IMAGE_HEIGHT
      : 0.95;
  }
  board!: BoardView;
  party!: PartyPanel;
  enemyLayer!: EnemyLayer;
  /** 戰鬥中會變的數值（HP、寶箱數），UI 元件（BattleCanvas.tsx）照這裡顯示 */
  readonly hud: HudState;
  private background: BattleBackground | null = null;
  private waveBanner: CanvasPartEntry | null = null;
  private stopListeningResize: () => void;
  /** 軍略（教學：主角勢力攻擊 1.5 倍）；null＝沒有 */
  leaderSkill: LeaderSkill | null = null;
  /** 補位時新小兵的種類（關卡腳本可隨時換掉，例：教學用錄影的補位順序） */
  nextKind: NextPieceKind = () => "peach";

  constructor(
    screen: HTMLElement,
    entries: CanvasPartEntry[],
    partyMembers: PartyMemberDefinition[],
    hud: HudState,
  ) {
    this.screenElement = screen;
    this.entries = entries;
    this.hud = hud;
    this.build(partyMembers);
    this.stopListeningResize = onStageResize(() => this.background?.layout());
    this.background?.layout();
  }

  /**
   * 依標籤建立需要大量動畫的零件（背景、敵人、盤面、效果層、小兵層）與我方部隊；UI 元件（BattleCanvas.tsx）由 React 自己畫，這裡只讀它們的位置。
   * 效果層先找出來（敵人、頭像的數字畫在效果層）。
   */
  private build(partyMembers: PartyMemberDefinition[]) {
    const required = (kind: string) => {
      const entry = this.entries.find((item) => item.kind === kind);
      if (!entry) throw new Error(`戰鬥畫布缺少 <${kind}> 元件`);
      return entry;
    };
    this.effectLayer = required("effects").element;
    this.troops = this.entries.find((item) => item.kind === "troops") ?? null;
    this.troopLayer = this.troops?.element ?? this.effectLayer;

    for (const entry of this.entries) {
      // 位置一律現讀 entry.props（熱更新改了標籤數值後立刻生效）
      const { element, props } = entry,
        origin = () => layoutOrigin(entry.props);
      switch (entry.kind) {
        case "scenery":
          this.background = new BattleBackground(element, props.y);
          break;
        case "enemies":
          this.enemyLayer = new EnemyLayer(element, this.effectLayer, origin);
          break;
        case "board":
          this.board = new BoardView(element, {
            nextKind: (col) => this.nextKind(col),
            onGroupCleared: (group) => this.party.recordGroup(group),
            onGroupVanished: (group, x, y) =>
              void this.playGroupSoul(group, x + origin().x, y + origin().y),
          });
          this.board.element.style.backgroundImage = `url(${getAssetUrl(BATTLE_ASSETS.boardGrid)})`;
          break;
        case "waveBanner":
          this.waveBanner = entry;
          break;
        default:
          break;
      }
    }
    required("enemies");
    required("board");
    const portraits = required("portraits"),
      hpBar = this.entries.find((item) => item.kind === "hpBar");
    this.party = new PartyPanel(
      this.effectLayer,
      partyMembers,
      {
        origin: () => layoutOrigin(portraits.props),
        get size() {
          return Number(portraits.props.size);
        },
        get gap() {
          return Number(portraits.props.gap);
        },
      },
      this.hud,
      hpBar
        ? {
            origin: () => layoutOrigin(hpBar.props),
            get w() {
              return Number(hpBar.props.w);
            },
          }
        : null,
    );
    // 頭上小兵與衝鋒小兵同一個大小
    this.party.tokenScale = () => this.troopScale;
  }

  /** 寶箱數 */
  setChestCount(count: number) {
    this.hud.set({ chest: count });
  }

  /** 元件的外框元素（關卡自己的元件用，例：教學遮罩 battle.elementOf("tutorialMask")） */
  elementOf(id: string): HTMLDivElement {
    const entry = this.entries.find((item) => item.id === id);
    if (!entry) throw new Error(`戰鬥畫布沒有 id 為 ${id} 的元件`);
    return entry.element;
  }

  destroy() {
    this.stopListeningResize();
    this.board?.destroy();
    // 只清掉這裡建立的內容；UI 元件由 React 自己移除
    for (const entry of this.entries)
      if (BUILT_KINDS.has(entry.kind)) entry.element.innerHTML = "";
  }

  // ---------- 敵人 ----------
  setEnemies(definitions: EnemyDefinition[]) {
    this.enemyLayer.setEnemies(definitions);
  }
  setEnemiesVisible(visible: boolean) {
    this.enemyLayer.setVisible(visible);
  }
  playEnemyEntrance() {
    return this.enemyLayer.playEntrance();
  }
  /** 鎖定第 index 個敵人為目標 */
  setTarget(index: number) {
    this.enemyLayer.setTarget(index);
  }
  get enemies() {
    return this.enemyLayer.enemies;
  }
  get waveCleared() {
    return this.enemyLayer.waveCleared;
  }
  /** 勝利條件達成但還有敵人活著（例：只要打倒主將）：剩下的敵人往後退並淡出 */
  async playEnemiesRetreat() {
    await Promise.all(
      this.enemyLayer.enemies
        .filter((enemy) => !enemy.isDead)
        .map((enemy) => {
          enemy.isDead = true;
          return enemy.element.animate(
            [
              { opacity: 1, translate: "0 0" },
              { opacity: 0, translate: `0 ${designUnit(-40)}` },
            ],
            { duration: turnTiming.enemyRetreatMs, fill: "forwards" },
          ).finished;
        }),
    );
  }
  /** 勝利條件提示（<VictoryHint>；空字串＝不顯示） */
  setVictoryHint(text: string) {
    this.hud.set({ victoryHint: text });
  }

  // ---------- 盤面 ----------
  setGrid(grid: BoardGrid) {
    this.board.setGrid(grid);
  }
  /** 盤面格線（pazzle_grid 半透明棋盤格）：開場滑入時沒有（v5 108 561～110 540），之後才有（v5 150 508） */
  setBoardGridVisible(visible: boolean) {
    this.board.element.style.backgroundImage = visible
      ? `url(${getAssetUrl(BATTLE_ASSETS.boardGrid)})`
      : "none";
  }
  /** 盤面左上角在版面座標中的位置 */
  get boardOrigin() {
    return layoutOrigin(
      this.entries.find((entry) => entry.kind === "board")!.props,
    );
  }
  /** 盤面格子在版面座標中的中心（教學指引用） */
  cellCenter(cell: Cell) {
    const origin = this.boardOrigin;
    return {
      x: origin.x + cellCenterX(cell.col),
      y: origin.y + cellCenterY(cell.row),
    };
  }

  /** 一組消除後的魂：飛到同勢力武將頭上（桃子飛到 HP 條），之後數字在頭像上開始上數 */
  private async playGroupSoul(group: MatchGroup, x: number, y: number) {
    const party = this.party,
      portraitTop = party.portraitTop;
    const targets =
      group.kind === "peach"
        ? [party.healSoulTarget]
        : party.membersOfFaction(group.kind).map((member) => ({
            x: party.centerXOf(member),
            y: portraitTop - SOUL_ABOVE_PORTRAIT,
          }));
    await playSoulFlight(this.effectLayer, x, y, targets, portraitTop);
    await wait(
      Math.max(
        0,
        turnTiming.damageNumberAppearMs -
          boardTiming.clearWhiteMs -
          boardTiming.clearGlowMs -
          effectTiming.soulRiseMs -
          effectTiming.soulSpreadMs,
      ),
    );
    if (group.kind === "peach") {
      await party.setHealText(`+${Math.round(party.pendingHeal)}`, 40, 326, -8);
      return;
    }
    for (const member of party.membersOfFaction(group.kind))
      party.queueDamageCountUp(member);
  }

  // ---------- 一回合 ----------
  /** 玩家移動後：消除與連鎖 → 連擊倍率 → 軍略 → 攻擊（同時回復） */
  async playTurn(): Promise<TurnResult> {
    const groups = await this.board.resolveMatches();
    const combos = groups.length;
    await this.party.waitForCounting();
    if (!combos) return { groups, combos, damage: 0 };
    this.board.setAllDimmed(true);
    const multiplier = 1 + (combos - 1) * 0.25;
    await playComboMultiplier(this, multiplier, combos);
    const hideLeaderSkillBand = this.leaderSkill
      ? await playLeaderSkill(this, this.leaderSkill)
      : () => {};
    setTimeout(hideLeaderSkillBand, turnTiming.leaderSkillBandAfterMarchMs);
    // 回復與攻擊同時開始：HP 條在小兵出發時一起長上去
    const party = this.party;
    const heal = async () => {
      if (!party.pendingHeal) return;
      await wait(turnTiming.damageNumberDropMs);
      party.hp = Math.min(
        party.maxHp,
        party.hp + party.pendingHeal * multiplier,
      );
      await party.renderHp();
    };
    const [damage] = await Promise.all([playPartyAttack(this), heal()]);
    party.pendingHeal = 0;
    await party.setHealText("");
    this.board.clearComboLabels();
    this.board.setAllDimmed(false);
    return { groups, combos, damage };
  }

  /** 敵人回合：殘數減一，歸零者攻擊 */
  playEnemyTurn() {
    return playEnemyTurn(this);
  }

  /** 「合戰 n/m」：畫在 <WaveBanner> 的位置；沒有放這個元件時不顯示 */
  async playWaveBanner(wave: number, totalWaves: number) {
    const banner = this.waveBanner;
    if (banner)
      await playWaveBanner(
        banner.element,
        wave,
        totalWaves,
        Number(banner.props.h),
        Number(banner.props.gap),
      );
  }
  /** 前往下一個合戰：路面往前推進、盤面上的小兵原地踏步（v5 166 000～172 300） */
  async playAdvance(durationMs = turnTiming.advanceMs) {
    this.board.setMarching(true);
    await (this.background?.playAdvance(durationMs) ?? wait(durationMs));
    this.board.setMarching(false);
  }

  /** 背景（地面）畫好時 resolve */
  get backgroundReady() {
    return this.background?.ready ?? Promise.resolve();
  }
  /** 開場：立刻蓋上全白（接在故事畫面的開門全白之後），等 waitFor 完成後退回戰鬥畫面 */
  playFadeFromWhite(waitFor?: Promise<unknown>) {
    return playFadeFromWhite(this.screenElement, waitFor);
  }
  playVictory() {
    return playVictory(this.effectLayer);
  }
}

/**
 * 一回合的各階段演出（由 BattleScreen.playTurn／playEnemyTurn 依序呼叫）：
 *   連擊倍率 → 軍略 → 我方攻擊（衝鋒小兵）→ 敵人回合。各階段用到的戰鬥畫面零件定義在 BattleContext。
 */
export interface BattleContext {
  /** 整個戰鬥畫面的根元素（全畫面泛紅、晃動用） */
  readonly screenElement: HTMLElement;
  /** 效果層：小兵、魂、數字、命中特效都畫在這層，可跨區移動 */
  readonly effectLayer: HTMLElement;
  /** 衝鋒小兵層（<Troops>）：攻擊時跑向敵人的小兵與命中爆光；troopScale＝小兵大小 */
  readonly troopLayer: HTMLElement;
  readonly troopScale: number;
  readonly board: BoardView;
  readonly party: PartyPanel;
  readonly enemyLayer: EnemyLayer;
}

/**
 * 連擊倍率（v1 121 900～123 400）：有傷害的武將頭上小兵上下跳（267 ms 一次，跳起時張開雙手），
 * 每 533 ms 亮一下；數字在小兵腳下往上數到 ×倍率。回復量同時上數。
 */
const HOP_HEIGHT = 14;

export async function playComboMultiplier(
  { party, board }: BattleContext,
  multiplier: number,
  combos: number,
) {
  const attackers = party.members.filter((member) => member.damage);
  // 時間長度＝(連擊數−1)×533 ms（v5 9 連擊：153 933→158 213 約 4 280 ms；v1 4 連擊：約 1 600 ms）
  const startedAt = performance.now(),
    durationMs = Math.max(
      boardTiming.groupIntervalMs,
      (combos - 1) * boardTiming.groupIntervalMs,
    );
  const startValues = new Map(
    attackers.map((member) => [member, member.shownDamage]),
  );
  const startHeal = party.pendingHeal,
    labelCount = combos - 1;
  let fadedLabels = 0;
  for (;;) {
    const elapsed = performance.now() - startedAt,
      progress = Math.min(1, elapsed / durationMs);
    const isUp = Math.floor(elapsed / turnTiming.tokenHopMs) % 2 === 0,
      isBright = elapsed % turnTiming.tokenFlashMs < fast(100);
    // 連擊字依序淡出：第 j 個在 (j−0.5)×533 ms
    while (
      fadedLabels < labelCount &&
      elapsed >= (fadedLabels + 0.5) * boardTiming.groupIntervalMs
    )
      board.fadeComboLabel(fadedLabels++);
    for (const member of attackers) {
      party.showToken(member, isUp ? 1 : 0, isUp ? HOP_HEIGHT : 0);
      member.token.style.filter = isBright ? "brightness(1.6)" : "";
      const from = startValues.get(member)!;
      member.shownDamage = Math.round(
        from + (member.damage * multiplier - from) * progress,
      );
      await party.drawDamageNumber(member, member.shownDamage, "atTokenFeet");
    }
    // 回復量一起上數（HP 條上的大字，v5：+35 → +99）
    if (startHeal)
      await party.setHealText(
        `+${Math.round(startHeal * (1 + (multiplier - 1) * progress))}`,
        56,
        320,
        -14,
      );
    if (progress >= 1) break;
    await nextFrame();
  }
  // 數完後回復字縮小（v5 158 213：高度約 32）
  if (startHeal)
    await party.setHealText(
      `+${Math.round(startHeal * multiplier)}`,
      32,
      312,
      0,
    );
  for (const member of attackers) {
    member.token.style.filter = "";
    party.showToken(member);
  }
}

/** 軍略（v5 158 534）：武將列上方黑色訊息帶，該勢力小兵冒出光焰，數字再上數 */
/** 播放軍略演出；回傳收起訊息帶與光焰的函式（訊息帶在小兵出發後才收起） */
export async function playLeaderSkill(
  { party, effectLayer }: BattleContext,
  skill: LeaderSkill,
): Promise<() => void> {
  const boosted = party.members.filter(
    (member) => member.faction === skill.faction && member.damage,
  );
  if (!boosted.length) return () => {};
  const band = createRotatedLayoutPart(
    LAYOUT_PART.messageBand,
    0,
    364,
    640,
    34,
  );
  band.style.opacity = "0.8";
  const message = document.createElement("b");
  Object.assign(message.style, {
    left: designUnit(0),
    top: designUnit(366),
    width: designUnit(640),
    textAlign: "center",
    font: `700 ${designUnit(22)}/${designUnit(30)} 'PingFang TC','Noto Sans TC',sans-serif`,
    color: "#fff",
  });
  message.textContent = `使我方「${skill.factionName}」武將的攻擊力變為${skill.multiplier}倍`;
  effectLayer.appendChild(band);
  effectLayer.appendChild(message);
  const auras = boosted.map((member) => {
    const assetId = FACTION_AURA_ASSETS[member.faction],
      size = getAssetSize(assetId),
      scale = 120 / size.width;
    const aura = createImageElement(null, {
      left: designUnit(party.centerXOf(member) - 60),
      top: designUnit(330),
      width: designUnit(120),
      height: designUnit(size.height * scale),
      background: `url(${getAssetUrl(assetId)}) 0 0/100% 100%`,
      opacity: "0.85",
    });
    effectLayer.insertBefore(aura, effectLayer.firstChild);
    return aura;
  });
  await Promise.all(
    boosted.map(async (member) => {
      const from = member.shownDamage,
        to = Math.round(member.shownDamage * skill.multiplier),
        startedAt = performance.now();
      for (;;) {
        const progress = Math.min(
          1,
          (performance.now() - startedAt) / turnTiming.leaderSkillCountMs,
        );
        member.shownDamage = Math.round(from + (to - from) * progress);
        await party.drawDamageNumber(member, member.shownDamage, "atTokenFeet");
        if (progress >= 1) break;
        await nextFrame();
      }
    }),
  );
  // 訊息帶不在這裡收起：小兵出發後還留約 540 ms（v5 158 534～159 390）
  return () => {
    band.remove();
    message.remove();
    auras.forEach((aura) => aura.remove());
  };
}

/**
 * 我方攻擊（v1 123 400～125 800）：數字落到頭像上 → 頭上小兵依序走向目標（667 ms，每隻錯開 200 ms）→
 * 命中爆光、頭像數字消失、敵人頭上出現傷害數字並隨 HP 條往下數 → 死亡的敵人變暗爆開。
 * 全體攻擊（同勢力一次消除 5 個以上）：頭上的小兵分成每個敵人一隻，同時衝向各自的敵人，每個敵人都受到全部傷害。
 */
/** 回傳對敵人造成的總傷害 */
export async function playPartyAttack(context: BattleContext): Promise<number> {
  const { party } = context;
  const attackers = party.members.filter((member) => member.damage);
  await Promise.all(
    attackers.map((member) =>
      party.drawDamageNumber(member, member.shownDamage, "onPortrait"),
    ),
  );
  await wait(turnTiming.damageNumberDropMs);
  const dealt = await Promise.all(
    attackers.map((member, index) => marchAndHit(context, member, index)),
  );
  party.resetAfterAttack();
  await wait(turnTiming.afterAttackMs);
  void context.enemyLayer.resolveDeaths();
  await wait(unitTiming.enemyDeathFadeMs);
  return dealt.reduce((sum, damage) => sum + damage, 0);
}

/** 一位武將的小兵跑向目標並命中；全體攻擊時分成每個敵人一隻。回傳造成的傷害 */
async function marchAndHit(
  context: BattleContext,
  member: PartyMember,
  index: number,
): Promise<number> {
  await wait(index * turnTiming.marchStaggerMs);
  const { enemyLayer } = context;
  const single = enemyLayer.pickAttackTarget();
  const targets = member.attacksAll
    ? enemyLayer.allAttackTargets()
    : single
      ? [single]
      : [];
  if (!targets.length) return 0;
  const damage = member.shownDamage;
  for (const target of targets) target.pendingDamage += damage;
  member.token.style.display = "none";
  await Promise.all(
    targets.map((target) => marchTroop(context, member, index, target, damage)),
  );
  return damage * targets.length;
}

/**
 * 一隻小兵攻擊 target（小兵＝頭上跳動的那隻，依兵種）：
 * 近戰（劍兵、槍兵、蠻兵、騎兵）：跑到敵人腳下 → 攻擊動作（揮砍、突刺、劈斬、衝擊）→ 變一禎全黑 → 兵種攻擊特效＋命中爆光，小兵變白淡出（v5 159 450～）。
 * 遠程（弓兵、神算、鬼謀）：留在頭像上方做攻擊動作 → 射箭／放火球／召喚伏兵，第一下命中時敵人受擊；小兵淡出。
 */
async function marchTroop(
  { party, enemyLayer, troopLayer, troopScale }: BattleContext,
  member: PartyMember,
  index: number,
  target: Enemy,
  damage: number,
) {
  // v5 158 900～159 700 實測：小兵約 100 設計單位高、從頭像上緣出發、一路大小不變，蓋在敵人與軍略訊息帶之上
  const enemyPoint = enemyLayer.pointOf(target);
  const ranged = isRangedTroop(member.troop);
  const fromX = party.centerXOf(member),
    fromY = party.portraitTop,
    targetX = enemyPoint.x + ((index % 3) - 1) * 14,
    targetY = enemyPoint.y - 6;
  const troop = document.createElement("div");
  troop.className = "troop";
  const troopSprite = createImageElement(troop);
  troopLayer.appendChild(troop);
  const paint = (frame: number, animation: "run" | "attack") =>
    paintTroopSprite(
      troopSprite,
      member.faction,
      member.troop,
      frame,
      troopScale,
      animation,
    );
  let x = fromX,
    y = fromY;
  troop.style.transform = translateUnits(x, y);
  paint(0, "run");
  if (!ranged) {
    // 左右腳交替跑向敵人腳下（v1 123 533～124 200）
    const startedAt = performance.now();
    const march = troop.animate(
      [
        { transform: translateUnits(fromX, fromY) },
        { transform: translateUnits(targetX, targetY) },
      ],
      { duration: turnTiming.marchMs, fill: "forwards", easing: "linear" },
    );
    const animateLegs = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed < turnTiming.marchMs) {
        paint(Math.floor(elapsed / boardTiming.walkFrameMs) % 2, "run");
        requestAnimationFrame(animateLegs);
      }
    };
    animateLegs();
    await march.finished;
    march.cancel();
    x = targetX;
    y = targetY;
    troop.style.transform = translateUnits(x, y);
  }
  member.damageNumber.style.display = "none";
  // 攻擊動作：依序播放（data/troops.json 的 attack）
  const attackFrames = troopFrameCount(member.faction, member.troop, "attack");
  for (let frame = 0; frame < attackFrames; frame++) {
    paint(frame, "attack");
    await wait(turnTiming.attackFrameMs);
  }
  const fadeOutTroop = () =>
    void troop
      .animate(
        [
          { filter: "brightness(3)", opacity: 1 },
          {
            filter: "brightness(3)",
            opacity: 1,
            offset: turnTiming.hitWhiteMs / turnTiming.troopFadeMs,
          },
          { filter: "brightness(1)", opacity: 0 },
        ],
        { duration: turnTiming.troopFadeMs, fill: "forwards" },
      )
      .finished.then(() => troop.remove());

  if (ranged) {
    const attack = playRangedAttack(
      troopLayer,
      member.troop,
      x,
      y - 60 * troopScale,
      targetX,
      targetY - 50,
    );
    await attack.hit;
    fadeOutTroop();
    enemyLayer.playHitReaction(target);
    await Promise.all([
      enemyLayer.drainHp(target, damage, member.faction),
      attack.done,
    ]);
    return;
  }
  // 命中：小兵先變一禎全黑（v1 124 167、v5 159 711），接著兵種攻擊特效與爆光、小兵變白後淡出；敵人變紅、晃動
  troop.style.filter = "brightness(0)";
  await wait(turnTiming.hitBlackMs);
  // 特效畫在小兵層：蓋在小兵上方（v5 159 711）
  void playMeleeStrike(troopLayer, member.troop, x, y - 50);
  void playHitBurst(troopLayer, x, y - 50);
  fadeOutTroop();
  enemyLayer.playHitReaction(target);
  await enemyLayer.drainHp(target, damage, member.faction);
}

/**
 * 敵人回合：殘數減一，歸零者攻擊（普攻或技能，見 chooseEnemyAction）。
 * 「殘」最少是 0：先顯示 0 再攻擊，我方 HP 開始減少的同時回到 attack.interval（沒有傷害的招式：效果開始時）。
 * 攻擊演出（v5 178 705～180 000）：敵人紅／正常交替閃爍約 480 ms →（技能：頭上顯示技能名稱）→ 全畫面泛紅、
 * 特效（blood 血花：敵人身上濺出 3 個紅色血花；fire／thunder：火焰／雷擊打到我方頭像）→
 * 我方 HP 條下降、HP 條上方紅色傷害數字從 0 數到傷害值（約 430 ms）→ 數字停留後淡出 → 回復自己、改盤面。
 */
const ATTACK_TINT = "sepia(1) saturate(6) hue-rotate(-35deg) brightness(.9)";
/** 閃爍序列：1＝紅、0＝正常，每格 53 ms */
const BLINK_PATTERN = [1, 1, 0, 1, 0, 1, 0, 1, 1];

export async function playEnemyTurn(context: BattleContext) {
  const { enemyLayer } = context;
  for (const enemy of enemyLayer.enemies.filter(
    (candidate) => !candidate.isDead,
  )) {
    enemy.countdown = Math.max(0, enemy.countdown - 1);
    await enemyLayer.renderCountdown(enemy);
    if (enemy.countdown === 0) {
      enemy.attackCount++;
      await playEnemyAction(context, enemy, chooseEnemyAction(enemy));
    }
  }
}

/** 這次攻擊用哪個技能：先攻的第一次出手照 firstStrike；否則第一個符合條件的技能；都不符合就普攻 */
function chooseEnemyAction(enemy: Enemy): EnemyActionData & { name?: string } {
  if (enemy.firstStrike && enemy.attackCount === 1) {
    const skill = enemy.skills.find(
      (candidate) => candidate.name === enemy.firstStrike,
    );
    if (!skill) return enemy.attack;
    // 只用一次的技能（first、hpBelow）用過就不再用
    if (skill.when.first || skill.when.hpBelow !== undefined)
      enemy.usedSkills.add(skill);
    return skill;
  }
  for (const skill of enemy.skills) {
    const { every, hpBelow, first, chance } = skill.when;
    const once = hpBelow !== undefined || first;
    if (once && enemy.usedSkills.has(skill)) continue;
    const matched =
      (every !== undefined && enemy.attackCount % every === 0) ||
      (hpBelow !== undefined && enemy.currentHp / enemy.hp < hpBelow) ||
      (first === true && enemy.attackCount === 1) ||
      (chance !== undefined && Math.random() < chance);
    if (!matched) continue;
    if (once) enemy.usedSkills.add(skill);
    return skill;
  }
  return enemy.attack;
}

async function playEnemyAction(
  context: BattleContext,
  enemy: Enemy,
  action: EnemyActionData & { name?: string },
) {
  const { screenElement, effectLayer, party, enemyLayer, board } = context;
  /** 攻擊生效：頭上「殘 0」回到 attack.interval */
  const rearmCountdown = () => {
    enemy.countdown = enemy.attack.interval;
    return enemyLayer.renderCountdown(enemy);
  };
  if (action.voice) void audioService.playVoice(action.voice);
  for (const isRed of BLINK_PATTERN) {
    enemy.artElement.style.filter = isRed ? ATTACK_TINT : "";
    await wait(effectTiming.enemyStrikeBlinkMs);
  }
  enemy.artElement.style.filter = "";
  const enemyPoint = enemyLayer.pointOf(enemy);
  if (action.name)
    await playSkillName(
      effectLayer,
      action.name,
      enemyPoint.x,
      enemyPoint.y - enemyLayer.artHeightOf(enemy) - 10,
    );
  if (action.damage > 0) {
    playScreenRedFlash(screenElement);
    restartCssAnimation(screenElement, "is-shaking");
    const fx = action.fx ?? "blood";
    if (fx === "blood")
      playBloodSplashes(effectLayer, [
        [455, enemyPoint.y - 160],
        [235, enemyPoint.y - 90],
        [330, enemyPoint.y - 60],
      ]);
    else if (fx !== "none")
      void playEnemyAttackFx(effectLayer, fx, {
        x: 320,
        y: party.portraitTop + 50,
      });
    await wait(turnTiming.splashToDamageNumberMs);
    // 「殘 0」回到 interval，和我方 HP 減少同時
    await Promise.all([
      playPartyDamage(context, action.damage),
      rearmCountdown(),
    ]);
  } else await rearmCountdown();
  if (action.healSelf)
    await enemyLayer.healEnemy(enemy, enemy.hp * action.healSelf);
  const effect = action.boardEffect;
  if (effect?.type === "convert")
    await board.convertPieces(effect.to, effect.count, effect.from);
}

/** 我方受到 damage：HP 條下降、HP 條上方紅色傷害數字從 0 數到 damage，停留後淡出 */
async function playPartyDamage(
  { effectLayer, party }: BattleContext,
  damage: number,
) {
  const to = Math.max(0, party.hp - damage);
  const damageNumber = createImageElement(effectLayer),
    numberAt = party.hpPoint(310, -30);
  // HP 條自己會播放減少的動畫（紅色變化量、數字遞減）
  party.hp = to;
  await party.renderHp();
  const startedAt = performance.now();
  for (;;) {
    const progress = Math.min(
      1,
      (performance.now() - startedAt) / turnTiming.enemyStrikeCountMs,
    );
    await setBitmapTextImage(
      damageNumber,
      BATTLE_FONTS.number,
      String(Math.round(damage * progress)),
      DAMAGE_NUMBER_COLORS.wu,
      38,
      numberAt.x,
      numberAt.y,
      "center",
    );
    if (progress >= 1) break;
    await nextFrame();
  }
  await wait(turnTiming.enemyStrikeHoldMs);
  await damageNumber.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: turnTiming.enemyDamageFadeMs,
  }).finished;
  damageNumber.remove();
}
