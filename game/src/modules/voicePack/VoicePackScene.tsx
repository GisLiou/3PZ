/**
 * 語音下載詢問（新增功能，原版沒有）：第一次進入時詢問一次，之後可在「系統設置」再下載或刪除。
 * 版型沿用原版資訊視窗（info_window）與按鈕素材。
 */
import { useEffect, useState } from 'react';
import { sceneRouter } from '@core/navigation/sceneRouter';
import { saveStore } from '@core/storage/saveStore';
import { NineSliceFrame, Sprite, SpriteButton, TextLabel, uiAsset } from '@ui/components';
import { voicePackService } from './voicePackService';

const BYTES_PER_MB = 1048576;

export function VoicePackScene({ nextSceneId = 'starter' }: { nextSceneId?: string }) {
  const [packInfo, setPackInfo] = useState<{ total: number; bytes: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    sceneRouter.setBackHandler(() => false);
    void voicePackService.refresh().then(setPackInfo).catch(() => setPackInfo({ total: 0, bytes: 0 }));
  }, []);
  const finish = () => {
    saveStore.update((data) => { data.settings.voiceDownloadAsked = true; });
    sceneRouter.replace(nextSceneId);
  };
  const startDownload = async () => {
    setProgress({ done: 0, total: packInfo?.total ?? 0 });
    await voicePackService.download((done, total) => setProgress({ done, total }));
    finish();
  };
  const sizeMb = packInfo ? (packInfo.bytes / BYTES_PER_MB).toFixed(0) : '…';
  return (
    <div className="scene" style={{ background: '#000' }}>
      <Sprite assetId={uiAsset('background001')} x={-130} y={0} w={900} h={1200} />
      <NineSliceFrame assetId={uiAsset('info_window')} slice={40} x={40} y={330} w={560} h={330}>
        <TextLabel x={0} w={480} y={0} size={28} align="center" stroke={0}>武將語音</TextLabel>
        <TextLabel x={0} w={480} y={56} size={20} align="center" stroke={0}>
          {progress ? `下載中… ${progress.done} / ${progress.total}` : `要下載武將語音嗎？（約 ${sizeMb} MB）\n不下載也能正常遊玩，只是武將不會說話。\n之後可在「系統設置」下載或刪除。`}
        </TextLabel>
        {!progress && <>
          <SpriteButton assetId={uiAsset('button_mini_2')} pressedAssetId={uiAsset('button_mini_2_dark')} x={60} y={170} onTap={startDownload}>
            <TextLabel x={0} w={164} y={16} size={28} align="center" stroke={5} strokeColor="#3a0806">下載</TextLabel>
          </SpriteButton>
          <SpriteButton assetId={uiAsset('button_mini')} pressedAssetId={uiAsset('button_mini_dark')} x={256} y={170} onTap={finish}>
            <TextLabel x={0} w={164} y={16} size={28} align="center" stroke={5} strokeColor="#082438">稍後</TextLabel>
          </SpriteButton>
        </>}
      </NineSliceFrame>
    </div>
  );
}
