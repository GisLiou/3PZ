/**
 * 標題：title.png 鋪滿，下方 TOUCH TO START 帶，左下 Group／ID、右下版本字樣；點一下直接進入下一個畫面。
 * （原版點擊後還有淡出、黑畫面、「連線中」；目前不需要連線，所以直接切換。日後連線時用 ConnectingDialog）
 */
import { useEffect } from "react";
import { sceneRouter } from "@core/sceneRouter";
import { audioService } from "@core/audioService";
import { saveStore } from "@core/saveStore";
import { designUnit } from "@core/stage";
import { Sprite, TextLabel, uiAsset } from "@ui";
import { accountService } from "@modules/begin";

const GAME_VERSION = "Version 0.1.0";
/** 「TOUCH TO START」呼吸與殘影的週期（v5 約 25 禎 × 53.5 ms） */
const TOUCH_PULSE_MS = 1340;

/** 點擊後要去的畫面：未登入 → 帳號；未取名 → 輸入名字；其餘 → 選擇武將 */
const nextSceneAfterTitle = () =>
  accountService.current
    ? saveStore.data.player.name
      ? "starter"
      : "name"
    : "account";

export function TitleScene() {
  useEffect(() => {
    audioService.playBackgroundMusic("bg_00001");
  }, []);
  const onTap = () => {
    audioService.unlock();
    sceneRouter.replace(nextSceneAfterTitle());
  };
  const shortAccountId = (accountService.current?.id ?? "")
    .slice(0, 9)
    .toUpperCase();
  return (
    <div className="scene" style={{ background: "#000" }} onPointerUp={onTap}>
      <Sprite
        assetId={uiAsset("title")}
        x={-130}
        y={0}
        w={900}
        h={1200}
        style={{ top: "auto", bottom: 0 }}
      />
      <Sprite
        assetId={uiAsset("title_touch_bg")}
        x={0}
        y={0}
        style={{ top: "auto", bottom: designUnit(150) }}
      />
      {/* 殘影（複本從字的位置向外擴大並淡出）＋字本身（只做明暗呼吸，不縮放）；動畫見 global.css */}
      <Sprite
        assetId={uiAsset("title_touch")}
        x={90}
        y={0}
        style={{
          top: "auto",
          bottom: designUnit(150),
          opacity: 0,
          animation: `title-touch-afterimage ${TOUCH_PULSE_MS}ms ease-out infinite`,
        }}
      />
      <Sprite
        assetId={uiAsset("title_touch")}
        x={90}
        y={0}
        style={{
          top: "auto",
          bottom: designUnit(150),
          animation: `title-touch-breathe ${TOUCH_PULSE_MS}ms ease-in-out infinite`,
        }}
      />
      <TextLabel x={14} style={{ bottom: designUnit(52) }} size={20} stroke={3}>
        Group:A
      </TextLabel>
      <TextLabel x={14} style={{ bottom: designUnit(14) }} size={20} stroke={3}>
        {`ID: ${shortAccountId}`}
      </TextLabel>
      <TextLabel
        style={{ right: designUnit(14), bottom: designUnit(14) }}
        size={20}
        stroke={3}
      >
        {GAME_VERSION}
      </TextLabel>
    </div>
  );
}
