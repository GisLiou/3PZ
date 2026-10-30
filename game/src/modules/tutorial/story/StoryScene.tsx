/**
 * 故事（v5 89 460～108 721 ms）：城門背景、「故事」標題條、序文、合戰開始鈕；
 * 點擊後中縫出現光芒、兩扇城門往內推開（3D 旋轉）、門後透出白光、整面變白，進入戰鬥。
 * 版面：城門 door.png 原尺寸 450×1200（1px＝1 設計單位），左扇 x=-130、右扇 x=320 左右翻轉，鐵框在中縫相接；
 *   door2.png（中縫內側的暗色門縫）放在門後，開門瞬間才看得到；標題條 y230 高 42；序文左緣 36、首行 y340、字高 26；
 *   按鈕 button_queststart (82,812)。
 * 時間：89 460 淡入（約 430 ms）；按鈕亮度呼吸週期約 1 284 ms（89 888 → 91 172 → 92 456）；
 *   原版 104 441 為中縫白光展開，這裡改為推開城門（見 docs/開發步驟.md「已知與原版不同」）。
 */
import { useEffect, useRef } from 'react';
import { sceneRouter } from '@core/navigation/sceneRouter';
import { playKeyframes, wait } from '@core/animation/animate';
import { audioService } from '@core/audio/audioService';
import { designUnit } from '@core/stage/stage';
import { Sprite, TextLabel, uiAsset } from '@ui/components';
import { AtlasPartSprite, type Atlas } from '@ui/atlas';
import menuPartsA from '@data/atlas/ccbMenuPartsA.json';
import { tutorialTiming } from '../tutorialTiming';

const STORY_TEXT = '時間往前追溯到一千八百多年前。\n\n漢朝末期因外戚與宦官干政，紊亂朝綱\n使得民不聊生，苦不堪言。\n\n此時，\n英雄豪傑為拯救天下而奮起......。';
/** 「故事」標題條：ccbMenuPartsA 圖集的零件 4（轉 90° 存放） */
const TITLE_BAR_PART = 4;
/** 城門單扇原尺寸（設計單位） */
const DOOR_WIDTH = 450;
const DOOR_HEIGHT = 1200;
/** 兩扇門相接的中縫 x */
const SEAM_X = 320;
/** 推開後的角度（度）：越接近 90 越側向 */
const DOOR_OPEN_DEG = 80;
/** 透視距離（設計單位）：越小立體感越強 */
const DOOR_PERSPECTIVE = 900;
/** 推門的緩動：一開始沉重、越推越快 */
const DOOR_OPEN_EASING = 'cubic-bezier(.55,0,.8,.2)';
/** 中縫光芒 door_flash（494×494）的大小與中心 y（暫定值） */
const SPARKLE_SIZE = 494;
const SPARKLE_Y = 500;

const fullLayer = { position: 'absolute', inset: 0 } as const;

