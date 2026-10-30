/** 帳號（新增功能，原版沒有）：註冊／登入（電子信箱＋密碼）或遊客；版型沿用「輸入名字」視窗 */
import { useEffect, useState } from "react";
import { sceneRouter } from "@core/navigation/sceneRouter";
import { saveStore } from "@core/storage/saveStore";
import { SpriteButton, TextLabel, uiAsset } from "@ui/components";
import { accountService, MIN_PASSWORD_LENGTH } from "@modules/account";
import { FormWindow } from "../components/FormWindow";
import { inputBox } from "../components/formInputStyle";

/** 視窗內部高度＝WINDOW_HEIGHT − 80（九宮格上下邊框各 40）；所有元素的 y＋高度不可超過它 */
const WINDOW_HEIGHT = 470;
/** 三顆按鈕橫排：button_mini 寬 164，內部寬 520 → 間距 (520 − 164×3) / 2 = 14 */
const BUTTON_WIDTH = 164;
const BUTTON_GAP = 14;
const BUTTON_Y = 284;
const buttonX = (index: number) => index * (BUTTON_WIDTH + BUTTON_GAP);

type AccountAction = "register" | "login" | "guest";

export function AccountScene() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => sceneRouter.setBackHandler(() => false), []);

  const run = async (action: AccountAction) => {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      if (action === "register") await accountService.register(email, password);
      else if (action === "login") await accountService.login(email, password);
      else accountService.playAsGuest();
      sceneRouter.replace(saveStore.data.player.name ? "starter" : "name");
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttons: {
    action: AccountAction;
    label: string;
    assetId: string;
    pressedAssetId: string;
    strokeColor: string;
  }[] = [
    {
      action: "register",
      label: "註冊",
      assetId: uiAsset("button_mini_2"),
      pressedAssetId: uiAsset("button_mini_2_dark"),
      strokeColor: "#3a0806",
    },
    {
      action: "login",
      label: "登入",
      assetId: uiAsset("button_mini"),
      pressedAssetId: uiAsset("button_mini_dark"),
      strokeColor: "#082438",
    },
    {
      action: "guest",
      label: "遊客",
      assetId: uiAsset("button_mini"),
      pressedAssetId: uiAsset("button_mini_dark"),
      strokeColor: "#082438",
    },
  ];

  return (
    <FormWindow title="帳號" heading="註冊／登入" height={WINDOW_HEIGHT}>
      <TextLabel x={0} w={520} y={66} size={19} align="center" stroke={0}>
        建議使用 Google 信箱（Gmail）作為帳號。
      </TextLabel>
      <input
        style={inputBox(104, 58)}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="電子信箱"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        style={inputBox(176, 58)}
        type="password"
        autoComplete="current-password"
        placeholder={`密碼（至少 ${MIN_PASSWORD_LENGTH} 個字元）`}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <TextLabel
        x={0}
        w={520}
        y={246}
        size={19}
        align="center"
        stroke={0}
        color="#ff8a7a"
      >
        {errorMessage}
      </TextLabel>
      {buttons.map((button, index) => (
        <SpriteButton
          key={button.action}
          assetId={button.assetId}
          pressedAssetId={button.pressedAssetId}
          x={buttonX(index)}
          y={BUTTON_Y}
          onTap={() => run(button.action)}
          disabled={isSubmitting}
        >
          <TextLabel
            x={0}
            w={BUTTON_WIDTH}
            y={16}
            size={28}
            align="center"
            stroke={5}
            strokeColor={button.strokeColor}
          >
            {button.label}
          </TextLabel>
        </SpriteButton>
      ))}
      <TextLabel
        x={0}
        w={520}
        y={364}
        size={18}
        align="center"
        stroke={0}
        color="#cfd8d4"
      >
        遊客的資料只存在這台裝置，刪除 App 或清除瀏覽器資料就會消失。
      </TextLabel>
    </FormWindow>
  );
}
