/** 輸入名字（復刻 36383 ms 畫面）：10 個字以內 */
import { useEffect, useState } from "react";
import { sceneRouter } from "@core/navigation/sceneRouter";
import { saveStore } from "@core/storage/saveStore";
import { SpriteButton, TextLabel, uiAsset } from "@ui/components";
import { FormWindow } from "../components/FormWindow";
import { inputBox, onEnterKey } from "../components/formInputStyle";

const MAX_NAME_LENGTH = 10;

export function PlayerNameScene() {
  const [name, setName] = useState(saveStore.data.player.name);
  useEffect(() => sceneRouter.setBackHandler(() => false), []);
  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed || [...trimmed].length > MAX_NAME_LENGTH) return;
    saveStore.update((data) => {
      data.player.name = trimmed;
    });
    sceneRouter.replace(
      saveStore.data.settings.voiceDownloadAsked ? "starter" : "voice",
    );
  };
  return (
    <FormWindow title="輸入名字" heading="輸入名字">
      <TextLabel
        x={0}
        w={520}
        y={75}
        size={20}
        align="center"
        stroke={0}
      >{`請輸入名字。(${MAX_NAME_LENGTH}個字以內)`}</TextLabel>
      <input
        style={inputBox(122, 64)}
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChange={(event) => setName(event.target.value)}
        enterKeyHint="done"
        onKeyDown={onEnterKey(confirm)}
      />
      <SpriteButton
        assetId={uiAsset("button_mini_2")}
        pressedAssetId={uiAsset("button_mini_2_dark")}
        x={178}
        y={210}
        onTap={confirm}
      >
        <TextLabel
          x={0}
          w={164}
          y={16}
          size={28}
          align="center"
          stroke={5}
          strokeColor="#3a0806"
        >
          確定
        </TextLabel>
      </SpriteButton>
      <TextLabel
        x={0}
        w={520}
        y={290}
        size={18}
        align="center"
        stroke={0}
        color="#cfd8d4"
      >
        ※之後也能變更名字。
      </TextLabel>
    </FormWindow>
  );
}
