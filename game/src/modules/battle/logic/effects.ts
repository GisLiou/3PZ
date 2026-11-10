/**
 * 戰鬥特效（直接操作 DOM，畫在效果層或小兵層）：
 *   「合戰 n/m」與「勝利！」大字、命中爆光／煙霧／血花／全畫面泛紅、從全白退場、魂、衝鋒小兵圖。
 * 檔案最後：戰鬥背景（<Scenery>：天空＋透視地面）。
 */
import { getAssetSize, getAssetUrl } from "@core/assetLoader";
import { nextFrame, wait } from "@core/animate";
import { designUnit, translateUnits, currentStage } from "@core/stage";
import { atlasPartStyle, renderBitmapText, type AtlasPartRect } from "@ui";
import {
  BATTLE_ASSETS,
  BATTLE_FONTS,
  EFFECT_PART,
  effectPartRect,
  effectPartStyle,
  createImageElement,
  BATTLE_LAYOUT_HEIGHT,
  fast,
} from "./battleAssets";
import { type Faction } from "./boardRules";
import troopData from "@data/troops.json";
import summonAtlas from "@data/atlas/kibou001.json";
import { type TroopType } from "./battleAssets";

/** 特效的演出時間（毫秒）：白色退場、魂、命中、合戰大字、敵人攻擊、勝利。逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md */
export const effectTiming = {
  /** 敵人技能：頭上技能名稱停留、打到我方的火焰／雷擊、三處錯開 */
  skillNameMs: 900,
  enemyFxMs: fast(500),
  enemyFxStaggerMs: fast(80),
  /** 兵種攻擊特效（斬擊、劈砍、突刺、箭命中光） */
  strikeMs: fast(300),
  /** 弓兵：箭飛行時間、連射間隔 */
  arrowFlightMs: fast(220),
  arrowIntervalMs: fast(70),
  /** 神算：火球飛行、火焰每張 */
  fireBoltFlightMs: fast(260),
  fireFrameMs: fast(50),
  /** 鬼謀：竹簡每張、伏兵跳進來 */
  scrollFrameMs: fast(110),
  summonLeapMs: fast(260),
  /** 白色退去的不透明度逐禎量測：[距開始的毫秒, 不透明度]（108 507 全白 → 109 096 完全退去） */
  fadeFromWhiteFrames: [
    [0, 1],
    [54, 0.64],
    [107, 0.54],
    [161, 0.51],
    [214, 0.41],
    [268, 0.38],
    [321, 0.32],
    [375, 0.24],
    [428, 0.12],
    [482, 0.11],
    [535, 0.04],
    [589, 0],
  ] as const,
  /** 格子空出後，魂柱從該組中心往上升到武將列（119 133～119 233，3 禎） */
  soulRiseMs: fast(100),
  /** 魂柱分成每位同勢力武將一團，往上飄到武將頭上後消失（119 233～119 400，5 禎） */
  soulSpreadMs: fast(167),
  /** 命中爆光（attackeffect2，124 200～124 400） */
  hitEffectMs: fast(267),
  /** 「合戰 n/m」顯示時間（v5 108 721 → 110 433） */
  waveBannerMs: 1712,
  enemyDeathSmokeMs: fast(400),
  /** 敵人攻擊（v5 178 705～180 000，53 ms 一禎）：紅／正常閃爍每格 53 ms；全畫面泛紅 ~500 ms；血花每 53 ms 一個 */
  enemyStrikeBlinkMs: fast(53),
  enemyStrikeRedFlashMs: fast(800),
  bloodSplashMs: fast(267),
  /** 「勝利！」每個字縮放出現的時間與間隔 */
  victoryCharMs: 160,
  victoryCharGapMs: 110,
} as const;

/** 「合戰 n/m」（原版字型 BF_BattleCnt ＋ BF_BattleCntNum）淡入、停留、淡出。畫在 <WaveBanner> 元件裡：上緣＝元件 y，水平置中於 320 */
export async function playWaveBanner(
  layer: HTMLElement,
  wave: number,
  totalWaves: number,
  height: number,
  gap: number,
) {
  const banner = document.createElement("div");
  Object.assign(banner.style, { position: "absolute", left: "0", top: "0" });
  const [label, number] = await Promise.all([
    renderBitmapText(BATTLE_FONTS.waveLabel, "合戦"),
    renderBitmapText(BATTLE_FONTS.waveNumber, `${wave}/${totalWaves}`),
  ]);
  const top = 0;
  const labelWidth = (label.width * height) / label.height,
    numberWidth = (number.width * height) / number.height;
  const left = 320 - (labelWidth + gap + numberWidth) / 2;
  banner.innerHTML =
    `<i style="left:${designUnit(left)};top:${designUnit(top)};width:${designUnit(labelWidth)};height:${designUnit(height)};background:url(${label.url}) 0 0/100% 100%"></i>` +
    `<i style="left:${designUnit(left + labelWidth + gap)};top:${designUnit(top)};width:${designUnit(numberWidth)};height:${designUnit(height)};background:url(${number.url}) 0 0/100% 100%"></i>`;
  layer.appendChild(banner);
  await banner.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.85 },
      { opacity: 0 },
    ],
    { duration: effectTiming.waveBannerMs },
  ).finished;
  banner.remove();
}

