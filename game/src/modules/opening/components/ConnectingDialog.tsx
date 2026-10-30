/**
 * 連線中（v5 22097～35152 ms）：info_window 視窗由小放大（openingTiming.connectingPopInMs），
 * 兩側是魏軍小兵珠子的走路動畫（素材 puzzle_image 圖集，禎序見 data/pieces/pieceAtlas.ts）。
 * 位置量測自 22686 ms：視窗 x91 y416 457×208，小兵中心 (184,485)(454,485)，顯示比例 0.889。
 */
import { useEffect, useRef } from 'react';
import { playKeyframes } from '@core/animation/animate';
import { designUnit } from '@core/stage/stage';
import { NineSliceFrame, TextLabel, uiAsset } from '@ui/components';
import { AtlasAnimation } from '@ui/atlas';
import { PIECE_ATLAS_ASSET_ID, pieceAtlas, WEI_SOLDIER_WALK_FRAMES } from '@data/pieces/pieceAtlas';
import { openingTiming } from '../openingTiming';

const WALKER_SCALE = 0.889;

export function ConnectingDialog({ text = '連線中' }: { text?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void playKeyframes(dialogRef.current, [{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], openingTiming.connectingPopInMs); }, []);
  const walkingSoldier = (centerX: number) => (
    <AtlasAnimation atlasAssetId={PIECE_ATLAS_ASSET_ID} atlas={pieceAtlas} frames={WEI_SOLDIER_WALK_FRAMES} centerX={centerX} centerY={485} scale={WALKER_SCALE} />
  );
  return (
    <div ref={dialogRef} style={{ position: 'absolute', inset: 0, transformOrigin: `${designUnit(320)} ${designUnit(520)}` }}>
      <NineSliceFrame assetId={uiAsset('info_window')} slice={40} x={91} y={416} w={457} h={208} />
      {walkingSoldier(184)}{walkingSoldier(454)}
      <TextLabel x={0} w={640} y={474} size={30} align="center" stroke={0}>{text}</TextLabel>
      <TextLabel x={0} w={640} y={564} size={21} align="center" stroke={0}>請在連線環境良好的地方進行連線。</TextLabel>
    </div>
  );
}
