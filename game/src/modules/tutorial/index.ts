/**
 * 新手教學模組的公開入口（場景元件給 app/sceneRegistry.ts 登記）。
 *   starterSelection/  選擇武將（主角三選一）
 *   story/             故事
 *   battle1/           教學戰鬥 1（資料、對話、腳本、場景）
 *   guide/             教學演出：玲玲對話、變暗遮罩、拖曳路徑指引
 */
export { StarterSelectScene } from './starterSelection/StarterSelectScene';
export { StoryScene } from './story/StoryScene';
export { TutorialBattleScene } from './battle1/TutorialBattleScene';
