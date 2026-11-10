/**
 * 敵我雙方的單位：
 *   讀取器        createWaveEnemies（合戰的敵人資料 → 站位、大小）、createParty（關卡 JSON 的部隊）
 *   EnemyLayer    <Enemies> 元件：敵人立繪、HP 條、「殘 N」、名牌、瞄準符號、傷害數字倒數、死亡演出
 *                 敵人的 x, y（腳底中心）以 <Enemies> 為原點；換成版面座標用 pointOf()
 *   PartyPanel    我方部隊：部隊 HP、傷害數字、頭上小兵、回復量（頭像與 HP 條畫面在 BattleCanvas.tsx）
 */
import starterData from "@data/starterGenerals.json";
import troopData from "@data/troops.json";
import { getAssetSize, getAssetUrl, loadAssetImage } from "@core/assetLoader";
import { nextFrame, wait } from "@core/animate";
import { currentStage, designUnit, translateUnits } from "@core/stage";
import { renderBitmapText } from "@ui";
import {
  BATTLE_ASSETS,
  BATTLE_FONTS,
  DAMAGE_NUMBER_COLORS,
  LAYOUT_PART,
  layoutPartRect,
  layoutPartStyle,
  type EnemyDefinition,
  createImageElement,
  restartCssAnimation,
  setBitmapTextImage,
  type PartyMemberDefinition,
  type TroopType,
  fast,
} from "./battleAssets";
import { type Faction, type PieceKind, type MatchGroup } from "./boardRules";
import { paintTroopSprite, playEnemyDeathSmoke, playHitBurst } from "./effects";
import { type HudState, HP_BAR_WIDTH } from "../components/BattleCanvas";
import { type EnemyData, type EnemySkillData } from "./stageData";
import {
  arrangeEnemies,
  DEFAULT_VERTICAL_LIMITS,
  scaleOfStars,
  type ArtBounds,
  type VerticalLimits,
} from "./formation";

/** 敵我單位的演出時間（毫秒）：傷害數字、敵人 HP 下降、受擊、死亡。逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md */
export const unitTiming = {
  /** 名牌（showName）登場後停留、淡出 */
  namePlateHoldMs: 1500,
  namePlateFadeMs: 300,
  /** 敵人技能回復：HP 條往上長、數字停留 */
  enemyHealMs: fast(500),
  enemyHealHoldMs: fast(300),
  /** 瞄準符號標記時淡入 */
  targetFadeInMs: 200,
  /** 數字出現後往上移到頭像上方（119 433 → 119 467） */
  damageNumberLiftMs: fast(34),
  /** 數字從舊值數到新值（119 433 → 119 900 停住） */
  damageCountUpMs: fast(467),
  /** 數完落回頭像，頭上出現該勢力小兵（119 900） */
  damageSettleMs: fast(67),
  /** 敵人頭上傷害數字隨 HP 條下降往下數（124 400 → 125 133） */
  enemyHpDrainMs: fast(700),
  /** 敵人死亡：變暗、爆開（125 333～125 600） */
  enemyDeathFadeMs: fast(300),
  /** 敵人受擊變紅 */
  enemyHitTintMs: fast(167),
  /** 死亡：全黑剪影 133 ms → 爆光＋煙霧 400 ms */
  enemyDeathBlackMs: fast(133),
} as const;

// ---------- 讀取器：JSON → 敵人、我方部隊 ----------
/** 立繪中看得到的部分（alpha 夠高的像素）：左右邊界（原圖像素）與點擊用的遮罩；量一次就快取 */
const artBoundsCache = new Map<string, Promise<ArtBounds>>();
function measureArtBounds(assetId: string): Promise<ArtBounds> {
  let measuring = artBoundsCache.get(assetId);
  if (!measuring) {
    const full = { left: 0, right: getAssetSize(assetId).width };
    measuring = loadAssetImage(assetId)
      .then((image) => {
        // 縮小 4 倍量就夠準（誤差 ±4 像素）
        const step = 4,
          width = Math.ceil(image.naturalWidth / step),
          height = Math.ceil(image.naturalHeight / step);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return full;
        context.drawImage(image, 0, 0, width, height);
        const alpha = context.getImageData(0, 0, width, height).data;
        const opaque = new Uint8Array(width * height);
        let left = width,
          right = -1;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++)
            if (alpha[(y * width + x) * 4 + 3]! > 40) {
              opaque[y * width + x] = 1;
              if (x < left) left = x;
              if (x > right) right = x;
            }
        if (right < left) return full;
        const ratio = getAssetSize(assetId).width / width;
        return {
          left: left * ratio,
          right: (right + 1) * ratio,
          mask: { width, height, step: ratio, opaque },
        };
      })
      .catch(() => full);
    artBoundsCache.set(assetId, measuring);
  }
  return measuring;
}

