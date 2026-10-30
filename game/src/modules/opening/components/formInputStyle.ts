/** 輸入框外觀（深色底＋灰綠邊；原版是系統原生輸入框，見 自製素材 README #3） */
import { designUnit } from "@core/stage/stage";
import type { CSSProperties, KeyboardEvent } from "react";

export const formInputStyle: CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  border: `${designUnit(2)} solid #6f8a7d`,
  borderRadius: designUnit(4),
  background: "rgba(8,20,22,.85)",
  color: "#fff",
  fontSize: designUnit(26),
  padding: `0 ${designUnit(14)}`,
  outline: "none",
  fontFamily: "inherit",
  touchAction: "manipulation",
  userSelect: "text",
  WebkitUserSelect: "text",
};

/** 輸入框在視窗內的位置（設計單位） */
export const inputBox = (top: number, height: number): CSSProperties => ({
  ...formInputStyle,
  left: designUnit(0),
  top: designUnit(top),
  width: designUnit(520),
  height: designUnit(height),
});

/**
 * 鍵盤的 Enter／勾勾／「完成」鍵：執行 onEnter 並收起鍵盤。
 * 中文輸入法選字時按的 Enter（isComposing）不算，避免名字還沒打完就送出。
 */
export const onEnterKey =
  (onEnter: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return;
    event.preventDefault();
    event.currentTarget.blur(); // 收起鍵盤
    onEnter();
  };
