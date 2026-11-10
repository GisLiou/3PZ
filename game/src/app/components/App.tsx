/**
 * App 外殼：舞台縮放 → 場景路由 → 目前場景。
 * 場景表在 ./sceneRegistry.ts，新增畫面只要在那裡登記，不用改這個檔案。
 */
import { useEffect, useRef, useState } from "react";
import { mountStage } from "@core/stage";
import { sceneRouter, useSceneStack } from "@core/sceneRouter";
import { ExitConfirmDialog } from "./ExitConfirmDialog";
import { audioService } from "@core/audioService";
import { FULL_HEIGHT_SCENES, SCENE_COMPONENTS } from "../logic/sceneRegistry";

export function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { root, children } = useSceneStack();
  useEffect(() => mountStage(stageRef.current!), []);
  // 返回鍵按到已經沒有上一頁：顯示「確定離開遊戲？」；再按一次返回＝取消
  const [isExitConfirmOpen, setExitConfirmOpen] = useState(false);
  useEffect(() => {
    sceneRouter.onExitRequest = () => setExitConfirmOpen((open) => !open);
    return () => {
      sceneRouter.onExitRequest = () => {};
    };
  }, []);
  // 瀏覽器規定使用者操作過之後才能播放聲音。手機上手指「放開」才算操作，所以按下、放開、點擊、按鍵都試一次；
  // 已經在出聲時 unlock() 不做任何事
  useEffect(() => {
    const unlockAudio = () => audioService.unlock();
    const events = [
      "pointerdown",
      "pointerup",
      "touchend",
      "click",
      "keydown",
    ] as const;
    events.forEach((name) =>
      window.addEventListener(name, unlockAudio, { capture: true }),
    );
    return () =>
      events.forEach((name) =>
        window.removeEventListener(name, unlockAudio, { capture: true }),
      );
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
          <div
            key={index + scene.id}
            className={
              FULL_HEIGHT_SCENES.has(scene.id) ? "layer full" : "layer"
            }
            style={{ display: isTop ? "block" : "none" }}
          >
            <Scene {...(scene.params as object)} />
          </div>
        );
      })}
      {isExitConfirmOpen && (
        <div
          className="layer full"
          style={{ zIndex: 100, background: "rgba(0,0,0,.6)" }}
        >
          <div className="layer">
            <ExitConfirmDialog onClose={() => setExitConfirmOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
