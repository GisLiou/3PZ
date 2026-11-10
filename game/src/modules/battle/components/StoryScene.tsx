/**
 * 故事（v5 89 460～108 507 ms）：城門背景、「故事」標題條、序文、合戰開始鈕；點擊後城門左右滑開、門縫透出白光，進入戰鬥。
 * 版面：城門 door.png 原尺寸 450×1200（1px＝1 設計單位），左扇 x=-130、右扇 x=320 左右翻轉、上緣 y=-80，鐵框在中縫相接；
 *   門後是 door2.png（門內的暗色，拉滿整個寬度），開門時從門縫露出；標題條 y230 高 42；序文左緣 36、首行 y340、字高 26；
 *   按鈕 button_queststart (82,812)。
 * 開門逐禎紀錄見 docs/復刻分析/02_教學戰鬥1.md §6（t＝按下後第一禎 104 013）：
 *   t+0 按鈕變亮並出現放大殘影 → t+53 按鈕消失 → t+107～214 文字淡出 → t+160 中縫出現白線，
 *   白光由中縫往兩側加寬（t+909 全白）→ t+267 兩扇門往外滑開（等加速，t+856 完全離開畫面）；
 *   中縫光芒 door_flash 由小變大，後段橫向拉長（以加亮混合疊在門上）。
 */
import { useEffect, useRef } from "react";
import { sceneRouter } from "@core/sceneRouter";
import { playKeyframes, wait } from "@core/animate";
import { audioService } from "@core/audioService";
import { designUnit } from "@core/stage";
import { getAssetSize, preloadAssets } from "@core/assetLoader";
import { BATTLE_INTRO_PRELOAD_ASSETS } from "../logic/battleAssets";
import { Sprite, TextLabel, uiAsset, AtlasPartSprite, type Atlas } from "@ui";
import menuPartsA from "@data/atlas/ccbMenuPartsA.json";

/** 故事畫面（開門）的演出時間（毫秒），來源 v5 亞修實況，逐禎紀錄見 docs/復刻分析/02_教學戰鬥1.md §6 */
const storyTiming = {
  /** 全白後停留到戰鬥畫面（v5 104 922 → 108 507 是讀取時間，這裡縮短） */
  whiteHoldMs: 600,
  /** 故事畫面淡入 */
  storyFadeInMs: 430,
  /** 故事畫面「合戰開始」鈕亮度呼吸週期（89 888 → 91 172 → 92 456） */
  storyButtonPulseMs: 1284,
  // ---- 故事畫面按下「合戰開始」後（以下延遲都從按下後第一禎 v5 104 013 起算，逐禎紀錄見 docs/復刻分析/02_教學戰鬥1.md §6） ----
  /** 按鈕變亮＋放大殘影，一禎後消失（104 013 → 104 066） */
  storyButtonFlashMs: 53,
  /** 文字開始淡出（104 120）與淡出時間（104 120 → 104 227） */
  storyTextFadeDelayMs: 107,
  storyTextFadeMs: 107,
  /** 中縫白線出現（104 173）；白光加寬到全白的時間在 StoryScene 的逐禎表（104 173 → 104 922） */
  doorLightDelayMs: 160,
  /** 兩扇門開始滑開（104 280）與滑出畫面的時間（104 280 → 104 869，等加速） */
  doorSlideDelayMs: 267,
  doorSlideMs: 589,
} as const;

const STORY_TEXT =
  "時間往前追溯到一千八百多年前。\n\n漢朝末期因外戚與宦官干政，紊亂朝綱\n使得民不聊生，苦不堪言。\n\n此時，\n英雄豪傑為拯救天下而奮起......。";