/**
 * 敵人讀取器：一個合戰的敵人資料（stageData.ts 的 resolveWaveEnemies）→ 每個敵人的站位、大小、攻擊與技能。
 * 會先載入立繪、量出看得到的寬度（大小與站位都依這個寬度，見 formation.ts 的 scaleOfStars、arrangeEnemies）。
 * limits：敵人可以用的上下範圍（EnemyLayer.verticalLimits()：不蓋到 Menu 與我方頭像）。
 */
export async function createWaveEnemies(
  enemies: Array<EnemyData & { id: string }>,
  limits?: VerticalLimits,
): Promise<EnemyDefinition[]> {
  const bounds = await Promise.all(
    enemies.map((enemy) => measureArtBounds(enemy.art)),
  );
  const sized = enemies.map((enemy, index) => {
    const art = getAssetSize(enemy.art),
      { left, right } = bounds[index]!;
    const scale = scaleOfStars(enemy.stars, right - left);
    return {
      stars: enemy.stars,
      scale,
      visibleWidth: (right - left) * scale,
      artHeight: art.height,
    };
  });
  const places = arrangeEnemies(sized, limits);
  return enemies.map((enemy, index) => ({
    id: enemy.id,
    name: enemy.name,
    showName: enemy.showName,
    artAssetId: enemy.art,
    faction: enemy.faction,
    stars: enemy.stars,
    hp: enemy.hp,
    attack: enemy.attack,
    skills: enemy.skills ?? [],
    firstCountdown: enemy.firstCountdown,
    firstStrike: enemy.firstStrike,
    // 站位是「看得到的部分」的中心；元素的原點是立繪圖的中心，所以要加上兩者的差（有些圖左右留白不一樣）
    x:
      places[index]!.x +
      (getAssetSize(enemy.art).width / 2 -
        (bounds[index]!.left + bounds[index]!.right) / 2) *
        places[index]!.scale,
    y: places[index]!.y,
    scale: places[index]!.scale,
    visibleWidth:
      (bounds[index]!.right - bounds[index]!.left) * places[index]!.scale,
    hitMask: bounds[index]!.mask,
  }));
}

/** 玩家選的初始武將（data/starterGenerals.json；沒選過時用 default） */
export interface StarterGeneral {
  faction: Faction;
  portrait: string;
  /** 盤面記法中的勢力字母（B 魏、R 吳、G 蜀） */
  boardLetter: string;
}
export function findStarter(faction: string | undefined): StarterGeneral {
  const generals = starterData.generals as StarterGeneral[];
  return (
    generals.find((general) => general.faction === faction) ??
    generals.find((general) => general.faction === starterData.default)!
  );
}

/** 關卡 JSON 的我方武將：general "starter"＝玩家選的初始武將（勢力、頭像跟著換），其餘寫 faction 與 portrait */
export interface PartyMemberData {
  general?: "starter";
  faction?: Faction;
  /** 頭像素材 id */
  portrait?: string;
  /** 兵種；省略時依頭像檔名 ch_XYZ… 的第 3 碼（Z）判斷（data/troops.json 的 codeDigit） */
  troop?: TroopType;
  attack: number;
  recovery: number;
  hp: number;
}

/** 同勢力一次消除幾個以上算全體攻擊 */
export const ALL_ATTACK_SIZE = 5;

/** 我方部隊讀取器 */
export function createParty(
  members: PartyMemberData[],
  starter: StarterGeneral,
): PartyMemberDefinition[] {
  return members.map((member, index) => {
    const portrait =
      member.general === "starter" ? starter.portrait : member.portrait!;
    return {
      id: `member${index}`,
      faction: member.general === "starter" ? starter.faction : member.faction!,
      portraitAssetId: portrait,
      troop: member.troop ?? troopOfArt(portrait),
      attack: member.attack,
      recovery: member.recovery,
      hp: member.hp,
    };
  });
}

/** 依武將圖檔名判斷兵種：ch_<勢力><稀有度><兵種>…（例：ch_50100044 群雄弓兵 → 1＝弓兵） */
export function troopOfArt(assetId: string): TroopType {
  const digit = /ch_\d\d(\d)/.exec(assetId)?.[1] ?? "";
  const troop = (troopData.codeDigit as Record<string, string>)[digit];
  if (!troop)
    throw new Error(`無法從 ${assetId} 判斷兵種，請在關卡的 party 寫上 troop`);
  return troop as TroopType;
}

