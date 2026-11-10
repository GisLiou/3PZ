/**
 * begin：開始遊戲（一個帳號理論上只會經過一次）。
 *   帳號（註冊／登入／遊客）→ 輸入名字 → 語音下載詢問 → 選擇初始武將
 *   accountService   帳號服務（本機帳號；日後可接雲端）
 *   voicePackService、VoicePackScene  語音包下載服務與詢問畫面
 *   AccountScene、PlayerNameScene、StarterSelectScene  各畫面
 *   FormWindow   共用的表單視窗、輸入框外觀
 *   components/（.tsx 畫面）、logic/（.ts 服務）；演出時間寫在各畫面檔內
 */
export {
  accountService,
  AccountError,
  MIN_PASSWORD_LENGTH,
  type Account,
  type AccountProvider,
} from "./logic/accountService";
export {
  voicePackService,
  type VoiceIndex,
  type VoicePackState,
} from "./logic/voicePackService";
export { VoicePackScene } from "./components/VoicePackScene";
export { AccountScene } from "./components/AccountScene";
export { PlayerNameScene } from "./components/PlayerNameScene";
export { StarterSelectScene } from "./components/StarterSelectScene";