/** 「故事」標題條：ccbMenuPartsA 圖集的零件 4（轉 90° 存放） */
const TITLE_BAR_PART = 4;
/** 城門單扇原尺寸（設計單位） */
const DOOR_WIDTH = 450;
const DOOR_HEIGHT = 1200;
/** 城門上緣 y（v5 104 280 與復刻畫面比對：門的鉚釘、橫向鐵條位置吻合時為 -80） */
const DOOR_TOP = -80;
/** 兩扇門相接的中縫 x */
const SEAM_X = 320;
/** 門滑開的距離：左扇右緣滑到畫面左緣外（v5：等加速，104 280 → 104 869 約 356） */
const DOOR_SLIDE_DISTANCE = 356;
/** 等加速（位移與時間平方成正比）的貝茲曲線 */
const EASE_IN_QUAD = "cubic-bezier(.333,0,.667,.333)";
/** 中縫光芒 door_flash（494×494）的大小與中心 y（v5 104 387 量測） */
const SPARKLE_SIZE = 494;
const SPARKLE_Y = 517;
/** 白光元件寬度：核心（全白）佔中間 1/1.4，兩側各 0.2 為柔光；scaleX＝核心半寬 / 320 */
const LIGHT_SPREAD = 1.4;
const LIGHT_WIDTH = 640 * LIGHT_SPREAD;
const LIGHT_EDGE_PERCENT = ((LIGHT_SPREAD - 1) / 2 / LIGHT_SPREAD) * 100;

/**
 * 白光核心半寬（設計單位）逐禎量測：[時間 ms, 半寬, 不透明度]；時間從 104 173（白線出現）起算，104 922 全白
 */
const LIGHT_FRAMES: [number, number, number][] = [
  [104173, 1, 0.6],
  [104227, 1, 1],
  [104280, 3, 1],
  [104334, 4.5, 1],
  [104387, 8, 1],
  [104441, 17, 1],
  [104494, 29, 1],
  [104548, 47, 1],
  [104601, 70, 1],
  [104655, 100, 1],
  [104708, 132, 1],
  [104762, 171, 1],
  [104815, 215, 1],
  [104869, 272, 1],
  [104922, 320, 1],
];
/**
 * 中縫光芒逐禎估計：[時間 ms, 縮放 x, 縮放 y, 不透明度]。
 * 以錄影中光芒射線的長度與門上 x150～250、y480～560 一塊的亮度比對調整（誤差約一禎）。
 */
const SPARKLE_FRAMES: [number, number, number, number][] = [
  [104280, 0, 0, 0],
  [104334, 0.1, 0.1, 1],
  [104387, 0.2, 0.2, 1],
  [104441, 0.45, 0.45, 1],
  [104494, 0.7, 0.7, 1],
  [104548, 0.85, 0.85, 1],
  [104601, 1, 1, 1],
  [104655, 1.15, 1.15, 0.9],
  [104708, 1.3, 1.3, 0.8],
  [104762, 2.2, 1.1, 0.7],
  [104815, 2.6, 1.1, 0.6],
  [104869, 3, 1.1, 0.5],
  [104922, 3, 1.1, 0],
];

/** 逐禎表 → Web Animations 關鍵影格（offset 依時間換算） */
function toKeyframes<T extends unknown[]>(
  frames: [number, ...T][],
  toKeyframe: (...values: T) => Keyframe,
): { keyframes: Keyframe[]; durationMs: number } {
  const start = frames[0]![0],
    durationMs = frames[frames.length - 1]![0] - start;
  return {
    durationMs,
    keyframes: frames.map(([time, ...values]) => ({
      ...toKeyframe(...values),
      offset: (time - start) / durationMs,
    })),
  };
}
const LIGHT_ANIMATION = toKeyframes(LIGHT_FRAMES, (halfWidth, opacity) => ({
  transform: `scaleX(${halfWidth / 320})`,
  opacity,
}));
const SPARKLE_ANIMATION = toKeyframes(
  SPARKLE_FRAMES,
  (scaleX, scaleY, opacity) => ({
    transform: `scale(${scaleX},${scaleY})`,
    opacity,
  }),
);

const fullLayer = { position: "absolute", inset: 0 } as const;
/** 「合戰開始」按鈕 button_queststart 的左上角 */
const START_BUTTON_X = 82,
  START_BUTTON_Y = 812;

