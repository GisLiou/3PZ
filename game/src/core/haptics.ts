/**
 * 觸覺回饋（短震動）。原版沒有震動，這是新增的回饋，可用 haptics.enabled 關掉。
 * Android 瀏覽器支援 navigator.vibrate；iOS 網頁不支援，呼叫時直接略過（App 版日後可改接 Capacitor Haptics）。
 */
export const haptics = {
  enabled: true,
  /** 震動 durationMs 毫秒；不支援或被瀏覽器擋下時不做任何事 */
  pulse(durationMs: number) {
    if (!this.enabled || typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(durationMs);
    } catch {
      /* 部分瀏覽器在沒有使用者操作時會丟錯 */
    }
  },
};
