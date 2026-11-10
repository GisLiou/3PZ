/**
 * 啟動：讀素材清單 → 恢復帳號 → 預載開場要用的圖 → 注意畫面。
 * 原版此處是系統讀取轉圈（3210～6421 ms），不屬於遊戲素材，這裡只顯示黑畫面。
 */
import { useEffect, useState } from "react";
import { loadAssetManifest, preloadAssets } from "@core/assetLoader";
import { sceneRouter } from "@core/sceneRouter";
import { saveStore } from "@core/saveStore";
import { migrateLegacyStorageKeys } from "@core/saveStore";
import { accountService, voicePackService } from "@modules/begin";
import { uiAsset } from "@ui";
import pieces from "@data/pieces.json";

const BOOT_PRELOAD_ASSETS = [
  "title",
  "title_touch",
  "title_touch_bg",
  "info_window",
  "background001",
  "caption_02",
  "dialog_line",
  "button_mini",
  "button_mini_dark",
  "button_mini_2",
  "button_mini_2_dark",
]
  .map(uiAsset)
  .concat([pieces.atlas]);

/** 開發用（開發伺服器與 develop 版）：網址 #scene=<場景 id> 直接跳到該場景（使用 debug 存檔） */
const isDebugBuild = import.meta.env.DEV || !!import.meta.env.VITE_DEBUG;

export function BootScene() {
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(() => {
    (async () => {
      migrateLegacyStorageKeys();
      await loadAssetManifest();
      accountService.restoreSession();
      await preloadAssets(BOOT_PRELOAD_ASSETS);
      void voicePackService.refresh().catch(() => {});
      const debugSceneId = /scene=(\w+)/.exec(location.hash)?.[1];
      if (debugSceneId && isDebugBuild) {
        saveStore.load("debug");
        // 戰鬥場景可加 &stage=<關卡檔名>（例：#scene=battle&stage=test）
        const stage = /stage=(\w+)/.exec(location.hash)?.[1];
        sceneRouter.replace(debugSceneId, stage ? { stage } : undefined);
        return;
      }
      sceneRouter.replace("notice");
    })().catch((error) => setErrorMessage(String(error)));
  }, []);
  return (
    <div
      className="scene"
      style={{ background: "#000", color: "#f88", fontSize: 14 }}
    >
      {errorMessage}
    </div>
  );
}
