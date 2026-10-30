/**
 * 開場流程的時間（毫秒）。來源：參考資料/亞修實況（18.69 fps，每禎約 53.5 ms），
 * 逐禎紀錄見 docs/復刻分析/01_開場流程.md。錄影本身的精度就是一禎（約 53 ms）。
 */
export const openingTiming = {
  /** 「注意」畫面停留：9631 → 13323 ms（之後硬切到只有 Group / ID / Version 的黑畫面） */
  noticeHoldMs: 3692,
  /** 標題淡入：13376 → 13858 ms（約 9 禎） */
  titleFadeInMs: 482,
  /** 點擊後標題淡出：21402 → 21509 ms */
  titleFadeOutMs: 107,
  /** 淡出後黑畫面（版本字樣仍在）：21509 → 21562 ms，之後版本字樣消失 */
  blackWithVersionMs: 53,
  /** 黑畫面到「連線中」視窗出現：21616 → 22097 ms */
  blackBeforeConnectingMs: 481,
  /** 「連線中」視窗由小放大：22097 → 22151 ms */
  connectingPopInMs: 54,
  /** 「連線中」視窗出現後停留多久才進入下一個畫面（錄影中為實際連線時間，這裡固定） */
  connectingHoldMs: 900,
} as const;
