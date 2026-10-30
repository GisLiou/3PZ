/** 新手教學戰鬥 1 的場景：提供掛載點，腳本在 ./tutorialBattleScript.ts */
import { useEffect, useRef } from 'react';
import { sceneRouter } from '@core/navigation/sceneRouter';
import { runTutorialBattle1 } from './tutorialBattleScript';

export function TutorialBattleScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const host = hostRef.current!;
    sceneRouter.setBackHandler(() => false);
    void runTutorialBattle1(host, () => active).catch((error) => console.error(error));
    return () => { active = false; host.innerHTML = ''; };
  }, []);
  return <div className="scene" ref={hostRef} style={{ background: '#000' }} />;
}