/** 戰鬥中的一個敵人 */
export interface Enemy extends EnemyDefinition {
  element: HTMLElement;
  artElement: HTMLElement;
  hpBar: HTMLElement;
  countdownElement: HTMLElement;
  damageNumber: HTMLElement;
  currentHp: number;
  /** 距離下次攻擊的回合數（頭上「殘 N」；攻擊當下是 0） */
  countdown: number;
  /** 已經攻擊了幾次（技能 when.every 用） */
  attackCount: number;
  /** 只用一次的技能（when.hpBelow、when.first）已經用過的 */
  usedSkills: Set<EnemySkillData>;
  isDead: boolean;
  /** 已發出、尚未命中的傷害（決定下一隻小兵要打誰） */
  pendingDamage: number;
  /** 傷害數字倒數的狀態 */
  drain: { remaining: number; ratePerMs: number; running?: Promise<void> };
}

/** 立繪頂端上面要留給「殘 N」的高度（設計單位） */
const COUNTDOWN_ROOM = 40;
/** 腳底下面要留給 HP 條的高度（設計單位） */
const HP_BAR_ROOM = 24;

/** 敵人 HP 條最長（設計單位；6★ 立繪寬到滿版時不要整條拉滿） */
const MAX_HP_BAR_WIDTH = 300;

/** 「殘 1」（下個敵人回合就攻擊）的數字顏色；其他數字是白色 */
const COUNTDOWN_RED = "#ff4a3a";

/** 瞄準符號（puzzlelayout 50，72×72）的縮放 */
const TARGET_MARKER_SCALE = 0.9;

/** 敵人受擊時的紅色濾鏡 */
const HIT_TINT = "sepia(1) saturate(6) hue-rotate(-35deg) brightness(.95)";

export class EnemyLayer {
  enemies: Enemy[] = [];
  /** 玩家鎖定的目標（null＝自動選擇）；點敵人鎖定，再點一次解除 */
  target: Enemy | null = null;
  /** 教學用：敵人不會死（HP 最少留 1） */
  cannotDie = false;

  constructor(
    readonly element: HTMLElement,
    private effectLayer: HTMLElement,
    private origin: () => { x: number; y: number } = () => ({ x: 0, y: 0 }),
  ) {}

  /** 敵人腳底中心的版面座標 */
  pointOf(enemy: Enemy) {
    const origin = this.origin();
    return { x: origin.x + enemy.x, y: origin.y + enemy.y };
  }

  get waveCleared() {
    return this.enemies.every((enemy) => enemy.isDead);
  }

  setVisible(visible: boolean) {
    this.element.style.visibility = visible ? "" : "hidden";
  }