/** 「勝利！」：win_efe01～03 三個字依序縮放出現，再亮起背後的光 win_efe04。回傳整個圖層（由呼叫端決定何時移除） */
export async function playVictory(layer: HTMLElement): Promise<HTMLElement> {
  const victory = document.createElement("div");
  Object.assign(victory.style, { position: "absolute", inset: "0" });
  const light = getAssetSize(BATTLE_ASSETS.victoryLight);
  const charIds = [
    BATTLE_ASSETS.victoryChar1,
    BATTLE_ASSETS.victoryChar2,
    BATTLE_ASSETS.victoryChar3,
  ];
  const charLefts = [70, 250, 470];
  victory.innerHTML =
    `<i class="victory-light" style="left:${designUnit(320 - light.width)};top:${designUnit(250 - light.height)};width:${designUnit(light.width * 2)};height:${designUnit(light.height * 2)};background:url(${getAssetUrl(BATTLE_ASSETS.victoryLight)}) 0 0/100% 100%"></i>` +
    charIds
      .map((id, index) => {
        const size = getAssetSize(id);
        return `<i class="victory-char" style="left:${designUnit(charLefts[index]!)};top:${designUnit(170)};width:${designUnit(size.width)};height:${designUnit(size.height)};background:url(${getAssetUrl(id)}) 0 0/100% 100%"></i>`;
      })
      .join("");
  layer.appendChild(victory);
  const chars = [...victory.querySelectorAll<HTMLElement>(".victory-char")];
  await Promise.all(
    chars.map(
      (char, index) =>
        char.animate(
          [
            { transform: "scale(2.4)", opacity: 0 },
            { transform: "scale(1)", opacity: 1 },
          ],
          {
            duration: effectTiming.victoryCharMs,
            delay: index * effectTiming.victoryCharGapMs,
            fill: "backwards",
            easing: "ease-out",
          },
        ).finished,
    ),
  );
  victory.querySelector<HTMLElement>(".victory-light")!.animate(
    [
      { opacity: 0, transform: "scale(.6)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    { duration: 300, fill: "forwards" },
  );
  return victory;
}

/** 命中與死亡的特效（畫在效果層）：爆光、放射光、光環、斬線、死亡煙霧、敵人攻擊的血花 */
/** 以素材原尺寸 × scale 建立一個置中於原點的特效圖 */
function createCenteredEffect(
  layer: HTMLElement,
  assetId: string,
  scale: number,
  extraStyle: Partial<CSSStyleDeclaration> = {},
) {
  const size = getAssetSize(assetId);
  return createImageElement(layer, {
    left: designUnit((-size.width * scale) / 2),
    top: designUnit((-size.height * scale) / 2),
    width: designUnit(size.width * scale),
    height: designUnit(size.height * scale),
    backgroundImage: `url(${getAssetUrl(assetId)})`,
    backgroundSize: "100% 100%",
    ...extraStyle,
  });
}

/**
 * 命中爆光：attackeffect2 由小放大再淡出，加上放射光與光環（v1 124 200～124 467，約 267 ms）。
 */
export async function playHitBurst(
  layer: HTMLElement,
  x: number,
  y: number,
  filter = "",
) {
  const burst = createCenteredEffect(layer, BATTLE_ASSETS.hitBurst, 0.85, {
    filter,
  });
  const rays = createCenteredEffect(layer, BATTLE_ASSETS.hitRays, 0.45, {
    filter,
  });
  const ring = createCenteredEffect(layer, BATTLE_ASSETS.hitRing, 0.7, {
    filter,
  });
  const duration = effectTiming.hitEffectMs;
  const effects = [burst, rays, ring];
  const animations = [
    burst.animate(
      [
        { transform: translateUnits(x, y, " scale(.25)"), opacity: 1 },
        {
          transform: translateUnits(x, y, " scale(1)"),
          opacity: 1,
          offset: 0.4,
        },
        {
          transform: translateUnits(x, y, " scale(1.15)"),
          opacity: 1,
          offset: 0.75,
        },
        { transform: translateUnits(x, y, " scale(1.25)"), opacity: 0 },
      ],
      { duration },
    ).finished,
    rays.animate(
      [
        { transform: translateUnits(x, y + 40, " scale(.3)"), opacity: 1 },
        { transform: translateUnits(x, y + 40, " scale(1.1)"), opacity: 0 },
      ],
      { duration },
    ).finished,
    ring.animate(
      [
        { transform: translateUnits(x, y, " scale(.3)"), opacity: 0.9 },
        { transform: translateUnits(x, y, " scale(1.2)"), opacity: 0 },
      ],
      { duration },
    ).finished,
  ];
  await Promise.all(animations);
  effects.forEach((element) => element.remove());
}

/** 一個置中特效：依 frames 播放後移除 */
function runEffect(
  layer: HTMLElement,
  assetId: string,
  scale: number,
  frames: Keyframe[],
  duration: number,
  extraStyle: Partial<CSSStyleDeclaration> = {},
) {
  const element = createCenteredEffect(layer, assetId, scale, extraStyle);
  return element
    .animate(frames, { duration, fill: "forwards", easing: "ease-out" })
    .finished.then(() => element.remove());
}

/**
 * 近戰兵種命中時的攻擊特效（攻擊動作的最後一張開始，畫在小兵層 (x, y)＝命中點）：
 * 劍兵：斬擊光（zangeki_ef）斜向一劃；槍兵：突刺爆光（spear_ef）；蠻兵：劈砍光（axe_ef）由上往下；騎兵：衝擊爆光（trooper_ef）。
 */
export async function playMeleeStrike(
  layer: HTMLElement,
  troop: TroopType,
  x: number,
  y: number,
) {
  const duration = effectTiming.strikeMs;
  const at = (dx: number, dy: number, extra: string) =>
    translateUnits(x + dx, y + dy, extra);
  switch (troop) {
    case "swordsman":
      // 斜向一劃：由右上往左下拉長（v5 159 450：命中時一道長斜光）
      await runEffect(
        layer,
        BATTLE_ASSETS.strikeSlash,
        1.1,
        [
          { transform: at(0, 0, " rotate(35deg) scale(1,.2)"), opacity: 1 },
          {
            transform: at(0, 0, " rotate(35deg) scale(1.2,1.6)"),
            opacity: 1,
            offset: 0.4,
          },
          { transform: at(0, 0, " rotate(35deg) scale(.6,1.8)"), opacity: 0 },
        ],
        duration,
      );
      return;
    case "barbarian":
      // 由上往下劈
      await runEffect(
        layer,
        BATTLE_ASSETS.strikeChop,
        1.8,
        [
          { transform: at(10, -60, " rotate(-15deg)"), opacity: 1 },
          { transform: at(0, 10, " rotate(5deg)"), opacity: 1, offset: 0.45 },
          { transform: at(-4, 30, " rotate(10deg)"), opacity: 0 },
        ],
        duration,
      );
      return;
    case "cavalry":
      // 衝擊：爆光由小放大，加上突刺放射線
      await Promise.all([
        runEffect(
          layer,
          BATTLE_ASSETS.strikeCharge,
          1.6,
          [
            { transform: at(0, 0, " scale(.3)"), opacity: 1 },
            { transform: at(0, 0, " scale(1)"), opacity: 1, offset: 0.4 },
            { transform: at(0, 0, " scale(1.3)"), opacity: 0 },
          ],
          duration,
        ),
        runEffect(
          layer,
          BATTLE_ASSETS.strikeThrustRays,
          0.8,
          [
            { transform: at(0, 0, " scale(.4)"), opacity: 1 },
            { transform: at(0, 0, " scale(1.3)"), opacity: 0 },
          ],
          duration,
        ),
      ]);
      return;
    default:
      // 槍兵：突刺爆光
      await Promise.all([
        runEffect(
          layer,
          BATTLE_ASSETS.strikeThrust,
          0.8,
          [
            { transform: at(0, -20, " scale(.3)"), opacity: 1 },
            { transform: at(0, -20, " scale(1)"), opacity: 1, offset: 0.4 },
            { transform: at(0, -20, " scale(1.2)"), opacity: 0 },
          ],
          duration,
        ),
        runEffect(
          layer,
          BATTLE_ASSETS.strikeThrustRays,
          0.7,
          [
            { transform: at(0, -20, " scale(.4)"), opacity: 1 },
            { transform: at(0, -20, " scale(1.2)"), opacity: 0 },
          ],
          duration,
        ),
      ]);
  }
}

/** 遠程攻擊的回傳：hit＝第一下命中（敵人開始受擊、扣血），done＝特效全部結束 */
export interface RangedAttack {
  hit: Promise<void>;
  done: Promise<void>;
}

/**
 * 遠程兵種的攻擊（小兵在 (fromX, fromY) 放完攻擊動作之後，打向 (toX, toY)）：
 *   弓兵：連射 3 支箭（ya），命中光（arrow_ef）
 *   神算：火球（shinsan_ef）飛向敵人，命中處燃起火焰（fire_01～10 逐張播放）
 *   鬼謀：頭上攤開竹簡（chikukan00～03：捲起 → 攤開 →「和」→「平」），召喚兩名伏兵從左右跳向敵人斬擊，紫色墨花濺開
 */
export function playRangedAttack(
  layer: HTMLElement,
  troop: TroopType,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): RangedAttack {
  let firstHit!: () => void;
  const hit = new Promise<void>((resolve) => (firstHit = resolve));
  const done =
    troop === "archer"
      ? playArrows(layer, fromX, fromY, toX, toY, firstHit)
      : troop === "tactician"
        ? playFireBolt(layer, fromX, fromY, toX, toY, firstHit)
        : playSummon(layer, fromX, fromY, toX, toY, firstHit);
  return { hit, done };
}

/** 從 from 飛到 to 的投射物（原圖朝上，轉向目標） */
function flyProjectile(
  layer: HTMLElement,
  assetId: string,
  scale: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  duration: number,
) {
  const angle = (Math.atan2(toX - fromX, -(toY - fromY)) * 180) / Math.PI;
  const element = createCenteredEffect(layer, assetId, scale);
  return element
    .animate(
      [
        { transform: translateUnits(fromX, fromY, ` rotate(${angle}deg)`) },
        { transform: translateUnits(toX, toY, ` rotate(${angle}deg)`) },
      ],
      { duration, easing: "linear" },
    )
    .finished.then(() => element.remove());
}

async function playArrows(
  layer: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  onHit: () => void,
) {
  const count = 3;
  await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      await wait(index * effectTiming.arrowIntervalMs);
      const spread = (index - (count - 1) / 2) * 14;
      await flyProjectile(
        layer,
        BATTLE_ASSETS.arrow,
        0.6,
        fromX,
        fromY,
        toX + spread,
        toY,
        effectTiming.arrowFlightMs,
      );
      onHit();
      await Promise.all([
        runEffect(
          layer,
          BATTLE_ASSETS.arrowHit,
          0.9,
          [
            {
              transform: translateUnits(toX + spread, toY, " scale(.4)"),
              opacity: 1,
            },
            {
              transform: translateUnits(toX + spread, toY, " scale(1)"),
              opacity: 0,
            },
          ],
          effectTiming.strikeMs,
        ),
        runEffect(
          layer,
          BATTLE_ASSETS.arrowHitRays,
          0.8,
          [
            {
              transform: translateUnits(toX + spread, toY, " scale(.4)"),
              opacity: 1,
            },
            {
              transform: translateUnits(toX + spread, toY, " scale(1.3)"),
              opacity: 0,
            },
          ],
          effectTiming.strikeMs,
        ),
      ]);
    }),
  );
}

