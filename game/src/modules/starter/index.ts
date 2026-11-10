/**
 * starter：啟動（每次開遊戲都會經過）。
 *   BootScene（讀取中：素材清單、恢復帳號、預載）→ NoticeScene（注意，2 秒或點擊）→ TitleScene（標題，點擊進入）
 *   ConnectingDialog  連線中視窗（目前沒有連線，日後使用）
 * 逐禎紀錄見 docs/復刻分析/01_開場流程.md
 */
export { BootScene } from "./BootScene";
export { NoticeScene } from "./NoticeScene";
export { TitleScene } from "./TitleScene";
export { ConnectingDialog } from "./ConnectingDialog";