  /** 放上一個合戰的敵人（不動畫） */
  setEnemies(definitions: EnemyDefinition[]) {
    this.element.innerHTML = "";
    this.target = null;
    this.enemies = definitions.map((definition) => {
      const artSize = getAssetSize(definition.artAssetId),
        width = artSize.width * definition.scale,
        height = artSize.height * definition.scale;
      const element = document.createElement("div");
      element.className = "enemy";
      element.style.transform = translateUnits(definition.x, definition.y);
      // 站得越前面（y 越大）蓋在越上面：後排的敵人被前排擋住
      element.style.zIndex = String(Math.round(definition.y));
      const artElement = createImageElement(
        element,
        {
          left: designUnit(-width / 2),
          top: designUnit(-height),
          width: designUnit(width),
          height: designUnit(height),
          backgroundImage: `url(${getAssetUrl(definition.artAssetId)})`,
        },
        "enemy-art",
      );
      // 點敵人：鎖定為攻擊目標（再點一次解除）。立繪圖有透明的部分會疊到別人，所以依點到的像素判斷是誰
      artElement.addEventListener("pointerup", (event) =>
        this.toggleTarget(this.enemyAt(event.clientX, event.clientY) ?? enemy),
      );
      const frameSize = getAssetSize(BATTLE_ASSETS.enemyHpFrame),
        // HP 條長度依看得到的寬度（不是圖寬：有些立繪左右留白很多），最長 MAX_HP_BAR_WIDTH
        barWidth = Math.min(
          MAX_HP_BAR_WIDTH,
          Math.max(frameSize.width, definition.visibleWidth * 0.62),
        );
      createImageElement(element, {
        left: designUnit(-barWidth / 2),
        top: designUnit(6),
        width: designUnit(barWidth),
        height: designUnit(frameSize.height),
        backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.enemyHpFrame)})`,
        backgroundSize: "100% 100%",
      });
      const hpBar = createImageElement(element, {
        left: designUnit(-barWidth / 2 + 2),
        top: designUnit(8),
        width: designUnit(barWidth - 4),
        height: designUnit(frameSize.height - 4),
        background: `url(${getAssetUrl(BATTLE_ASSETS.enemyHpFill)}) 0 0/100% 100%`,
        transformOrigin: "0 50%",
      });
      const countdownElement = createImageElement(element);
      const damageNumber = createImageElement(element);
      if (definition.showName && definition.name) {
        const plateSize = getAssetSize(BATTLE_ASSETS.enemyNamePlate);
        const namePlate = createImageElement(
          element,
          {
            left: designUnit(-plateSize.width * 0.6),
            top: designUnit(-8),
            width: designUnit(plateSize.width * 1.2),
            height: designUnit(plateSize.height * 1.2),
            backgroundImage: `url(${getAssetUrl(BATTLE_ASSETS.enemyNamePlate)})`,
            backgroundSize: "100% 100%",
            font: `900 ${designUnit(24)}/${designUnit(plateSize.height * 1.2)} sans-serif`,
            color: "#fff",
            textAlign: "center",
          },
          "enemy-name-plate",
        );
        namePlate.textContent = definition.name;
      }
      this.element.appendChild(element);
      const enemy: Enemy = {
        ...definition,
        element,
        artElement,
        hpBar,
        countdownElement,
        damageNumber,
        currentHp: definition.hp,
        // 開場的殘數：先攻＝1（第一個敵人回合就出手），否則 firstCountdown，都沒寫＝interval
        countdown: definition.firstStrike
          ? 1
          : (definition.firstCountdown ?? definition.attack.interval),
        attackCount: 0,
        usedSkills: new Set(),
        isDead: false,
        pendingDamage: 0,
        drain: { remaining: 0, ratePerMs: 0 },
      };
      void this.renderCountdown(enemy);
      return enemy;
    });
  }

  /** 敵人登場：由上往下淡入 */
  async playEntrance() {
    this.setVisible(true);
    // 名牌在登場時蓋在 HP 條的位置，停一下後淡出，露出 HP 條（v5 175 067～176 500）
    void wait(unitTiming.namePlateHoldMs).then(() =>
      this.element.querySelectorAll<HTMLElement>(".enemy-name-plate").forEach(
        (plate) =>
          void plate
            .animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: unitTiming.namePlateFadeMs,
              fill: "forwards",
            })
            .finished.then(() => plate.remove()),
      ),
    );
    await Promise.all(
      this.enemies.map(
        (enemy, index) =>
          enemy.element.animate(
            [
              { opacity: 0, transform: translateUnits(enemy.x, enemy.y - 40) },
              { opacity: 1, transform: translateUnits(enemy.x, enemy.y) },
            ],
            {
              duration: 420,
              delay: index * 90,
              fill: "backwards",
              easing: "ease-out",
            },
          ).finished,
      ),
    );
  }

  artHeightOf(enemy: Enemy) {
    return getAssetSize(enemy.artAssetId).height * enemy.scale;
  }

  /** 「殘N」：數字用原版 BFEnemyCountDown；「殘」字的原版字型尚未找到，暫用文字（自製素材 README #6） */
  async renderCountdown(enemy: Enemy) {
    const height = this.artHeightOf(enemy);
    /** 只剩 1（下個敵人回合就攻擊）：紅色並忽暗忽明（battle.css 的 .countdown-warning）；其他數字白色 */
    const isWarning = enemy.countdown === 1;
    const digits = await renderBitmapText(
      BATTLE_FONTS.enemyCountdown,
      String(enemy.countdown),
      isWarning ? COUNTDOWN_RED : "#ffffff",
    );
    const scale = 30 / digits.height;
    enemy.countdownElement.innerHTML =
      `<b style="left:${designUnit(-34)};top:0;width:${designUnit(30)};height:${designUnit(30)};font:900 ${designUnit(26)}/${designUnit(30)} sans-serif;color:#d01818;-webkit-text-stroke:${designUnit(4)} #200;paint-order:stroke fill">殘</b>` +
      `<b${isWarning ? ' class="countdown-warning"' : ""} style="left:0;top:0;width:${designUnit(digits.width * scale)};height:${designUnit(30)};background:url(${digits.url}) 0 0/100% 100%"></b>`;
    Object.assign(enemy.countdownElement.style, {
      left: designUnit(-8),
      top: designUnit(-height - 34),
    });
  }

  /** 下一隻小兵要攻擊的敵人：鎖定目標優先，否則選第一個還沒被打死的 */
  /** 全體攻擊的目標：所有還活著的敵人 */
  allAttackTargets(): Enemy[] {
    return this.enemies.filter((enemy) => !enemy.isDead);
  }

  pickAttackTarget(): Enemy | undefined {
    const alive = this.enemies.filter(
      (enemy) => !enemy.isDead && enemy.currentHp - enemy.pendingDamage > 0,
    );
    return this.target && !this.target.isDead
      ? this.target
      : (alive[0] ?? this.enemies.find((enemy) => !enemy.isDead));
  }

  /** 命中時敵人變紅、晃動 */
  playHitReaction(enemy: Enemy) {
    restartCssAnimation(enemy.artElement, "is-shaking");
    void enemy.artElement.animate(
      [
        { filter: HIT_TINT },
        { filter: HIT_TINT, offset: 0.7 },
        { filter: "none" },
      ],
      { duration: unitTiming.enemyHitTintMs },
    );
  }

  /**
   * 敵人頭上的傷害數字：命中時加上傷害，之後隨 HP 條下降往下數（v1 124 400 → 125 133，約 700 ms 數完一次命中）。
   * 連續命中同一個敵人時數字累加，共用同一個倒數。數字顏色依傷害來源的勢力。
   */
  drainHp(enemy: Enemy, damage: number, sourceKind: PieceKind): Promise<void> {
    const drain = enemy.drain;
    drain.remaining += damage;
    drain.ratePerMs = Math.max(
      drain.ratePerMs,
      drain.remaining / unitTiming.enemyHpDrainMs,
    );
    if (drain.running) return drain.running;
    const artHeight = this.artHeightOf(enemy),
      minimumHp = this.cannotDie ? 1 : 0;
    drain.running = (async () => {
      let lastTime = performance.now();
      while (drain.remaining > 0) {
        await nextFrame();
        const now = performance.now(),
          amount = Math.min(
            drain.remaining,
            drain.ratePerMs * (now - lastTime),
          );
        lastTime = now;
        drain.remaining -= amount;
        enemy.currentHp = Math.max(minimumHp, enemy.currentHp - amount);
        enemy.hpBar.style.transform = `scaleX(${Math.max(0, enemy.currentHp / enemy.hp)})`;
        await setBitmapTextImage(
          enemy.damageNumber,
          BATTLE_FONTS.number,
          String(Math.ceil(drain.remaining)),
          DAMAGE_NUMBER_COLORS[sourceKind],
          36,
          0,
          -artHeight * 0.7,
          "center",
        );
      }
      enemy.currentHp = Math.round(enemy.currentHp);
      enemy.damageNumber.style.display = "none";
      drain.ratePerMs = 0;
      drain.running = undefined;
    })();
    return drain.running;
  }

  /** 敵人回復 amount HP（技能 healSelf）：HP 條往上長、頭上綠色數字 */
  async healEnemy(enemy: Enemy, amount: number) {
    const from = enemy.currentHp,
      to = Math.min(enemy.hp, from + amount),
      startedAt = performance.now(),
      artHeight = this.artHeightOf(enemy);
    for (;;) {
      const progress = Math.min(
        1,
        (performance.now() - startedAt) / unitTiming.enemyHealMs,
      );
      enemy.currentHp = from + (to - from) * progress;
      enemy.hpBar.style.transform = `scaleX(${enemy.currentHp / enemy.hp})`;
      await setBitmapTextImage(
        enemy.damageNumber,
        BATTLE_FONTS.number,
        `+${Math.round((to - from) * progress)}`,
        DAMAGE_NUMBER_COLORS.shu,
        36,
        0,
        -artHeight * 0.7,
        "center",
      );
      if (progress >= 1) break;
      await nextFrame();
    }
    enemy.currentHp = Math.round(to);
    await wait(unitTiming.enemyHealHoldMs);
    enemy.damageNumber.style.display = "none";
  }

  /** 攻擊結算後：HP 歸零的敵人播放死亡演出（回傳全部演完的 Promise） */
  resolveDeaths() {
    const deaths: Promise<void>[] = [];
    for (const enemy of this.enemies) {
      enemy.pendingDamage = 0;
      if (!enemy.isDead && enemy.currentHp <= 0) {
        enemy.isDead = true;
        deaths.push(this.playDeath(enemy));
      }
    }
    return Promise.all(deaths);
  }

  /** 死亡（v5 160 888～、v1 125 267～125 600）：先變全黑剪影 → 爆光 → 煙霧散開，敵人消失（金幣素材尚未找到，未畫） */
  private async playDeath(enemy: Enemy) {
    const { x, y } = this.pointOf(enemy),
      centerY = y - this.artHeightOf(enemy) * 0.5;
    await enemy.artElement.animate(
      [{ filter: "brightness(0)" }, { filter: "brightness(0)" }],
      { duration: unitTiming.enemyDeathBlackMs, fill: "forwards" },
    ).finished;
    void playHitBurst(this.effectLayer, x, centerY);
    playEnemyDeathSmoke(this.effectLayer, x, centerY);
    await enemy.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: unitTiming.enemyDeathFadeMs,
      fill: "forwards",
    }).finished;
  }

  /**
   * 螢幕座標（clientX/Y）上看得到的敵人：由前往後（站得越前面越先）找第一個「那個像素不透明」的敵人；
   * 都點在透明處時回傳 undefined。
   */
  enemyAt(clientX: number, clientY: number): Enemy | undefined {
    const alive = this.enemies
      .filter((enemy) => !enemy.isDead)
      .sort((a, b) => b.y - a.y);
    for (const enemy of alive) {
      const rect = enemy.artElement.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX >= rect.right ||
        clientY < rect.top ||
        clientY >= rect.bottom
      )
        continue;
      const mask = enemy.hitMask;
      if (!mask) return enemy;
      const x = Math.floor(((clientX - rect.left) / rect.width) * mask.width),
        y = Math.floor(((clientY - rect.top) / rect.height) * mask.height);
      // 邊緣放寬 1 格（手指點在輪廓上也算）
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx,
            py = y + dy;
          if (
            px >= 0 &&
            py >= 0 &&
            px < mask.width &&
            py < mask.height &&
            mask.opaque[py * mask.width + px]
          )
            return enemy;
        }
    }
    return undefined;
  }

  /**
   * 敵人可以用的上下範圍（<Enemies> 內的座標）：依畫面上 Menu 按鈕下緣、我方頭像上緣量出來
   * （元件位置改了也跟著變）；量不到時用 DEFAULT_VERTICAL_LIMITS。
   */
  verticalLimits(): VerticalLimits {
    const screen = this.element.closest(".battle-screen") ?? document;
    const menu = screen.querySelector(".battle-part-menu"),
      portraits = screen.querySelector(".battle-part-portraits");
    const origin = this.element.getBoundingClientRect().top,
      unit = currentStage.unitPx;
    const limits = { ...DEFAULT_VERTICAL_LIMITS };
    if (menu)
      limits.top =
        (menu.getBoundingClientRect().bottom - origin) / unit + COUNTDOWN_ROOM;
    if (portraits)
      limits.bottom =
        (portraits.getBoundingClientRect().top - origin) / unit - HP_BAR_ROOM;
    return limits;
  }

  /** 玩家點敵人：鎖定；點已鎖定的敵人＝解除。倒下的敵人不能鎖定 */
  toggleTarget(enemy: Enemy) {
    if (enemy.isDead) return;
    this.setTarget(this.target === enemy ? -1 : this.enemies.indexOf(enemy));
  }

  /** 找敵人（教學高亮用）：還活著、id 相同的第一個 */
  findAlive(id: string) {
    return this.enemies.find((enemy) => enemy.id === id && !enemy.isDead);
  }

  /** 鎖定目標：太極圖（puzzlelayout 50）；index＝-1 解除 */
  setTarget(index: number) {
    this.target = this.enemies[index] ?? null;
    this.enemies.forEach((enemy) =>
      enemy.element.querySelector(".target-marker")?.remove(),
    );
    if (!this.target) return;
    // 立繪正中央：外層定位 → 呼吸（明暗交替）→ 旋轉（CSS 動畫見 battle.css），標記時淡入
    const enemy = this.target,
      size = layoutPartRect(LAYOUT_PART.target).w * TARGET_MARKER_SCALE;
    const marker = createImageElement(
      enemy.element,
      { left: "0", top: designUnit(-this.artHeightOf(enemy) / 2) },
      "target-marker",
    );
    const breathe = createImageElement(marker, {}, "target-breathe");
    createImageElement(
      breathe,
      {
        ...layoutPartStyle(LAYOUT_PART.target, TARGET_MARKER_SCALE),
        left: designUnit(-size / 2),
        top: designUnit(-size / 2),
      },
      "target-spin",
    );
    marker.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: unitTiming.targetFadeInMs,
      easing: "ease-out",
    });
  }
}

/**
 * 我方部隊：部隊 HP、每位武將本回合的傷害、頭上的小兵（token）、傷害數字、HP 條上方的回復量。
 * 頭像與 HP 條是 React 元件（BattleCanvas.tsx 的 <PartyPortraits>、<PartyHpBar>），這裡只讀它們的位置；
 * 頭上小兵、數字、回復量畫在效果層（版面座標，可跨區移動）。HP 改變時更新 HudState，HP 條會自己重畫。
 */
/** 戰鬥中的一位武將 */
export interface PartyMember extends PartyMemberDefinition {
  /** 本回合累積的傷害（未乘連擊倍率） */
  damage: number;
  /** 畫面上目前顯示的數字 */
  shownDamage: number;
  /** 本回合是否全體攻擊（同勢力一次消除 5 個以上）：小兵分成每個敵人一隻，每個敵人都受到全部傷害 */
  attacksAll: boolean;
  /** 頭上的小兵 */
  token: HTMLElement;
  tokenSprite: HTMLElement;
  damageNumber: HTMLElement;
  /** 數字上數動畫的佇列（依序播放） */
  counting: Promise<void>;
}

/** 傷害數字的位置：above＝頭像上方（數字在數）、onPortrait＝落在頭像上（數完）、atTokenFeet＝頭上小兵腳下 */
export type DamageNumberPosition = "above" | "onPortrait" | "atTokenFeet";

type Origin = () => { x: number; y: number };
/** 頭像的排列（<PartyPortraits>）：origin＝第一位頭像左上角（版面座標），size＝邊長，gap＝空隙 */
export interface PortraitArrangement {
  origin: Origin;
  size: number;
  gap: number;
}
/** HP 條的位置（<PartyHpBar>）：origin＝愛心左上角（版面座標），w＝全寬 */
export interface HpBarPlacement {
  origin: Origin;
  w: number;
}

export class PartyPanel {
  readonly members: PartyMember[];
  hp = 0;
  maxHp = 0;
  /** 本回合累積的回復量（未乘連擊倍率） */
  pendingHeal = 0;
  /** HP 條上方的回復量（綠字） */
  private healText: HTMLElement;

  constructor(
    effectLayer: HTMLElement,
    definitions: PartyMemberDefinition[],
    private arrangement: PortraitArrangement,
    private hud: HudState,
    private hpBar: HpBarPlacement | null,
  ) {
    this.members = definitions.map((definition) => {
      const token = document.createElement("div");
      token.className = "party-token";
      token.style.display = "none";
      const tokenSprite = createImageElement(token);
      paintTroopSprite(tokenSprite, definition.faction, definition.troop, 0);
      effectLayer.appendChild(token);
      const damageNumber = createImageElement(
        effectLayer,
        {},
        "party-damage-number",
      );
      return {
        ...definition,
        damage: 0,
        shownDamage: 0,
        attacksAll: false,
        token,
        tokenSprite,
        damageNumber,
        counting: Promise.resolve(),
      };
    });
    this.maxHp = this.hp = definitions.reduce(
      (sum, member) => sum + member.hp,
      0,
    );
    this.healText = createImageElement(effectLayer);
    void this.renderHp();
  }

  /** 頭像上緣（版面座標） */
  get portraitTop() {
    return this.arrangement.origin().y;
  }

  /** 頭像中心 x（版面座標） */
  centerXOf(member: PartyMember) {
    const { origin, size, gap } = this.arrangement;
    return origin().x + (size + gap) * this.members.indexOf(member) + size / 2;
  }

  /** 回復魂飛往的位置（HP 條右側） */
  get healSoulTarget() {
    return this.hpPoint(550, -38);
  }

  /**
   * HP 條上相對位置 (dx, dy) 的版面座標（回復量、敵人攻擊的傷害數字用）。
   * dx 以原版全寬 620 為準，HP 條拉長時等比換算；沒有 HP 條時以頭像列下方為準。
   */
  hpPoint(dx: number, dy: number) {
    if (!this.hpBar) return { x: 320, y: this.portraitTop + 100 + dy };
    const origin = this.hpBar.origin();
    return {
      x: origin.x + (dx * this.hpBar.w) / HP_BAR_WIDTH,
      y: origin.y + dy,
    };
  }

  membersOfFaction(faction: string) {
    return this.members.filter((member) => member.faction === faction);
  }

  /** HP 改變後呼叫：HP 條（React）跟著重畫 */
  async renderHp() {
    this.hud.set({ hp: this.hp, maxHp: this.maxHp });
  }

  /** 消除一組（變白那一禎）：記錄傷害（同勢力武將）或回復（桃子）；5 個以上＝全體攻擊 */
  recordGroup(group: MatchGroup) {
    const sizeBonus = 1 + 0.25 * (group.cells.length - 3);
    if (group.kind === "peach") {
      this.pendingHeal +=
        this.members.reduce((sum, member) => sum + member.recovery, 0) *
        sizeBonus;
      return;
    }
    for (const member of this.membersOfFaction(group.kind)) {
      member.damage += member.attack * sizeBonus;
      if (group.cells.length >= ALL_ATTACK_SIZE) member.attacksAll = true;
    }
  }

  /** HP 條上方的回復量（綠字）；(dx, dy)＝相對 HP 條原點的中心上緣；text 為空字串時隱藏 */
  async setHealText(text: string, height = 0, dx = 0, dy = 0) {
    const { x, y } = this.hpPoint(dx, dy);
    await setBitmapTextImage(
      this.healText,
      BATTLE_FONTS.number,
      text,
      text ? DAMAGE_NUMBER_COLORS.peach : "",
      height,
      x,
      y,
      "center",
    );
  }

  async drawDamageNumber(
    member: PartyMember,
    value: number,
    position: DamageNumberPosition,
  ) {
    const top = this.portraitTop;
    const y =
      position === "above"
        ? top - 44
        : position === "atTokenFeet"
          ? top - 22
          : top + 4;
    await setBitmapTextImage(
      member.damageNumber,
      BATTLE_FONTS.number,
      String(value),
      DAMAGE_NUMBER_COLORS[member.faction],
      position === "onPortrait" ? 34 : 40,
      this.centerXOf(member),
      y,
      "center",
    );
  }

  /** 新的傷害到：頭上小兵先收起，數字在頭像上出現 → 移到上方往上數 → 落回頭像，小兵再出現（v1 119 433～119 900） */
  queueDamageCountUp(member: PartyMember) {
    member.counting = member.counting.then(() =>
      this.countUpDamage(member, Math.round(member.damage)),
    );
  }

  private async countUpDamage(member: PartyMember, to: number) {
    member.token.style.display = "none";
    await this.drawDamageNumber(member, member.shownDamage, "onPortrait");
    await wait(unitTiming.damageNumberLiftMs);
    const from = member.shownDamage,
      startedAt = performance.now();
    for (;;) {
      const progress = Math.min(
        1,
        (performance.now() - startedAt) / unitTiming.damageCountUpMs,
      );
      member.shownDamage = Math.round(from + (to - from) * progress);
      await this.drawDamageNumber(member, member.shownDamage, "above");
      if (progress >= 1) break;
      await nextFrame();
    }
    await wait(unitTiming.damageSettleMs);
    await this.drawDamageNumber(member, member.shownDamage, "onPortrait");
    this.showToken(member);
  }

  /** 頭上小兵的縮放（與衝鋒小兵相同，由 BattleScreen 設定＝<Troops h>） */
  tokenScale = () => 0.95;

  /**
   * 顯示頭上小兵：就是之後衝出去的小兵（依兵種，背面），腳底站在頭像上緣。
   * frame＝跑步的第幾張（0／1 左右腳）；hopHeight＞0 時往上跳起
   */
  showToken(member: PartyMember, frame = 0, hopHeight = 0) {
    paintTroopSprite(
      member.tokenSprite,
      member.faction,
      member.troop,
      frame,
      this.tokenScale(),
    );
    member.token.style.display = "block";
    member.token.style.transform = translateUnits(
      this.centerXOf(member),
      this.portraitTop - hopHeight,
    );
  }

  /** 等所有武將的數字動畫播完 */
  async waitForCounting() {
    await Promise.all(this.members.map((member) => member.counting));
  }

  /** 回合結束：清除傷害、隱藏頭上小兵與數字 */
  resetAfterAttack() {
    for (const member of this.members) {
      member.damage = 0;
      member.shownDamage = 0;
      member.attacksAll = false;
      member.token.style.display = "none";
      member.damageNumber.style.display = "none";
    }
  }
}