async function playFireBolt(
  layer: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  onHit: () => void,
) {
  await flyProjectile(
    layer,
    BATTLE_ASSETS.fireBolt,
    1.6,
    fromX,
    fromY,
    toX,
    toY,
    effectTiming.fireBoltFlightMs,
  );
  onHit();
  // 火焰：fire_01～10 逐張播放，最後淡出
  const flame = createImageElement(layer);
  const frames = BATTLE_ASSETS.fireFrames;
  for (let i = 0; i < frames.length; i++) {
    const assetId = frames[i]!,
      size = getAssetSize(assetId),
      scale = 1.4;
    Object.assign(flame.style, {
      left: designUnit((-size.width * scale) / 2),
      top: designUnit(-size.height * scale),
      width: designUnit(size.width * scale),
      height: designUnit(size.height * scale),
      backgroundImage: `url(${getAssetUrl(assetId)})`,
      backgroundSize: "100% 100%",
      transform: translateUnits(toX, toY + 40),
      opacity: String(i < frames.length - 2 ? 1 : 0.6),
    });
    await wait(effectTiming.fireFrameMs);
  }
  flame.remove();
}

/** 鬼謀召喚的伏兵（kibou 圖集，各勢力相同）：左邊跳出的、右邊跳出的 */
const SUMMON_PARTS = { left: 6, right: 11, splash: 0 } as const;

