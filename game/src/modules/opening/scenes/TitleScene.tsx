/** 標題：title.png 鋪滿，下方 TOUCH TO START 帶；點一下 → 淡出 → 黑畫面 → 連線中 → 下一步 */
import { useEffect, useRef, useState } from 'react';
import { sceneRouter } from '@core/navigation/sceneRouter';
import { fadeIn, fadeOut, wait } from '@core/animation/animate';
import { audioService } from '@core/audio/audioService';
import { saveStore } from '@core/storage/saveStore';
import { designUnit } from '@core/stage/stage';
import { Sprite, uiAsset } from '@ui/components';
import { accountService } from '@modules/account';
import { ConnectingDialog } from '../components/ConnectingDialog';
import { VersionInfo } from '../components/VersionInfo';
import { openingTiming } from '../openingTiming';

type TitlePhase = 'fadingIn' | 'waitingForTap' | 'fadingOut' | 'black' | 'connecting';

/** 點擊後要去的畫面：未登入 → 帳號；未取名 → 輸入名字；其餘 → 選擇武將 */
const nextSceneAfterTitle = () => (accountService.current ? (saveStore.data.player.name ? 'starter' : 'name') : 'account');

export function TitleScene() {
  const artRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<TitlePhase>('fadingIn');
  useEffect(() => {
    sceneRouter.setBackHandler(() => false);
    void fadeIn(artRef.current, openingTiming.titleFadeInMs).then(() => setPhase('waitingForTap'));
    audioService.playBackgroundMusic('bg_00001');
  }, []);
  const onTap = async () => {
    if (phase !== 'waitingForTap') return;
    audioService.unlock();
    setPhase('fadingOut');
    await fadeOut(artRef.current, openingTiming.titleFadeOutMs);
    setPhase('black');
    await wait(openingTiming.blackWithVersionMs);
    setPhase('connecting');
    await wait(openingTiming.blackBeforeConnectingMs + openingTiming.connectingHoldMs);
    sceneRouter.replace(nextSceneAfterTitle());
  };
  return (
    <div className="scene" style={{ background: '#000' }} onPointerUp={onTap}>
      <div ref={artRef} style={{ position: 'absolute', inset: 0, opacity: 0 }}>
        <Sprite assetId={uiAsset('title')} x={-130} y={0} w={900} h={1200} style={{ top: 'auto', bottom: 0 }} />
        <Sprite assetId={uiAsset('title_touch_bg')} x={0} y={0} style={{ top: 'auto', bottom: designUnit(150) }} />
        <Sprite assetId={uiAsset('title_touch')} x={90} y={0} style={{ top: 'auto', bottom: designUnit(150) }} />
      </div>
      {phase !== 'connecting' && <VersionInfo />}
      {phase === 'connecting' && <ConnectingDialog />}
    </div>
  );
}
