/**
 * 戰鬥演出時間（毫秒）。逐禎紀錄見 docs/復刻分析/03_戰鬥演出.md。
 * 主要依據 v1（修復展示 720P，30 fps，每禎 33.3 ms，畫質最清楚）；v5＝亞修實況（18.69 fps）。
 */

/** 拖曳、消除、補位 */
export const matchTiming = {
  /** 拿起小兵：手上的小兵在 holdA / holdB 兩張之間交替 */
  pickUpFrameMs: 107,
  /** 拿起時小兵相對手指的位移（設計單位；v1 114 667：往右 15、往上 54） */
  pickUpOffset: { x: 15, y: -54 },
  /** 被換位的小兵走到隔壁格（v1 114 933 → 115 067，4 禎） */
  swapMoveMs: 133,
  /** 放開到第一組消除（v5 148 422 放開 → 148 689 變白） */
  releaseToFirstClearMs: 267,

  // ---- 一組消除（t＝變白那一禎，v1 118 900） ----
  /** 純白剪影（v1 118 900～118 967，3 禎） */
  clearWhiteMs: 67,
  /** 白剪影帶粉紅光、忽大忽小（118 967～119 100，4 禎） */
  clearGlowMs: 166,
  /** 格子空出後，魂柱從該組中心往上升到武將列（119 133～119 233，3 禎） */
  soulRiseMs: 100,
  /** 魂柱分成每位同勢力武將一團，往上飄到武將頭上後消失（119 233～119 400，5 禎） */
  soulSpreadMs: 167,
  /** 數字在武將頭像上出現（119 433），隨即往上移到頭像上方（119 467） */
  damageNumberAppearMs: 533,
  damageNumberLiftMs: 34,
  /** 每組間隔（118 900 → 119 433） */
  groupIntervalMs: 533,
  /** 數字從舊值數到新值（119 433 → 119 900 停住） */
  damageCountUpMs: 467,
  /** 數完落回頭像，頭上出現該勢力小兵（119 900） */
  damageSettleMs: 67,
  /** 第 N 組（N≥2）的「N連擊」字在變白後一禎出現 */
  comboLabelDelayMs: 33,
  comboLabelColorMs: 160,
  /** 最後一組消除後到補位開始 */
  lastClearToRefillMs: 233,
  /** 往上補位：新小兵從盤面下方走上來（v1 120 600 → 120 900） */
  refillMs: 300,
  refillToCascadeMs: 34,
  /** 走路動畫每張停留（v5 22 151～24 398） */
  walkFrameMs: 107,
} as const;

/** 結算與攻擊（v1 121 900～125 800）、敵人攻擊、勝利 */
export const attackTiming = {
  /** 連擊倍率：小兵在頭像上方跳動、數字上數（121 900 → 123 400） */
  comboMultiplierCountMs: 1500,
  /** 跳動週期：一上一下 267 ms；亮度閃一次 533 ms（121 900、122 433、122 967） */
  tokenHopMs: 267,
  tokenFlashMs: 533,
  /** 軍略（v5 158 534） */
  leaderSkillCountMs: 600,
  leaderSkillHoldMs: 700,
  /** 數字落到頭像上（123 400 → 123 467） */
  damageNumberDropMs: 67,
  /** 小兵走向敵人（123 533 → 124 200 第一隻命中），命中依序錯開約 200 ms（124 200、124 400、124 733） */
  marchMs: 667,
  marchStaggerMs: 200,
  /** 命中爆光（attackeffect2，124 200～124 400） */
  hitEffectMs: 267,
  /** 敵人頭上傷害數字隨 HP 條下降往下數（124 400 → 125 133） */
  enemyHpDrainMs: 700,
  /** 敵人死亡：變暗、爆開（125 333～125 600） */
  enemyDeathFadeMs: 300,
  afterAttackMs: 300,
  enemyStrikeMs: 300,
  /** 「合戰 n/m」顯示時間（v5 108 721 → 110 433） */
  waveBannerMs: 1712,
  /** 命中：小兵變白 67 ms 後淡出共 267 ms；敵人紅色受擊 167 ms */
  hitWhiteMs: 67,
  /** 命中前一禎全黑（v1 124 167、v5 159 711） */
  hitBlackMs: 33,
  /** 軍略訊息帶在小兵出發後留多久（v5 158 800 出發、159 390 消失） */
  leaderSkillBandAfterMarchMs: 540,
  troopFadeMs: 267,
  enemyHitTintMs: 167,
  /** 死亡：全黑剪影 133 ms → 爆光＋煙霧 400 ms */
  enemyDeathBlackMs: 133,
  enemyDeathSmokeMs: 400,
  /** 敵人攻擊（v5 178 705～180 000，53 ms 一禎）：紅／正常閃爍每格 53 ms；全畫面泛紅 ~500 ms；血花每 53 ms 一個 */
  enemyStrikeBlinkMs: 53,
  enemyStrikeRedFlashMs: 800,
  bloodSplashMs: 267,
  splashToDamageNumberMs: 160,
  enemyStrikeCountMs: 430,
  enemyStrikeHoldMs: 600,
  /** 「勝利！」每個字縮放出現的時間與間隔 */
  victoryCharMs: 160,
  victoryCharGapMs: 110,
} as const;