async function playSummon(
  layer: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  onHit: () => void,
) {
  // 頭上攤開竹簡
  const scroll = createImageElement(layer);
  for (const assetId of BATTLE_ASSETS.summonScroll) {
    const size = getAssetSize(assetId);
    Object.assign(scroll.style, {
      left: designUnit(-size.width / 2),
      top: designUnit(-size.height / 2),
      width: designUnit(size.width),
      height: designUnit(size.height),
      backgroundImage: `url(${getAssetUrl(assetId)})`,
      backgroundSize: "100% 100%",
      transform: translateUnits(fromX, fromY - 130),
    });
    await wait(effectTiming.scrollFrameMs);
  }
  // 伏兵從敵人左右兩側跳進來斬擊
  const ninjas = (["left", "right"] as const).map((side) => {
    const element = createImageElement(layer, {
      ...atlasPartStyle(
        BATTLE_ASSETS.summonAtlas,
        summonAtlas.parts[SUMMON_PARTS[side]]!,
        summonAtlas.w,
        summonAtlas.h,
        0.8,
      ),
    });
    const part = summonAtlas.parts[SUMMON_PARTS[side]]!,
      dir = side === "left" ? -1 : 1;
    element.style.left = designUnit((-part.w * 0.8) / 2);
    element.style.top = designUnit(-part.h * 0.8);
    return element
      .animate(
        [
          { transform: translateUnits(toX + dir * 160, toY - 120), opacity: 0 },
          {
            transform: translateUnits(toX + dir * 70, toY - 40),
            opacity: 1,
            offset: 0.5,
          },
          { transform: translateUnits(toX + dir * 30, toY), opacity: 1 },
        ],
        {
          duration: effectTiming.summonLeapMs,
          fill: "forwards",
          easing: "ease-in",
        },
      )
      .finished.then(() => element);
  });
  const arrived = await Promise.all(ninjas);
  onHit();
  scroll.remove();
  const splash = createImageElement(layer, {
    ...atlasPartStyle(
      BATTLE_ASSETS.summonAtlas,
      summonAtlas.parts[SUMMON_PARTS.splash]!,
      summonAtlas.w,
      summonAtlas.h,
      0.7,
    ),
  });
  const splashPart = summonAtlas.parts[SUMMON_PARTS.splash]!;
  splash.style.left = designUnit((-splashPart.w * 0.7) / 2);
  splash.style.top = designUnit((-splashPart.h * 0.7) / 2);
  await Promise.all([
    playMeleeStrike(layer, "swordsman", toX, toY - 50),
    splash
      .animate(
        [
          {
            transform: translateUnits(toX, toY - 60, " scale(.3)"),
            opacity: 1,
          },
          {
            transform: translateUnits(toX, toY - 60, " scale(1)"),
            opacity: 0.9,
            offset: 0.5,
          },
          {
            transform: translateUnits(toX, toY - 60, " scale(1.1)"),
            opacity: 0,
          },
        ],
        { duration: effectTiming.strikeMs * 1.5, fill: "forwards" },
      )
      .finished.then(() => splash.remove()),
    ...arrived.map((element) =>
      element
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: effectTiming.strikeMs,
          fill: "forwards",
        })
        .finished.then(() => element.remove()),
    ),
  ]);
}

/** 死亡煙霧：三團煙往左、中、右散開（原版黑色爆炸素材尚未找到，以濾鏡調暗，見 自製素材 README #13） */
export function playEnemyDeathSmoke(layer: HTMLElement, x: number, y: number) {
  BATTLE_ASSETS.deathSmoke.forEach((assetId, index) => {
    const smoke = createCenteredEffect(layer, assetId, 1, {
      filter: "brightness(.25) sepia(.6)",
    });
    const spread = (index - 1) * 0.9;
    void smoke
      .animate(
        [
          { transform: translateUnits(x, y, " scale(.6)"), opacity: 0.9 },
          {
            transform: translateUnits(
              x + spread * 70,
              y - 20 - index * 6,
              " scale(1.6)",
            ),
            opacity: 0,
          },
        ],
        { duration: effectTiming.enemyDeathSmokeMs, fill: "forwards" },
      )
      .finished.then(() => smoke.remove());
  });
}

/**
 * 敵人攻擊（技能）打到我方的特效，畫在效果層。portraits＝我方頭像列的中心（版面座標）。
 *   fire     火焰（comboeffect_fire1／2）在頭像列上燃起
 *   thunder  雷擊（comboeffect_thunder3_big／12）從上方劈到頭像列
 * blood（血花）與 none 不在這裡處理。
 */
export async function playEnemyAttackFx(
  layer: HTMLElement,
  fx: "fire" | "thunder",
  portraits: { x: number; y: number },
) {
  const spots = [-180, 0, 180];
  await Promise.all(
    spots.map(async (dx, index) => {
      await wait(index * effectTiming.enemyFxStaggerMs);
      const assetId =
        fx === "fire"
          ? BATTLE_ASSETS.enemyFire[index % 2]!
          : BATTLE_ASSETS.enemyThunder[index % 2]!;
      const element = createCenteredEffect(
        layer,
        assetId,
        fx === "fire" ? 0.9 : 0.8,
        {
          mixBlendMode: "plus-lighter",
          // 雷由上往下劈：以上緣為縮放中心
          transformOrigin: fx === "thunder" ? "50% 0" : "50% 50%",
        },
      );
      const x = portraits.x + dx,
        y = portraits.y - (fx === "fire" ? 40 : 120);
      await element.animate(
        fx === "fire"
          ? [
              {
                transform: translateUnits(x, y + 40, " scale(.4)"),
                opacity: 0,
              },
              {
                transform: translateUnits(x, y, " scale(1)"),
                opacity: 1,
                offset: 0.3,
              },
              {
                transform: translateUnits(x, y - 30, " scale(1.15)"),
                opacity: 0,
              },
            ]
          : [
              { transform: translateUnits(x, y, " scaleY(.2)"), opacity: 1 },
              {
                transform: translateUnits(x, y, " scaleY(1)"),
                opacity: 1,
                offset: 0.25,
              },
              {
                transform: translateUnits(x, y, " scaleY(1)"),
                opacity: 0.2,
                offset: 0.5,
              },
              {
                transform: translateUnits(x, y, " scaleY(1)"),
                opacity: 1,
                offset: 0.65,
              },
              { transform: translateUnits(x, y, " scaleY(1)"), opacity: 0 },
            ],
        { duration: effectTiming.enemyFxMs, fill: "forwards" },
      ).finished;
      element.remove();
    }),
  );
}

/** 敵人使用技能時，頭上顯示技能名稱（(x, y)＝文字中心），停留後淡出 */
export async function playSkillName(
  layer: HTMLElement,
  name: string,
  x: number,
  y: number,
) {
  const label = document.createElement("div");
  Object.assign(label.style, {
    position: "absolute",
    left: designUnit(x - 200),
    top: designUnit(y - 24),
    width: designUnit(400),
    textAlign: "center",
    font: `900 ${designUnit(34)}/${designUnit(48)} 'PingFang TC','Noto Sans TC',sans-serif`,
    color: "#ffe23a",
    webkitTextStroke: `${designUnit(6)} #5a0c06`,
    paintOrder: "stroke fill",
    pointerEvents: "none",
  });
  label.textContent = name;
  layer.appendChild(label);
  await label.animate(
    [
      { opacity: 0, transform: "scale(1.6)" },
      { opacity: 1, transform: "scale(1)", offset: 0.15 },
      { opacity: 1, transform: "scale(1)", offset: 0.8 },
      { opacity: 0, transform: "scale(1)" },
    ],
    { duration: effectTiming.skillNameMs },
  ).finished;
  label.remove();
}

