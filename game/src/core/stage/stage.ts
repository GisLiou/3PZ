/**
 * 設計解析度與縮放（手遊常見的「固定寬、彈性高」）。
 * 原版為 640 寬；高度在 960（iPhone 4）～1136（iPhone 5）之間彈性。
 * 舞台本身填滿整個螢幕高度（高度不設上限）；一般畫面放在置中的 1136 高版面內（超出部分留黑），
 * 戰鬥等「全高」畫面直接使用整個舞台高度（敵方區域往上延伸），見 app/App.tsx。
 * 全部版面都用「設計單位」撰寫：CSS 以 calc(var(--design-unit) * N) 換算成實際像素。
 */
import { useEffect, useState } from "react";

export const DESIGN_WIDTH = 640;
export const DESIGN_HEIGHT_MIN = 960;
export const DESIGN_HEIGHT_MAX = 1136;

export interface StageMetrics {
  /** 1 設計單位對應的 CSS 像素 */
  unitPx: number;
  /** 舞台設計高度（≥960，不設上限） */
  height: number;
  /** 舞台在視窗中的偏移（CSS px） */
  left: number;
  top: number;
}

export function computeStageMetrics(
  viewportWidth: number,
  viewportHeight: number,
): StageMetrics {
  const unitPx = Math.min(
    viewportWidth / DESIGN_WIDTH,
    viewportHeight / DESIGN_HEIGHT_MIN,
  );
  const height = Math.max(DESIGN_HEIGHT_MIN, viewportHeight / unitPx);
  return {
    unitPx,
    height,
    left: (viewportWidth - DESIGN_WIDTH * unitPx) / 2,
    top: (viewportHeight - height * unitPx) / 2,
  };
}

/** 目前的舞台尺寸（mountStage 後才有值）；畫面需要依高度排版時讀這裡 */
export let currentStage: StageMetrics = {
  unitPx: 1,
  height: DESIGN_HEIGHT_MIN,
  left: 0,
  top: 0,
};
const resizeListeners = new Set<(metrics: StageMetrics) => void>();

/** 監聽舞台尺寸變化；回傳解除監聽的函式 */
export function onStageResize(
  listener: (metrics: StageMetrics) => void,
): () => void {
  resizeListeners.add(listener);
  return () => resizeListeners.delete(listener);
}

/** 目前是否在輸入文字（鍵盤可能開著） */
const isEditingText = () => {
  const element = document.activeElement;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
};

/** 把舞台尺寸寫進 CSS 變數，並在視窗大小改變時更新。回傳解除監聽的函式。 */
export function mountStage(stageElement: HTMLElement): () => void {
  let lastViewport = { width: 0, height: 0 };
  const apply = () => {
    // 用版面視窗（innerWidth/innerHeight），不用 visualViewport：鍵盤只會縮小 visualViewport
    const width = window.innerWidth,
      height = window.innerHeight;
    // 鍵盤彈出（正在輸入、寬度不變、只有高度變小）：不重新縮放，讓鍵盤蓋在畫面上
    if (
      isEditingText() &&
      width === lastViewport.width &&
      height < lastViewport.height
    )
      return;
    lastViewport = { width, height };
    const metrics = computeStageMetrics(width, height);
    const style = stageElement.style;
    style.setProperty("--design-unit", `${metrics.unitPx}px`);
    // 一般畫面的版面高度（960～1136）與其在舞台中的上緣
    const fitHeight = Math.min(DESIGN_HEIGHT_MAX, metrics.height);
    style.setProperty("--fit-height", String(fitHeight));
    style.setProperty("--fit-top", String((metrics.height - fitHeight) / 2));
    style.width = `${DESIGN_WIDTH * metrics.unitPx}px`;
    style.height = `${metrics.height * metrics.unitPx}px`;
    style.left = `${metrics.left}px`;
    style.top = `${metrics.top}px`;
    currentStage = metrics;
    resizeListeners.forEach((listener) => listener(metrics));
  };
  apply();
  window.addEventListener("resize", apply);
  return () => window.removeEventListener("resize", apply);
}

/** 設計單位 → CSS 長度字串，例：designUnit(120) === 'calc(var(--design-unit)*120)' */
export const designUnit = (value: number) =>
  `calc(var(--design-unit)*${value})`;

/** CSS translate（設計單位），extra 為接在後面的其他變形，例：' scale(1.2)' */
export const translateUnits = (x: number, y: number, extra = "") =>
  `translate(${designUnit(x)},${designUnit(y)})${extra}`;

/** React：取得舞台設計高度，尺寸改變時重新渲染 */
export function useStageHeight(): number {
  const [height, setHeight] = useState(currentStage.height);
  useEffect(() => onStageResize((metrics) => setHeight(metrics.height)), []);
  return height;
}
