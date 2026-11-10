/** 「確定離開遊戲？」：返回鍵按到已經沒有上一頁時顯示（原版素材 info_window、button_mini_2／button_mini） */
import { useState } from "react";
import { leaveGame } from "@core/backButton";
import { NineSliceFrame, SpriteButton, TextLabel, uiAsset } from "@ui";

export function ExitConfirmDialog({ onClose }: { onClose: () => void }) {
  const [cannotLeave, setCannotLeave] = useState(false);
  const confirm = async () => {
    if (!(await leaveGame())) setCannotLeave(true);
  };
  return (
    <div className="scene" style={{ pointerEvents: "auto" }}>
      <NineSliceFrame
        assetId={uiAsset("info_window")}
        slice={40}
        x={60}
        y={380}
        w={520}
        h={260}
      >
        <TextLabel x={0} w={440} y={20} size={28} align="center" stroke={0}>
          {cannotLeave ? "請直接關閉瀏覽器分頁" : "確定要離開遊戲嗎？"}
        </TextLabel>
        <SpriteButton
          assetId={uiAsset("button_mini_2")}
          pressedAssetId={uiAsset("button_mini_2_dark")}
          x={cannotLeave ? 138 : 40}
          y={110}
          onTap={cannotLeave ? onClose : () => void confirm()}
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
            {cannotLeave ? "關閉" : "離開"}
          </TextLabel>
        </SpriteButton>
        {!cannotLeave && (
          <SpriteButton
            assetId={uiAsset("button_mini")}
            pressedAssetId={uiAsset("button_mini_dark")}
            x={236}
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
              取消
            </TextLabel>
          </SpriteButton>
        )}
      </NineSliceFrame>
    </div>
  );
}