/** 敵人攻擊時身上濺出的紅色血花（effect_data 零件 6），每 53 ms 一個 */
export function playBloodSplashes(
  layer: HTMLElement,
  spots: Array<[number, number]>,
) {
  const rect = effectPartRect(EFFECT_PART.bloodSplash),
    scale = 0.55;
  spots.forEach(([x, y], index) => {
    const splash = createImageElement(layer, {
      ...effectPartStyle(EFFECT_PART.bloodSplash, scale),
      left: designUnit((-rect.w * scale) / 2),
      top: designUnit((-rect.h * scale) / 2),
    });
    void splash
      .animate(
        [
          { transform: translateUnits(x, y, " scale(.4)"), opacity: 0 },
          {
            transform: translateUnits(x, y, " scale(1)"),
            opacity: 1,
            offset: 0.25,
          },
          { transform: translateUnits(x, y, " scale(1.1)"), opacity: 0 },
        ],
        {
          duration: effectTiming.bloodSplashMs,
          delay: index * effectTiming.enemyStrikeBlinkMs,
          fill: "backwards",
        },
      )
      .finished.then(() => splash.remove());
  });
}

/** 全畫面泛紅（敵人攻擊；原版實作不明，以半透明紅色矩形代替，見 自製素材 README #14） */
export function playScreenRedFlash(screen: HTMLElement) {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    background: "rgba(230,40,20,.38)",
    pointerEvents: "none",
    zIndex: "6",
    opacity: "0",
  });
  screen.appendChild(overlay);
  void overlay
    .animate(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { opacity: 1, offset: 0.55 },
        { opacity: 0 },
      ],
      { duration: effectTiming.enemyStrikeRedFlashMs },
    )
    .finished.then(() => overlay.remove());
}

/** 畫面轉場：從全白退回戰鬥畫面（v5 108 507 → 109 096，不透明度逐禎量測見 effectTiming.fadeFromWhiteFrames） */
/** 在 layer 最上層立刻蓋一片白色；等 waitFor 完成（例：背景畫好）後，依錄影的不透明度曲線退去並移除 */
export async function playFadeFromWhite(
  layer: HTMLElement,
  waitFor?: Promise<unknown>,
) {
  const cover = document.createElement("div");
  Object.assign(cover.style, {
    position: "absolute",
    inset: "0",
    background: "#fff",
    zIndex: "100",
    pointerEvents: "none",
  });
  layer.appendChild(cover);
  await waitFor;
  const frames = effectTiming.fadeFromWhiteFrames;
  const durationMs = frames[frames.length - 1]![0];
  await cover.animate(
    frames.map(([time, opacity]) => ({ opacity, offset: time / durationMs })),
    { duration: durationMs, fill: "forwards" },
  ).finished;
  cover.remove();
}

/**
 * 魂（v1 119 133～119 433）：組的格子空出後，一道粉紅白魂柱從組中心升到武將列（100 ms），
 * 再分成每個目標一團、飄到目標上方後消失（167 ms）。
 */
/** 魂的粉紅色：原圖是白色雲，原版畫面上帶粉紅（以 CSS 濾鏡上色，見 自製素材 README #10） */
const SOUL_TINT = "sepia(.5) saturate(4) hue-rotate(280deg) brightness(1.15)";

/** portraitTop＝我方頭像上緣（魂柱往上拉到這附近，再分成數團飛向目標） */
export async function playSoulFlight(
  layer: HTMLElement,
  fromX: number,
  fromY: number,
  targets: Array<{ x: number; y: number }>,
  portraitTop: number,
) {
  const soulSize = getAssetSize(BATTLE_ASSETS.soul),
    soulBackground = `url(${getAssetUrl(BATTLE_ASSETS.soul)}) 0 0/100% 100%`;
  // 魂柱：雲轉直立，底部在組中心，頂端往上拉到武將列
  const column = createImageElement(layer, {
    left: designUnit(-soulSize.height / 2),
    top: designUnit(-soulSize.width),
    width: designUnit(soulSize.height),
    height: designUnit(soulSize.width),
    background: soulBackground,
    filter: SOUL_TINT,
    transformOrigin: "50% 100%",
  });
  const startScaleY = 0.9,
    endScaleY = Math.max(1, (fromY - portraitTop - 30) / soulSize.width);
  await column.animate(
    [
      {
        transform: translateUnits(
          fromX,
          fromY + 20,
          ` scale(1.1,${startScaleY})`,
        ),
        opacity: 1,
      },
      {
        transform: translateUnits(
          fromX,
          fromY - 10,
          ` scale(1.2,${endScaleY})`,
        ),
        opacity: 1,
      },
    ],
    { duration: effectTiming.soulRiseMs, fill: "forwards", easing: "ease-in" },
  ).finished;
  column.remove();
  // 分成數團，飄到目標
  const startY = portraitTop + 40;
  await Promise.all(
    targets.map((target) => {
      const puff = createImageElement(layer, {
        left: designUnit(-soulSize.width * 0.25),
        top: designUnit(-soulSize.height * 0.4),
        width: designUnit(soulSize.width * 0.5),
        height: designUnit(soulSize.height * 0.8),
        background: soulBackground,
        filter: SOUL_TINT,
      });
      return puff
        .animate(
          [
            {
              transform: translateUnits(fromX, startY, " scale(1)"),
              opacity: 1,
            },
            {
              transform: translateUnits(
                (fromX + target.x) / 2,
                (startY + target.y) / 2,
                " scale(.9)",
              ),
              opacity: 1,
              offset: 0.5,
            },
            {
              transform: translateUnits(target.x, target.y, " scale(.7)"),
              opacity: 0,
            },
          ],
          { duration: effectTiming.soulSpreadMs, fill: "forwards" },
        )
        .finished.then(() => puff.remove());
    }),
  );
}

/**
 * 小兵（背面），依武將的兵種：劍兵、槍兵、騎兵、蠻兵衝到敵人面前攻擊；弓兵、神算、鬼謀是遠程。素材：遊戲素材/UI等/戰鬥效果/attack<勢力><兵種>.png
 * （256×512 圖集，零件座標由 _開發工具_不需修改/素材轉檔/slice-atlas.py 切出）。勢力 0 魏、1 吳、2 蜀、3 漢、4 群。
 * 兵種與圖集編號、各動作用的零件見 data/troops.json：frames＝[零件, 角度]，圖集為了塞滿而轉 90° 存放的零件，顯示時轉回直立。
 */
const TROOP_ATLASES = import.meta.glob<{ parts: AtlasPartRect[] }>(
  "/src/data/atlas/attack*.json",
  { eager: true, import: "default" },
);
/** 圖集檔名中的勢力編號 */
const FACTION_INDEX: Record<Faction, number> = {
  wei: 0,
  wu: 1,
  shu: 2,
  han: 3,
  qun: 4,
};

/** 小兵的動作：run＝跑步／頭上跳動（兩張交替），attack＝攻擊（依序播放） */
export type TroopAnimation = "run" | "attack";

