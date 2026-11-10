/**
 * 場景登記表：場景 id → 元件。sceneRouter.push('id') 就會顯示對應場景。
 * 場景 id 也用在網址 #scene=<id>（開發版直接跳到該場景）。
 */
import { BootScene, NoticeScene, TitleScene } from "@modules/starter";
import {
  AccountScene,
  PlayerNameScene,
  StarterSelectScene,
  VoicePackScene,
} from "@modules/begin";
import { BattleScene, StoryScene } from "@modules/battle";
import type { ComponentType } from "react";
import { PlaceholderScene } from "../components/PlaceholderScene";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENE_COMPONENTS: Record<string, ComponentType<any>> = {
  // starter：啟動
  boot: BootScene,
  notice: NoticeScene,
  title: TitleScene,
  // begin：開始遊戲（每個帳號一次）
  account: AccountScene,
  name: PlayerNameScene,
  voice: VoicePackScene,
  starter: StarterSelectScene,
  // battle：戰鬥
  story: StoryScene,
  // 戰鬥：參數 { stage: 關卡檔名 }（data/stages/<關卡>.json）；開發版網址 #scene=battle&stage=test
  battle: BattleScene,
  tutorialReward: () => PlaceholderScene({ title: "過關報酬" }),
};

/** 使用整個螢幕高度的場景（其餘場景放在置中的 1136 高版面內） */
export const FULL_HEIGHT_SCENES = new Set(["battle"]);
