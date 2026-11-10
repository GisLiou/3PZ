/**
 * battle：戰鬥。
 * components/（.tsx 畫面與元件）
 *   BattleScene.tsx           戰鬥場景：讀取關卡 JSON（data/stages/*.json），一般戰鬥流程；有 script 時交給 TutorialMask
 *   StandardBattleLayout.tsx  戰鬥畫面的組合（元件標籤＋x、y；標籤順序＝圖層）←要調位置改這裡
 *   BattleCanvas.tsx          畫布與全部元件標籤（盤面、敵人、背景、效果層、小兵層、頭像、HP 條、寶箱、相剋圖、Menu、合戰大字）
 *   TutorialMask.tsx          新手教學：遮罩（玲玲對話、高亮、路徑指引、只允許照路徑轉珠）＋教學步驟執行器
 *   StoryScene.tsx            關卡開場（故事畫面＋開門）
 * logic/（.ts 程式）
 *   BattleScreen.ts           依標籤建立零件；一回合的流程與各階段演出
 *   units.ts                  敵人讀取器（關卡 units＋人數 → 站位、星數 → 大小）、我方部隊
 *   effects.ts                特效（魂、命中、大字、轉場、衝鋒小兵圖）、背景
 *   boardRules.ts  BoardView.ts    盤面規則、盤面畫面
 *   battleAssets.ts           素材 id、圖集零件、DOM 小工具、資料型別
 * styles/battle.css           戰鬥樣式
 * 演出時間（毫秒）寫在使用它的檔案裡：boardTiming、effectTiming、unitTiming、turnTiming、StoryScene 的 storyTiming
 */
export { StoryScene } from "./components/StoryScene";
export { BattleScene } from "./components/BattleScene";