/** 小兵某個動作的零件；rotation＝顯示時要轉幾度才直立（圖集為了塞滿而轉 90° 存放） */
export function getTroopFrames(
  faction: Faction,
  troop: TroopType,
  animation: TroopAnimation = "run",
): {
  assetId: string;
  frames: Array<{ part: AtlasPartRect; rotation: number }>;
} {
  const name = `attack${FACTION_INDEX[faction]}${troopData.atlasIndex[troop]}`;
  const parts = TROOP_ATLASES[`/src/data/atlas/${name}.json`]!.parts;
  return {
    assetId: `UI等/戰鬥效果/${name}`,
    frames: troopData.frames[faction][troop][animation].map(
      ([index, rotation]) => ({ part: parts[index!]!, rotation: rotation! }),
    ),
  };
}

/** 遠程兵種（弓兵、神算、鬼謀）：不衝到敵人面前 */
export const isRangedTroop = (troop: TroopType) =>
  (troopData.ranged as string[]).includes(troop);

/** 某個動作有幾張 */
export const troopFrameCount = (
  faction: Faction,
  troop: TroopType,
  animation: TroopAnimation,
) => troopData.frames[faction][troop][animation].length;

/** 把小兵畫在 element（腳底中心為原點，一律直立），frameIndex 為該動作的第幾張 */
export function paintTroopSprite(
  element: HTMLElement,
  faction: Faction,
  troop: TroopType,
  frameIndex: number,
  scale = 0.8,
  animation: TroopAnimation = "run",
) {
  const { assetId, frames } = getTroopFrames(faction, troop, animation),
    { part, rotation } = frames[frameIndex % frames.length]!,
    atlas = getAssetSize(assetId);
  const w = part.w * scale,
    h = part.h * scale,
    /** 直立後的高度：轉 90° 存放的零件，寬高互換 */
    uprightHeight = rotation ? w : h;
  Object.assign(element.style, {
    // 元素中心放在直立圖的中心（腳底中心往上半個高度），再繞中心轉回直立
    left: designUnit(-w / 2),
    top: designUnit(-uprightHeight / 2 - h / 2),
    width: designUnit(w),
    height: designUnit(h),
    transform: rotation ? `rotate(${rotation}deg)` : "",
    backgroundImage: `url(${getAssetUrl(assetId)})`,
    // 圖集大小依原圖（attack 圖集有 256×512 也有 256×256，寫死會把小兵切掉或錯位）
    backgroundSize: `${designUnit(atlas.width * scale)} ${designUnit(atlas.height * scale)}`,
    backgroundPosition: `${designUnit(-part.x * scale)} ${designUnit(-part.y * scale)}`,
    backgroundRepeat: "no-repeat",
  });
}

/**
 * 戰鬥背景（<Scenery>）：天空（bg_board_000000）＋透視地面（paintGround；前往下一個合戰時 playAdvance 讓路面往前推進）。
 * 天空與地面依螢幕高度延伸：地平線固定在頭像上方 200（v5 205/405），天空往上拉長。
 * <Scenery y> 的 y＝整片背景往下移多少（0＝原版位置）。
 * 地面一路畫到版面底部：盤面底下也是土路（v5 110 433、150 508 的盤面空隙看得到土路）。
 */
/** bg_board_000000：天空在上 41%（512 中的 210） */
const SKY_SHARE = 0.41;

export class BattleBackground {
  readonly element: HTMLDivElement;
  private sky: HTMLElement;
  private groundClip: HTMLElement;
  /** 地面畫好時 resolve（地面是在 canvas 上逐列繪製，需要一點時間） */
  readonly ready: Promise<void>;