export function StoryScene() {
  const contentRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const leftDoorRef = useRef<HTMLDivElement>(null);
  const rightDoorRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);
  const whiteRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLDivElement>(null);
  const isStarting = useRef(false);

  useEffect(() => {
    sceneRouter.setBackHandler(() => false);
    void playKeyframes(contentRef.current, [{ opacity: 0 }, { opacity: 1 }], tutorialTiming.storyFadeInMs);
    const pulse = startButtonRef.current!.animate([{ filter: 'brightness(.85)' }, { filter: 'brightness(1.25)' }, { filter: 'brightness(.85)' }], { duration: tutorialTiming.storyButtonPulseMs, iterations: Infinity });
    return () => pulse.cancel();
  }, []);

  const startBattle = async () => {
    if (isStarting.current) return;
    isStarting.current = true;
    audioService.unlock();
    // ① 文字與按鈕淡出，同時中縫出現光芒
    void playKeyframes(textRef.current, [{ opacity: 1 }, { opacity: 0 }], tutorialTiming.storyTextFadeOutMs);
    await playKeyframes(sparkleRef.current, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.4)', opacity: 1 }], tutorialTiming.doorSparkleMs, 'ease-out');
    // ② 兩扇門往內推開（左扇以左緣為軸、右扇以右緣為軸），門越轉越暗，門後的光越來越亮
    await Promise.all([
      playKeyframes(leftDoorRef.current, [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${DOOR_OPEN_DEG}deg)`, filter: 'brightness(.45)' }], tutorialTiming.doorOpenMs, DOOR_OPEN_EASING),
      playKeyframes(rightDoorRef.current, [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${-DOOR_OPEN_DEG}deg)`, filter: 'brightness(.45)' }], tutorialTiming.doorOpenMs, DOOR_OPEN_EASING),
      playKeyframes(lightRef.current, [{ opacity: 0 }, { opacity: 1 }], tutorialTiming.doorOpenMs, 'ease-in'),
    ]);
    // ③ 整面變白，停留後進入戰鬥
    await playKeyframes(whiteRef.current, [{ opacity: 0 }, { opacity: 1 }], tutorialTiming.doorWhiteFadeMs);
    await wait(tutorialTiming.whiteHoldMs);
    sceneRouter.replace('tutorialBattle');
  };

  return (
    <div className="scene" style={{ background: '#000' }} onPointerUp={startBattle}>
      <div ref={contentRef} style={fullLayer}>
        {/* 門後：中縫暗色門縫（開門瞬間看得到），以及透出的白光 */}
        <Sprite assetId={uiAsset('door2')} x={SEAM_X - 50} y={0} />
        <div ref={lightRef} style={{ ...fullLayer, background: '#fff', opacity: 0 }} />
        {/* 城門：外層提供 3D 透視 */}
        <div style={{ ...fullLayer, perspective: designUnit(DOOR_PERSPECTIVE) }}>
          <div ref={leftDoorRef} style={{ position: 'absolute', left: designUnit(SEAM_X - DOOR_WIDTH), top: 0, width: designUnit(DOOR_WIDTH), height: designUnit(DOOR_HEIGHT), transformOrigin: 'left center' }}>
            <Sprite assetId={uiAsset('door')} />
          </div>
          <div ref={rightDoorRef} style={{ position: 'absolute', left: designUnit(SEAM_X), top: 0, width: designUnit(DOOR_WIDTH), height: designUnit(DOOR_HEIGHT), transformOrigin: 'right center' }}>
            <Sprite assetId={uiAsset('door')} style={{ transform: 'scaleX(-1)' }} />
          </div>
        </div>
        {/* 門上的文字與按鈕（開門時先淡出） */}
        <div ref={textRef} style={fullLayer}>
          <div style={{ position: 'absolute', left: 0, top: designUnit(230), width: designUnit(480), height: designUnit(42), overflow: 'hidden' }}>
            <AtlasPartSprite atlasAssetId="UI等/界面/resources-iphonehd/ccbMenuPartsA" atlas={menuPartsA as Atlas} partIndex={TITLE_BAR_PART} rotationDeg={-90} centerX={240} centerY={21} scale={1} />
          </div>
          <TextLabel x={46} y={236} size={28} stroke={4}>故事</TextLabel>
          <TextLabel x={36} y={340} w={580} size={26} stroke={4} style={{ lineHeight: 1.62 }}>{STORY_TEXT}</TextLabel>
          <div ref={startButtonRef} style={fullLayer}><Sprite assetId={uiAsset('button_queststart')} x={82} y={812} /></div>
        </div>
      </div>
      {/* 中縫光芒（原版素材 door_flash） */}
      <div ref={sparkleRef} style={{ position: 'absolute', left: designUnit(SEAM_X - SPARKLE_SIZE / 2), top: designUnit(SPARKLE_Y - SPARKLE_SIZE / 2), width: designUnit(SPARKLE_SIZE), height: designUnit(SPARKLE_SIZE), opacity: 0 }}>
        <Sprite assetId={uiAsset('door_flash')} />
      </div>
      <div ref={whiteRef} style={{ ...fullLayer, background: '#fff', opacity: 0 }} />
    </div>
  );
}
