/**
 * 返回鍵統一入口：
 * - Android 實體返回鍵（Capacitor App 'backButton'）
 * - 瀏覽器返回（popstate）：以「歷史陷阱」攔截，瀏覽器永遠不會真的離開或換頁
 * - 桌面測試用 Esc
 * 全部導到 sceneRouter.back()，所以返回的效果一定是遊戲內的返回。
 */
import { sceneRouter } from './sceneRouter';

const HISTORY_TRAP_STATE = { backButtonTrap: true };

/** 安裝返回鍵處理；回傳解除安裝的函式 */
export async function installBackButtonHandling(): Promise<() => void> {
  const cleanups: Array<() => void> = [];

  // 1. 瀏覽器返回：先多塞一筆歷史，被返回時再塞回去，並轉成遊戲內返回
  history.pushState(HISTORY_TRAP_STATE, '');
  const onPopState = () => {
    history.pushState(HISTORY_TRAP_STATE, '');
    sceneRouter.back();
  };
  window.addEventListener('popstate', onPopState);
  cleanups.push(() => window.removeEventListener('popstate', onPopState));

  // 2. Esc（電腦上測試）
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') sceneRouter.back();
  };
  window.addEventListener('keydown', onKeyDown);
  cleanups.push(() => window.removeEventListener('keydown', onKeyDown));

  // 3. 原生 App（Capacitor）實體返回鍵；網頁版沒有這個外掛時直接略過
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app');
      const listener = await App.addListener('backButton', () => sceneRouter.back());
      cleanups.push(() => void listener.remove());
    }
  } catch {
    /* 網頁版：無原生外掛 */
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
