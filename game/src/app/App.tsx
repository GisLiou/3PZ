/**
 * App 外殼：舞台縮放 → 場景路由 → 目前場景。
 * 場景表在 ./sceneRegistry.ts，新增畫面只要在那裡登記，不用改這個檔案。
 */
import { useEffect, useRef } from 'react';
import { mountStage } from '@core/stage/stage';
import { useSceneStack } from '@core/navigation/sceneRouter';
import { audioService } from '@core/audio/audioService';
import { FULL_HEIGHT_SCENES, SCENE_COMPONENTS } from './sceneRegistry';

export function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { root, children } = useSceneStack();
  useEffect(() => mountStage(stageRef.current!), []);
  // 手機瀏覽器第一次觸碰後才能播放聲音
  useEffect(() => {
    const unlockAudio = () => audioService.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);
  const layers = [root, ...children];
  return (
    <div id="stage" ref={stageRef}>
      {layers.map((scene, index) => {
        const Scene = SCENE_COMPONENTS[scene.id];
        if (!Scene) throw new Error(`未登記的場景：${scene.id}`);
        // 只顯示最上層；下層保留狀態（例如返回時清單捲動位置不變）
        const isTop = index === layers.length - 1;
        return (
          <div key={index + scene.id} className={FULL_HEIGHT_SCENES.has(scene.id) ? 'layer full' : 'layer'} style={{ display: isTop ? 'block' : 'none' }}>
            <Scene {...(scene.params as object)} />
          </div>
        );
      })}
    </div>
  );
}
