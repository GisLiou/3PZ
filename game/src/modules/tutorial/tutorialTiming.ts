/** 教學演出時間（毫秒），來源 v5 亞修實況（每禎 53.5 ms），逐禎紀錄見 docs/復刻分析/02_教學戰鬥1.md */
export const tutorialTiming = {
  /** 對話視窗出現（一禎內完成） */
  dialogFadeInMs: 54,
  /** 手沿路徑移動一輪（v5 145 746 → 147 352 回到起點） */
  guideHandCycleMs: 1606,
  /** 一輪中手在移動的比例（其餘時間停在終點） */
  guideHandMoveShare: 0.8,
  /** 故事畫面：門打開白光（v5 104 441 → 105 297） */
  doorOpenMs: 856,
  /** 白畫面停留到戰鬥畫面（v5 105 297 → 108 721） */
  whiteHoldMs: 600,
  /** 戰鬥開場：小兵由下方走上盤面（v5 108 721 → 109 845） */
  boardIntroMs: 1124,
  /** 選擇武將：內容由暗變亮（v5 60 621 → 60 835） */
  starterContentFadeMs: 214,
  /** 選擇武將：換頁橫向滑動（v5 64 526 → 64 954） */
  starterPageSlideMs: 428,
  /** 選擇武將：左右箭頭來回晃動一輪（暫定值，待對照 v5 60 621 ms 之後的錄影） */
  starterArrowSwayMs: 800,
  /** 故事畫面淡入 */
  storyFadeInMs: 430,
  /** 故事畫面「合戰開始」鈕亮度呼吸週期（89 888 → 91 172 → 92 456） */
  storyButtonPulseMs: 1284,
  /** 故事畫面：按下後文字與按鈕淡出（自訂；原版沒有開門動畫） */
  storyTextFadeOutMs: 160,
  /** 故事畫面：中縫光芒出現（自訂；使用原版 door_flash 素材） */
  doorSparkleMs: 214,
  /** 故事畫面：門推開後整面變白（自訂） */
  doorWhiteFadeMs: 300,
} as const;
