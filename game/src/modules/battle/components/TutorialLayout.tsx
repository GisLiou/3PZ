/**
 * 新手教學的版面：教學遮罩 <TutorialMask> 與它的設定（只有教學關卡會放）。←要調教學提示的位置改這裡
 * 這個檔案只放這一個元件，改了存檔就熱更新（畫面上的提示立刻跟著動，教學不會重來）。
 *   touchHandX／touchHandY   點擊提示的手（touch00／01）左上角，以高亮範圍「右緣、上下置中」為原點
 *   touchLabelX／touchLabelY 「タッチ!」（touch02）左上角，同上
 *   touchSize                兩張圖的邊長（原圖 120）
 */
import { TutorialMask } from "./TutorialMask";

export function TutorialLayout() {
  return (
    <TutorialMask
      touchHandX={-100}
      touchHandY={30}
      touchLabelX={-20}
      touchLabelY={0}
      touchSize={96}
    />
  );
}