  constructor(
    parent: HTMLElement,
    private offsetY = 0,
  ) {
    this.element = document.createElement("div");
    this.element.className = "battle-background";
    this.element.innerHTML =
      '<i class="battle-sky"></i><div class="battle-ground-clip"><i class="battle-ground"></i></div>';
    parent.appendChild(this.element);
    this.sky = this.element.querySelector<HTMLElement>(".battle-sky")!;
    this.groundClip = this.element.querySelector<HTMLElement>(
      ".battle-ground-clip",
    )!;
    this.sky.style.backgroundImage = `url(${getAssetUrl(BATTLE_ASSETS.sky)})`;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${designUnit(640)};height:${designUnit(BATTLE_LAYOUT_HEIGHT - GROUND_TOP)}`;
    this.element.querySelector(".battle-ground")!.appendChild(canvas);
    const painting = loadGroundPainter(
      canvas,
      getAssetUrl(BATTLE_ASSETS.ground),
      BATTLE_LAYOUT_HEIGHT,
    );
    this.ready = painting.then((paint) => {
      this.paintGround = paint;
      paint(0);
    });
  }

  /** 畫地面（scroll＝貼圖往前推進了幾列；圖還沒載入時什麼都不做） */
  private paintGround: (scroll: number) => void = () => {};
  private groundScroll = 0;

  /**
   * 部隊往前走：路面的紋理往畫面下方（往自己）移動 durationMs（v5 166 000～172 300：前往下一個合戰時路面一直往前推進）。
   * 速度：前 ADVANCE_RAMP 加速、中間等速、最後 ADVANCE_RAMP 減速（加減速段是平滑曲線，速度不會突然跳）；
   * 進度依每禎的畫面更新時間（requestAnimationFrame 的時間戳）計算，每禎的移動量一致，不受程式執行時間抖動影響。
   */
  async playAdvance(durationMs: number) {
    const from = this.groundScroll,
      distance = (ADVANCE_ROWS_PER_SECOND * durationMs) / 1000;
    let startedAt: number | undefined;
    for (;;) {
      const now = await nextFrame();
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / durationMs);
      this.groundScroll = from + distance * cruiseEase(progress, ADVANCE_RAMP);
      this.paintGround(this.groundScroll);
      if (progress >= 1) break;
    }
  }

  /** 依目前舞台高度重新排版（螢幕尺寸改變時呼叫） */
  layout() {
    const extraTop = currentStage.height - BATTLE_LAYOUT_HEIGHT,
      horizonY = extraTop + GROUND_TOP + this.offsetY;
    const skyHeight = Math.max(640, (horizonY + 30) / SKY_SHARE);
    Object.assign(this.sky.style, {
      top: designUnit(horizonY + 30 - skyHeight * SKY_SHARE - 30),
      height: designUnit(skyHeight),
    });
    Object.assign(this.groundClip.style, {
      top: designUnit(horizonY),
      height: designUnit(extraTop + BATTLE_LAYOUT_HEIGHT - horizonY),
    });
  }
}

/**
 * 戰鬥地面：把 ground_000000（左半土路、右半草地）貼成有透視的地面。
 * 路寬曲線取自 v5 150 508 ms 的實測（遊戲區 360 寬 → ×1.778 設計單位）：
 *   地平線（y205）幾乎一點，到 y242 已寬 252，y284 寬 453，y405 起滿版。路中心 x320。
 * 每一列：土路圖 0～500 拉成該列路寬，草地圖 524～880 左右鏡射重複填滿兩側；
 * 貼圖縱向以「每列取 500/路寬 列」累加，讓近處的紋理不會被拉得過長。
 */
/** 地平線（設計單位 y，以底部 999 版面為準） */
export const GROUND_TOP = 205;
/** [y, 路寬] 實測點 */
const ROAD_WIDTH_SAMPLES: [number, number][] = [
  [205, 0],
  [213, 53],
  [242, 252],
  [256, 338],
  [270, 398],
  [284, 453],
  [313, 507],
  [341, 533],
  [370, 587],
  [405, 640],
  [540, 760],
];

function roadWidth(y: number) {
  for (let i = 1; i < ROAD_WIDTH_SAMPLES.length; i++) {
    const [y1, w1] = ROAD_WIDTH_SAMPLES[i]!,
      [y0, w0] = ROAD_WIDTH_SAMPLES[i - 1]!;
    if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
  }
  return 760;
}

/** 前進時路面紋理每秒推進幾列（貼圖的列；平均速度） */
const ADVANCE_ROWS_PER_SECOND = 260;
/** 前進的加速、減速各佔全程多少（其餘等速） */
const ADVANCE_RAMP = 0.3;

/**
 * 「加速 → 等速 → 減速」的進度曲線（0～1 → 0～1）。
 * 速度在加速段由 0 平滑升到最高（smoothstep 形狀，加速度也連續），減速段對稱，中間等速。
 */
export function cruiseEase(progress: number, ramp: number) {
  const t = Math.min(1, Math.max(0, progress));
  if (ramp <= 0) return t;
  // 速度曲線下的面積＝1 → 最高速度
  const peak = 1 / (1 - ramp);
  /** smoothstep 速度在 [0, x] 的積分（x 以加速段長度為 1） */
  const rampArea = (x: number) => x * x * x - (x * x * x * x) / 2;
  if (t < ramp) return peak * ramp * rampArea(t / ramp);
  if (t > 1 - ramp) return 1 - peak * ramp * rampArea((1 - t) / ramp);
  return peak * ramp * 0.5 + peak * (t - ramp);
}

/**
 * 載入地面圖，回傳「把地面畫到 canvas」的函式（寬 640、高 bottomY − GROUND_TOP，每設計單位一像素）。
 * paint(scroll)：scroll＝紋理往前推進了幾列（0＝原位；越大，路面越往畫面下方移動，看起來像往前走）。
 * 圖載入失敗時回傳什麼都不做的函式。
 *
 * 畫法：有 WebGL2 時由 GPU 著色器畫（createGroundGl）；否則先把土路、左右草地（已鏡射重複好的長條）各做成一張圖，每一列只要 3 次 drawImage。
 * 取樣位置用小數（不取整數列），推進時紋理連續移動、不會一格一格跳；圖底下多接一段開頭，縱向循環時不會斷。
 */
/** 每一列的路寬（縮放＝路寬/500）與貼圖起點列；GPU 與 2D 畫法共用 */
function groundRows(height: number) {
  const rows: GroundRow[] = [];
  let sourceY = 0;
  for (let row = 0; row < height; row++) {
    const width = Math.max(roadWidth(GROUND_TOP + row + 0.5), 24),
      scale = width / 500;
    sourceY += 1 / scale;
    rows.push({ width, scale, sourceY });
  }
  return rows;
}

/**
 * GPU 畫地面：片段著色器依每個像素所在的列，查「路寬、貼圖列」表（1 欄高 height 的浮點貼圖），
 * 算出土路／草地（路緣往外原圖、鏡射交替）的貼圖座標；地平線霧化也在這裡加上。不支援 WebGL2 時回傳 null。
 */
function createGroundGl(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  height: number,
  density: number,
): ((scroll: number) => void) | null {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) return null;
  const vertexSource = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
  const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D ground;
uniform sampler2D rows;
uniform float scroll;
uniform float canvasHeight;
uniform float density;
out vec4 color;
void main() {
  // 換回設計單位（canvas 是 density 倍解析度）
  float x = gl_FragCoord.x / density;
  float row = (canvasHeight - gl_FragCoord.y) / density;
  // 路寬、貼圖列在相鄰兩列之間線性內插（表格每列的值在列中央）
  float at = clamp(row - 0.5, 0.0, float(textureSize(rows, 0).y - 1));
  int i0 = int(floor(at));
  int i1 = min(i0 + 1, textureSize(rows, 0).y - 1);
  vec4 info = mix(texelFetch(rows, ivec2(0, i0), 0), texelFetch(rows, ivec2(0, i1), 0), fract(at));
  float width = info.r, sourceY = info.g;
  float scale = width / 500.0;
  float roadLeft = 320.0 - width * 0.5, roadRight = roadLeft + width;
  float v = (sourceY - scroll) / 1024.0;
  // 土路與草地都取樣，在路緣用約 1 個實際像素的寬度混合（路緣不會鋸齒）；
  // 縱向座標不取 fract（貼圖本身縱向循環），取樣座標連續，mipmap 不會在循環接縫出現一條線
  float roadU = clamp((x - roadLeft) / scale, 0.5, 499.5) / 1024.0;
  float d = max(max(x - roadRight, roadLeft - x), 0.0) / scale;
  float tile = floor(d / 356.0);
  float local = mod(d, 356.0);
  if (mod(tile, 2.0) == 1.0) local = 356.0 - local;
  float grassU = (524.0 + local) / 1024.0;
  vec3 road = texture(ground, vec2(roadU, v)).rgb;
  vec3 grass = texture(ground, vec2(grassU, v)).rgb;
  float inside = min(x - roadLeft, roadRight - x) * density;
  vec4 c = vec4(mix(grass, road, clamp(inside + 0.5, 0.0, 1.0)), 1.0);
  float fog = 0.7 * clamp(1.0 - row / 70.0, 0.0, 1.0);
  color = vec4(mix(c.rgb, vec3(150.0, 185.0, 215.0) / 255.0, fog), 1.0);
}`;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource),
    fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  // 全畫面兩個三角形
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  // 地面圖：縱向循環、遠處用縮小圖（mipmap）避免閃爍
  const groundTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, groundTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  // 斜看的遠處用非等向過濾：比單純 mipmap 清楚，推進時遠處紋理也不會閃
  const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropic)
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(
        8,
        gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number,
      ),
    );
  // 每列的路寬、貼圖列
  const rows = groundRows(height);
  const table = new Float32Array(height * 4);
  rows.forEach((row, i) => {
    table[i * 4] = row.width;
    table[i * 4 + 1] = row.sourceY;
  });
  const rowTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, rowTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    1,
    height,
    0,
    gl.RGBA,
    gl.FLOAT,
    table,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(gl.getUniformLocation(program, "ground"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "rows"), 1);
  gl.uniform1f(gl.getUniformLocation(program, "canvasHeight"), canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, "density"), density);
  const scrollLocation = gl.getUniformLocation(program, "scroll");
  gl.viewport(0, 0, canvas.width, canvas.height);
  return (scroll) => {
    // 貼圖縱向 1024 列循環：只傳餘數，推進很久之後浮點數也不會失去精度
    gl.uniform1f(scrollLocation, ((scroll % 1024) + 1024) % 1024);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}

