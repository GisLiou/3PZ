/**
 * 返回鍵統一入口：
 * - Android 實體返回鍵（Capacitor App 'backButton'）
 * - 瀏覽器返回（popstate）：以「歷史陷阱」攔截，轉成遊戲內返回
 * - 桌面測試用 Esc
 * 全部導到 sceneRouter.back()；已經沒有上一頁時由 sceneRouter.onExitRequest 處理（App 顯示「確定離開遊戲？」）。
 *
 * 歷史陷阱：多塞一筆「陷阱」歷史，被返回時再塞回去。Chrome（尤其 Android）會略過「使用者沒操作過就塞進去」的歷史，
 * 所以每次觸碰、點擊、按鍵時，若陷阱已經用掉就再塞一次（使用者操作後塞的才會被返回鍵擋住）。
 * 陷阱一次塞 TRAP_DEPTH 筆：連按返回時，瀏覽器會在我們補塞之前連退好幾筆，只塞一筆的話第二下就退出遊戲了。
 */
import { sceneRouter } from "./sceneRouter";

/** 陷阱的筆數（連按幾下返回都還在遊戲裡） */
const TRAP_DEPTH = 4;
/** 目前停在第幾筆陷阱（0＝遊戲本身那一筆） */
const currentTrapDepth = () =>
  (history.state as { backButtonTrap?: number } | null)?.backButtonTrap ?? 0;
let leaving = false;

/** 安裝返回鍵處理；回傳解除安裝的函式 */
export async function installBackButtonHandling(): Promise<() => void> {
  const cleanups: Array<() => void> = [];

  // 1. 瀏覽器返回：停在陷阱上；被返回時塞回去，並轉成遊戲內返回
  const armTrap = () => {
    if (leaving) return;
    for (let depth = currentTrapDepth() + 1; depth <= TRAP_DEPTH; depth++)
      history.pushState({ backButtonTrap: depth }, "");
  };
  armTrap();
  const onPopState = () => {
    if (leaving) return;
    armTrap();
    sceneRouter.back();
  };
  window.addEventListener("popstate", onPopState);
  cleanups.push(() => window.removeEventListener("popstate", onPopState));
  const gestures = ["pointerup", "keydown"] as const;
  gestures.forEach((name) =>
    window.addEventListener(name, armTrap, { capture: true }),
  );
  cleanups.push(() =>
    gestures.forEach((name) =>
      window.removeEventListener(name, armTrap, { capture: true }),
    ),
  );

  // 2. Esc（電腦上測試）
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") sceneRouter.back();
  };
  window.addEventListener("keydown", onKeyDown);
  cleanups.push(() => window.removeEventListener("keydown", onKeyDown));

  // 3. 原生 App（Capacitor）實體返回鍵；網頁版沒有這個外掛時直接略過
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", () =>
        sceneRouter.back(),
      );
      cleanups.push(() => void listener.remove());
    }
  } catch {
    /* 網頁版：無原生外掛 */
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

/**
 * 離開遊戲（「確定離開遊戲？」按確定）：原生 App 關閉；網頁版回到進入遊戲前的頁面。
 * 網頁版沒有上一頁（直接開網址）時離不開，回傳 false（由畫面提示玩家自行關閉分頁）。
 */
export async function leaveGame(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
      return true;
    }
  } catch {
    /* 網頁版 */
  }
  leaving = true;
  // 陷阱＋遊戲本身都退掉，回到進入遊戲前的頁面
  history.go(-(currentTrapDepth() + 1));
  window.close();
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (document.visibilityState === "visible") {
    // 還在：沒有上一頁可回
    leaving = false;
    return false;
  }
  return true;
}
