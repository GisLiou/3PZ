/**
 * 標準戰鬥畫面的組合：要移動、縮放、增減元件或調整圖層，改這個檔案就好。
 *   - 每個標籤都能寫 x、y、anchor（"bottom"＝以螢幕底部往上 999 為 y=0，"top"＝以螢幕頂端為 y=0）；大小用 w／h
 *   - 寫在後面的標籤蓋在前面的上方
 *   - 屬性沒寫時用標籤的預設值；這裡把預設值都寫出來，方便直接修改
 * 關卡要加自己的東西（例：教學遮罩）時，把標籤放在 children，會疊在最上層。
 * 調整方式：開發版打開 #scene=battle&stage=test（無限關卡），改這裡的數值存檔，畫面熱更新就會跟著動。
 */
import type { ReactNode } from "react";
import type { PartyMemberDefinition } from "../logic/battleAssets";
import type { BattleScreen } from "../logic/BattleScreen";
import {
  BattleCanvas,
  Board,
  Effects,
  Enemies,
  Scenery,
  Troops,
} from "./BattleCanvas";
import {
  ChestCounter,
  MenuButton,
  PartyHpBar,
  PartyPortraits,
  RelationChart,
  VictoryHint,
  WaveBanner,
} from "./BattleCanvas";

interface StandardBattleLayoutProps {
  party: PartyMemberDefinition[];
  onReady: (battle: BattleScreen) => void;
  children?: ReactNode;
}

export function StandardBattleLayout({
  party,
  onReady,
  children,
}: StandardBattleLayoutProps) {
  return (
    <BattleCanvas party={party} onReady={onReady}>
      <Scenery y={0} />
      <Enemies x={0} y={-50} />
      <Board x={0} y={540} />
      <PartyPortraits x={10} y={405} size={100} gap={5} />
      <PartyHpBar x={5} y={508} w={635} />
      <Effects y={-40} />
      <Troops y={-40} h={100} />
      <WaveBanner x={0} y={126} h={64} gap={14} />
      <ChestCounter
        anchor="top"
        x={20}
        y={50}
        w={60}
        countX={65}
        countY={3}
        countH={30}
      />
      <RelationChart anchor="top" x={514.22} y={104.72} w={141.36} />
      <VictoryHint anchor="top" x={466} y={192} w={170} size={18} />
      <MenuButton anchor="top" x={493} y={46} w={140.6} />
      {children}
    </BattleCanvas>
  );
}
