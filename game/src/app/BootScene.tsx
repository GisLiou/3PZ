/**
 * 啟動：讀素材清單 → 恢復帳號 → 預載開場要用的圖 → 注意畫面。
 * 原版此處是系統讀取轉圈（3210～6421 ms），不屬於遊戲素材，這裡只顯示黑畫面。
 */
import { useEffect, useState } from 'react';
import { loadAssetManifest, preloadAssets } from '@core/assets/assetLoader';
import { sceneRouter } from '@core/navigation/sceneRouter';
import { saveStore } from '@core/storage/saveStore';
import { migrateLegacyStorageKeys } from '@core/storage/storageKeys';
import { accountService } from '@modules/account';
import { voicePackService } from '@modules/voicePack';
import { uiAsset } from '@ui/components';
import { PIECE_ATLAS_ASSET_ID } from '@data/pieces/pieceAtlas';

const BOOT_PRELOAD_ASSETS = [
  'title', 'title_touch', 'title_touch_bg', 'info_window', 'background001', 'caption_02', 'dialog_line',
  'button_mini', 'button_mini_dark', 'button_mini_2', 'button_mini_2_dark',
].map(uiAsset).concat([PIECE_ATLAS_ASSET_ID]);

/** 開發用（開發伺服器與 develop 版）：網址 #scene=<場景 id> 直接跳到該場景（使用 debug 存檔） */
const isDebugBuild = import.meta.env.DEV || !!import.meta.env.VITE_DEBUG;

export function BootScene() {
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    sceneRouter.setBackHandler(() => false);
    (async () => {
      migrateLegacyStorageKeys();
      await loadAssetManifest();
      accountService.restoreSession();
      await preloadAssets(BOOT_PRELOAD_ASSETS);
      void voicePackService.refresh().catch(() => {});
      const debugSceneId = /scene=(\w+)/.exec(location.hash)?.[1];
      if (debugSceneId && isDebugBuild) { saveStore.load('debug'); sceneRouter.replace(debugSceneId); return; }
      sceneRouter.replace('notice');
    })().catch((error) => setErrorMessage(String(error)));
  }, []);
  return <div className="scene" style={{ background: '#000', color: '#f88', fontSize: 14 }}>{errorMessage}</div>;
}
