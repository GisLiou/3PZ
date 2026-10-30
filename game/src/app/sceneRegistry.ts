/**
 * 場景登記表：場景 id → 元件。sceneRouter.push('id') 就會顯示對應場景。
 * 場景 id 也用在網址 #scene=<id>（開發版直接跳到該場景）。
 */
import {
  AccountScene,
  NoticeScene,
  PlayerNameScene,
  TitleScene,
} from "@modules/opening";
import {
  StarterSelectScene,
  StoryScene,
  TutorialBattleScene
} from "@modules/tutorial";
import { VoicePackScene } from "@modules/voicePack";
import type { ComponentType } from "react";
import { BootScene } from "./BootScene";
import { PlaceholderScene } from "./PlaceholderScene";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENE_COMPONENTS: Record<string, ComponentType<any>> = {
  boot: BootScene,
  notice: NoticeScene,
  title: TitleScene,
  account: AccountScene,
  name: PlayerNameScene,
  voice: VoicePackScene,
  starter: StarterSelectScene,
  story: StoryScene,
  tutorialBattle: TutorialBattleScene,
  tutorialReward: () => PlaceholderScene({ title: "過關報酬" }),
};

/** 使用整個螢幕高度的場景（其餘場景放在置中的 1136 高版面內） */
export const FULL_HEIGHT_SCENES = new Set(["tutorialBattle"]);
