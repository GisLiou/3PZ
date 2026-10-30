/**
 * 開場流程模組（復刻 參考資料/亞修實況 0～60 秒）：
 *   注意 → 標題（TOUCH TO START）→ 連線中 → [帳號登入／註冊（新增功能）] → 輸入名字 → 選擇武將
 *   scenes/      各畫面
 *   components/  開場共用的視窗、連線中、版本字樣
 * 時間常數見 ./openingTiming.ts，逐禎紀錄見 docs/復刻分析/01_開場流程.md
 */
export { NoticeScene } from './scenes/NoticeScene';
export { TitleScene } from './scenes/TitleScene';
export { AccountScene } from './scenes/AccountScene';
export { PlayerNameScene } from './scenes/PlayerNameScene';
export { ConnectingDialog } from './components/ConnectingDialog';
