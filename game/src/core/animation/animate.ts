/**
 * 動畫工具：所有復刻動畫的時間都寫成「毫秒」常數（取自 docs/復刻分析 的逐禎紀錄），
 * 再交給 Web Animations API 播放，方便日後逐一對照調整。
 */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 等到下一個畫面更新（requestAnimationFrame） */
export const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** 播放關鍵影格並停在最後一格；元素不存在時直接完成 */
export function playKeyframes(element: Element | null, keyframes: Keyframe[], durationMs: number, easing = 'linear'): Promise<void> {
  if (!element) return Promise.resolve();
  return element.animate(keyframes, { duration: durationMs, easing, fill: 'forwards' }).finished.then(() => undefined);
}

export const fadeIn = (element: Element | null, durationMs: number) => playKeyframes(element, [{ opacity: 0 }, { opacity: 1 }], durationMs);
export const fadeOut = (element: Element | null, durationMs: number) => playKeyframes(element, [{ opacity: 1 }, { opacity: 0 }], durationMs);
