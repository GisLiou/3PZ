/** 共用的「標題列 + 視窗」版型與輸入框外觀（輸入名字、帳號都用） */
import { type ReactNode, type CSSProperties, type KeyboardEvent } from "react";
import { NineSliceFrame, Sprite, TextLabel, uiAsset } from "@ui";
import { designUnit } from "@core/stage";

export function FormWindow({
  title,
  heading,
  children,
  height = 392,
}: {
  title: string;
  heading: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <div className="scene" style={{ background: "#000" }}>
      <Sprite
        assetId={uiAsset("background001")}
        x={-130}
        y={0}
        w={900}
        h={1200}
      />
      <Sprite assetId={uiAsset("caption_02")} x={22} y={60} />
      <TextLabel x={56} y={82} size={38} stroke={6}>
        {title}
      </TextLabel>
      <NineSliceFrame
        assetId={uiAsset("info_window")}
        slice={40}
        x={20}
        y={253}
        w={600}
        h={height}
      >
        <TextLabel x={0} w={520} y={2} size={28} align="center" stroke={0}>
          {heading}
        </TextLabel>
        <Sprite assetId={uiAsset("dialog_line")} x={186} y={44} w={148} h={3} />
        {children}
      </NineSliceFrame>
    </div>
  );
}

/** 輸入框外觀（深色底＋灰綠邊；原版是系統原生輸入框，見 自製素材 README #3） */
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