/** 草地長條的寬（手機的 canvas 寬度上限內） */
const GRASS_STRIP_WIDTH = 4096;
/** 圖底下多接的列數（循環用） */
const WRAP_ROWS = 128;

export function loadGroundPainter(
  canvas: HTMLCanvasElement,
  groundImageUrl: string,
  bottomY: number,
): Promise<(scroll: number) => void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(() => {});
    image.onload = () => {
      const height = bottomY - GROUND_TOP;
      // 先用 GPU（WebGL2）畫：每禎只是一次全畫面著色，手機也順；不支援時才用 2D 逐列畫。
      // GPU 版用螢幕實際像素（設計單位 × 縮放 × 裝置像素比）畫，路面推進時紋理在每個實際像素上連續移動，不會因放大而顆粒、閃爍
      const density = Math.min(
        2,
        Math.max(1, currentStage.unitPx * (window.devicePixelRatio || 1)),
      );
      canvas.width = Math.round(640 * density);
      canvas.height = Math.round(height * density);
      const gl = createGroundGl(canvas, image, height, density);
      if (gl) {
        resolve(gl);
        return;
      }
      canvas.width = 640;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      const textureHeight = image.height;
      /** 建一張圖：draw(ctx, y) 在 y 畫一份，底下再接一份開頭 */
      const makeStrip = (
        width: number,
        draw: (strip: CanvasRenderingContext2D, y: number) => void,
      ) => {
        const strip = document.createElement("canvas");
        strip.width = width;
        strip.height = textureHeight + WRAP_ROWS;
        const stripContext = strip.getContext("2d")!;
        draw(stripContext, 0);
        draw(stripContext, textureHeight);
        return strip;
      };
      // 土路：貼圖 x 0～500
      const road = makeStrip(500, (strip, y) =>
        strip.drawImage(
          image,
          0,
          0,
          500,
          textureHeight,
          0,
          y,
          500,
          textureHeight,
        ),
      );
      // 草地：貼圖 x 524～880，從路緣往外「原圖、鏡射、原圖…」重複；左邊是右邊的左右翻轉
      const drawGrassRow = (
        strip: CanvasRenderingContext2D,
        y: number,
        flip: boolean,
      ) => {
        for (let tile = 0; tile * 356 < GRASS_STRIP_WIDTH; tile++) {
          const mirrored = (tile % 2 === 1) !== flip;
          const x = flip ? GRASS_STRIP_WIDTH - (tile + 1) * 356 : tile * 356;
          strip.save();
          strip.translate(mirrored ? x + 356 : x, 0);
          if (mirrored) strip.scale(-1, 1);
          strip.drawImage(
            image,
            524,
            0,
            356,
            textureHeight,
            0,
            y,
            356,
            textureHeight,
          );
          strip.restore();
        }
      };
      const grassRight = makeStrip(GRASS_STRIP_WIDTH, (strip, y) =>
        drawGrassRow(strip, y, false),
      );
      const grassLeft = makeStrip(GRASS_STRIP_WIDTH, (strip, y) =>
        drawGrassRow(strip, y, true),
      );
      // 每一列的路寬、縮放、貼圖位置（不隨推進改變，只算一次）
      const rows = groundRows(height);
      resolve((scroll) =>
        paintGround(
          context,
          rows,
          { road, grassLeft, grassRight },
          textureHeight,
          height,
          scroll,
        ),
      );
    };
    image.src = groundImageUrl;
  });
}

interface GroundRow {
  width: number;
  scale: number;
  sourceY: number;
}

function paintGround(
  context: CanvasRenderingContext2D,
  rows: GroundRow[],
  strips: {
    road: HTMLCanvasElement;
    grassLeft: HTMLCanvasElement;
    grassRight: HTMLCanvasElement;
  },
  textureHeight: number,
  height: number,
  scroll: number,
) {
  // 每次整片重畫（霧化是半透明疊上去的，不清掉會越疊越濃）
  context.clearRect(0, 0, 640, height);
  const roadCenterX = 320;
  for (let row = 0; row < height; row++) {
    const { width, scale, sourceY } = rows[row]!;
    const roadLeft = roadCenterX - width / 2,
      roadRight = roadLeft + width;
    /** 這一列取的貼圖 y（小數）與高度（一列螢幕＝1/scale 列貼圖） */
    const sy =
        (((sourceY - scroll) % textureHeight) + textureHeight) % textureHeight,
      sh = Math.min(1 / scale, WRAP_ROWS);
    context.drawImage(strips.road, 0, sy, 500, sh, roadLeft, row, width, 1);
    // 草地：需要的貼圖寬＝螢幕寬 ÷ 縮放（超過長條寬時以長條寬為限，遠處本來就被霧蓋住）
    const rightWidth = 640 - roadRight,
      leftWidth = roadLeft;
    const rightSource = Math.min(rightWidth / scale, GRASS_STRIP_WIDTH),
      leftSource = Math.min(leftWidth / scale, GRASS_STRIP_WIDTH);
    if (rightWidth > 0)
      context.drawImage(
        strips.grassRight,
        0,
        sy,
        rightSource,
        sh,
        roadRight,
        row,
        rightSource * scale,
        1,
      );
    if (leftWidth > 0)
      context.drawImage(
        strips.grassLeft,
        GRASS_STRIP_WIDTH - leftSource,
        sy,
        leftSource,
        sh,
        roadLeft - leftSource * scale,
        row,
        leftSource * scale,
        1,
      );
  }
  // 地平線霧化
  const fog = context.createLinearGradient(0, 0, 0, 70);
  fog.addColorStop(0, "rgba(150,185,215,.7)");
  fog.addColorStop(1, "rgba(150,185,215,0)");
  context.fillStyle = fog;
  context.fillRect(0, 0, 640, 70);
}