export function StoryScene() {
  const startButtonSize = getAssetSize(uiAsset("button_queststart"));
  const contentRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const leftDoorRef = useRef<HTMLDivElement>(null);
  const rightDoorRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLDivElement>(null);
  const buttonGhostRef = useRef<HTMLDivElement>(null);
  const isStarting = useRef(false);
  const pulseRef = useRef<Animation | null>(null);

  useEffect(() => {
    // 讀故事的時間先把戰鬥畫面的背景等圖載好，開門後戰鬥畫面才能立刻完整出現
    void preloadAssets(BATTLE_INTRO_PRELOAD_ASSETS).catch(() => {});
    void playKeyframes(
      contentRef.current,
      [{ opacity: 0 }, { opacity: 1 }],
      storyTiming.storyFadeInMs,
    );
    const pulse = (pulseRef.current = startButtonRef.current!.animate(
      [
        { filter: "brightness(.85)" },
        { filter: "brightness(1.25)" },
        { filter: "brightness(.85)" },
      ],
      { duration: storyTiming.storyButtonPulseMs, iterations: Infinity },
    ));
    return () => pulse.cancel();
  }, []);

  const startBattle = async () => {
    if (isStarting.current) return;
    isStarting.current = true;
    audioService.unlock();
    const timing = storyTiming;
    // t+0：按鈕變亮並出現放大殘影，一禎後消失
    pulseRef.current?.cancel();
    startButtonRef.current!.style.filter = "brightness(1.6)";
    buttonGhostRef.current!.style.display = "block";
    void wait(timing.storyButtonFlashMs).then(() => {
      startButtonRef.current!.style.display = "none";
      buttonGhostRef.current!.style.display = "none";
    });
    // t+107～214：文字淡出
    void wait(timing.storyTextFadeDelayMs).then(() =>
      playKeyframes(
        textRef.current,
        [{ opacity: 1 }, { opacity: 0 }],
        timing.storyTextFadeMs,
      ),
    );
    // t+160：中縫白光；t+267：兩扇門往外滑開；光芒同時放大
    const light = wait(timing.doorLightDelayMs).then(() =>
      playKeyframes(
        lightRef.current,
        LIGHT_ANIMATION.keyframes,
        LIGHT_ANIMATION.durationMs,
      ),
    );
    const doors = wait(timing.doorSlideDelayMs).then(() =>
      Promise.all([
        playKeyframes(
          leftDoorRef.current,
          [
            { transform: "translateX(0)" },
            { transform: `translateX(${designUnit(-DOOR_SLIDE_DISTANCE)})` },
          ],
          timing.doorSlideMs,
          EASE_IN_QUAD,
        ),
        playKeyframes(
          rightDoorRef.current,
          [
            { transform: "translateX(0)" },
            { transform: `translateX(${designUnit(DOOR_SLIDE_DISTANCE)})` },
          ],
          timing.doorSlideMs,
          EASE_IN_QUAD,
        ),
        playKeyframes(
          sparkleRef.current,
          SPARKLE_ANIMATION.keyframes,
          SPARKLE_ANIMATION.durationMs,
        ),
      ]),
    );
    await Promise.all([light, doors]);
    await wait(timing.whiteHoldMs);
    sceneRouter.replace("battle", { stage: "tutorial1" });
  };

  const doorStyle = (left: number) =>
    ({
      position: "absolute",
      left: designUnit(left),
      top: designUnit(DOOR_TOP),
      width: designUnit(DOOR_WIDTH),
      height: designUnit(DOOR_HEIGHT),
    }) as const;
  return (
    <div className="scene" style={{ background: "#000" }}>
      <div ref={contentRef} style={fullLayer}>
        {/* 門後：門內的暗色（door2 拉滿寬度），開門時從門縫露出 */}
        <Sprite
          assetId={uiAsset("door2")}
          x={0}
          y={DOOR_TOP}
          w={640}
          h={DOOR_HEIGHT}
        />
        {/* 中縫白光：中間全白、兩側柔光，以 scaleX 由中縫往兩側加寬 */}
        <div
          ref={lightRef}
          style={{
            position: "absolute",
            left: designUnit(SEAM_X - LIGHT_WIDTH / 2),
            top: 0,
            width: designUnit(LIGHT_WIDTH),
            height: "100%",
            opacity: 0,
            transform: "scaleX(0)",
            background: `linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,.25) ${LIGHT_EDGE_PERCENT}%, #fff ${LIGHT_EDGE_PERCENT}%, #fff ${100 - LIGHT_EDGE_PERCENT}%, rgba(255,255,255,.25) ${100 - LIGHT_EDGE_PERCENT}%, rgba(255,255,255,0) 100%)`,
          }}
        />
        {/* 城門兩扇 */}
        <div ref={leftDoorRef} style={doorStyle(SEAM_X - DOOR_WIDTH)}>
          <Sprite assetId={uiAsset("door")} />
        </div>
        <div ref={rightDoorRef} style={doorStyle(SEAM_X)}>
          <Sprite
            assetId={uiAsset("door")}
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
        {/* 門上的文字與按鈕 */}
        <div ref={textRef} style={fullLayer}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: designUnit(230),
              width: designUnit(480),
              height: designUnit(42),
              overflow: "hidden",
            }}
          >
            <AtlasPartSprite
              atlasAssetId="UI等/界面/resources-iphonehd/ccbMenuPartsA"
              atlas={menuPartsA as Atlas}
              partIndex={TITLE_BAR_PART}
              rotationDeg={-90}
              centerX={240}
              centerY={21}
              scale={1}
            />
          </div>
          <TextLabel x={46} y={236} size={28} stroke={4}>
            故事
          </TextLabel>
          <TextLabel
            x={36}
            y={340}
            w={580}
            size={26}
            stroke={4}
            style={{ lineHeight: 1.62 }}
          >
            {STORY_TEXT}
          </TextLabel>
        </div>
        <div ref={startButtonRef} style={fullLayer}>
          <Sprite
            assetId={uiAsset("button_queststart")}
            x={START_BUTTON_X}
            y={START_BUTTON_Y}
          />
        </div>
        {/* 按下時的放大殘影（v5 104 013） */}
        <div
          ref={buttonGhostRef}
          style={{
            ...fullLayer,
            display: "none",
            opacity: 0.5,
            filter: "brightness(1.8)",
            transform: "scale(1.06)",
            transformOrigin: `${designUnit(321)} ${designUnit(873)}`,
          }}
        >
          <Sprite
            assetId={uiAsset("button_queststart")}
            x={START_BUTTON_X}
            y={START_BUTTON_Y}
          />
        </div>
      </div>
      {/* 中縫光芒（原版素材 door_flash）：疊兩層加亮混合，射線才會像錄影一樣明顯（原版應為加法混合） */}
      <div
        ref={sparkleRef}
        style={{
          position: "absolute",
          left: designUnit(SEAM_X - SPARKLE_SIZE / 2),
          top: designUnit(SPARKLE_Y - SPARKLE_SIZE / 2),
          width: designUnit(SPARKLE_SIZE),
          height: designUnit(SPARKLE_SIZE),
          opacity: 0,
        }}
      >
        <Sprite
          assetId={uiAsset("door_flash")}
          style={{ mixBlendMode: "plus-lighter" }}
        />
        <Sprite
          assetId={uiAsset("door_flash")}
          style={{ mixBlendMode: "plus-lighter" }}
        />
      </div>
      {/* 只有「合戰開始」按鈕可以按（透明的按鈕範圍，蓋在最上層） */}
      <i
        onPointerUp={startBattle}
        style={{
          position: "absolute",
          left: designUnit(START_BUTTON_X),
          top: designUnit(START_BUTTON_Y),
          width: designUnit(startButtonSize.width),
          height: designUnit(startButtonSize.height),
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      />
    </div>
  );
}
