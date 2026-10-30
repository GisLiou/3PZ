/** 共用的「標題列 + 視窗」版型（輸入名字、帳號都用） */
import type { ReactNode } from 'react';
import { NineSliceFrame, Sprite, TextLabel, uiAsset } from '@ui/components';

export function FormWindow({ title, heading, children, height = 392 }: { title: string; heading: string; children: ReactNode; height?: number }) {
  return (
    <div className="scene" style={{ background: '#000' }}>
      <Sprite assetId={uiAsset('background001')} x={-130} y={0} w={900} h={1200} />
      <Sprite assetId={uiAsset('caption_02')} x={22} y={60} />
      <TextLabel x={56} y={82} size={38} stroke={6}>{title}</TextLabel>
      <NineSliceFrame assetId={uiAsset('info_window')} slice={40} x={20} y={253} w={600} h={height}>
        <TextLabel x={0} w={520} y={2} size={28} align="center" stroke={0}>{heading}</TextLabel>
        <Sprite assetId={uiAsset('dialog_line')} x={186} y={44} w={148} h={3} />
        {children}
      </NineSliceFrame>
    </div>
  );
}
