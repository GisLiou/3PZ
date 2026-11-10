/**
 * 戰鬥中的 Menu 對話框（點右上角 Menu 按鈕打開；外框與按鈕用原版素材 info_window、button_mini_2／button_mini）。
 *   無限關卡（stage.endless）多一個「跳過這個合戰」：敵人直接退場、前往下一個合戰，方便快速檢查各合戰。
 * 原版 Menu 的撤退、設定等功能尚未復刻。
 */
import { NineSliceFrame, SpriteButton, TextLabel, uiAsset } from "@ui";

interface BattleMenuDialogProps {
  /** 是否顯示「跳過這個合戰」（無限關卡才有） */
  canSkipWave: boolean;
  onSkipWave: () => void;
  onClose: () => void;
}

export function BattleMenuDialog({
  canSkipWave,
  onSkipWave,
  onClose,
}: BattleMenuDialogProps) {
  return (
    <div
      className="scene"
      style={{ pointerEvents: "auto", background: "rgba(0,0,0,.45)" }}
    >
      <NineSliceFrame
        assetId={uiAsset("info_window")}
        slice={40}
        x={60}
        y={300}
        w={520}
        h={260}
      >
        <TextLabel x={0} w={440} y={20} size={28} align="center" stroke={0}>
          Menu
        </TextLabel>
        {canSkipWave && (
          <SpriteButton
            assetId={uiAsset("button_mini_2")}
            pressedAssetId={uiAsset("button_mini_2_dark")}
            x={40}
            y={110}
            onTap={onSkipWave}
          >
            <TextLabel
              x={0}
              w={164}
              y={18}
              size={24}
              align="center"
              stroke={5}
              strokeColor="#3a0806"
            >
              跳過這個合戰
            </TextLabel>
          </SpriteButton>
        )}
        <SpriteButton
          assetId={uiAsset("button_mini")}
          pressedAssetId={uiAsset("button_mini_dark")}
          x={canSkipWave ? 236 : 138}
          y={110}
          onTap={onClose}
        >
          <TextLabel
            x={0}
            w={164}
            y={16}
            size={28}
            align="center"
            stroke={5}
            strokeColor="#082438"
          >
            關閉
          </TextLabel>
        </SpriteButton>
      </NineSliceFrame>
    </div>
  );
}
