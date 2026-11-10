/**
 * 選擇武將（v5 60 621～86 035 ms）。版面量測自 63 000 ms（錄影 540 寬 ×1.185 → 640 設計單位）：
 *   標題列 y60　武將圖 tutorial_chara_* (2,127)　箭頭 button_arrowL/R y521 縮 0.68
 *   確認框 tutorial_kakunin (0,758)　按鈕 button_small_2 / button_small (22,877)(360,877)
 * 動作：進入時箭頭先出現（60 621），內容 214 ms 由暗變亮（60 621 → 60 835）；
 *       換頁為橫向滑動 428 ms（64 526 → 64 954）。
 * 原圖中的日文名字與說明以圖中空白處的像素覆蓋後，改顯示中文（自製素材 README #7）。
 */
import { playKeyframes } from "@core/animate";
import { getAssetUrl } from "@core/assetLoader";
import { sceneRouter } from "@core/sceneRouter";
import { designUnit } from "@core/stage";
import { saveStore } from "@core/saveStore";
import { Sprite, SpriteButton, TextLabel, uiAsset } from "@ui";
import { useEffect, useRef, useState } from "react";
import starterData from "@data/starterGenerals.json";
import { flushSync } from "react-dom";

/** 主角三選一（data/starterGenerals.json） */
type StarterGeneral = (typeof starterData.generals)[number];
const STARTER_GENERALS = starterData.generals;

/** 演出時間（毫秒），來源 v5 亞修實況（每禎 53.5 ms） */
const starterSelectTiming = {
  /** 內容由暗變亮（v5 60 621 → 60 835） */
  starterContentFadeMs: 214,
  /** 換頁橫向滑動（v5 64 526 → 64 954） */
  starterPageSlideMs: 428,
  /** 左右箭頭來回晃動一輪（暫定值，待對照 v5 60 621 ms 之後的錄影） */
  starterArrowSwayMs: 800,
} as const;

/** 蓋掉原圖的日文：名字（黑底標籤）與說明框內文 */
const JAPANESE_TEXT_COVERS: PixelPatch[] = [
  { source: [160, 360, 50, 30], target: [56, 360, 104, 30] },
  { source: [62, 404, 22, 12], target: [60, 402, 528, 178] },
];
/** 手指橫向滑動超過這個距離（px）就換頁 */
const SWIPE_THRESHOLD_PX = 40;
/** 箭頭晃動距離（設計單位，往外側；暫定值，待對照錄影） */
const ARROW_SWAY_DISTANCE = 15;

function StarterPage({ starter }: { starter: StarterGeneral }) {
  const [imageUrl, setImageUrl] = useState("");
  useEffect(() => {
    void createPatchedImage(
      uiAsset(`tutorial_chara_${starter.assetCode}`),
      JAPANESE_TEXT_COVERS,
    ).then(setImageUrl);
  }, [starter.assetCode]);

  return (
    <div
      style={{
        position: "absolute",
        left: designUnit(2),
        top: designUnit(127),
        width: designUnit(636),
        height: designUnit(624),
      }}
    >
      {imageUrl && (
        <i
          style={{
            position: "absolute",
            inset: 0,
            background: `url(${imageUrl}) 0 0/100% 100%`,
          }}
        />
      )}
      <TextLabel x={62} y={360} size={26} stroke={4}>
        {starter.name}
      </TextLabel>
      <TextLabel
        x={82}
        y={410}
        w={490}
        size={26}
        stroke={4}
        style={{ lineHeight: 1.5 }}
      >
        {starter.description}
      </TextLabel>
    </div>
  );
}

export function StarterSelectScene() {
  const [pageIndex, setPageIndex] = useState(1);
  const pagesRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isSliding = useRef(false);
  const swipeStartX = useRef<number | null>(null);
  useEffect(() => {
    void playKeyframes(
      contentRef.current,
      [{ filter: "brightness(0)" }, { filter: "brightness(1)" }],
      starterSelectTiming.starterContentFadeMs,
    );
  }, []);

  const leftArrowRef = useRef<HTMLDivElement>(null);
  const rightArrowRef = useRef<HTMLDivElement>(null);
  // 左右箭頭往外側來回晃動（無限循環），離開畫面時停止
  useEffect(() => {
    const sway = (element: HTMLElement | null, direction: -1 | 1) =>
      element?.animate(
        [
          { transform: "translateX(0)" },
          {
            transform: `translateX(${designUnit(ARROW_SWAY_DISTANCE * direction)})`,
          },
          { transform: "translateX(0)" },
        ],
        {
          duration: starterSelectTiming.starterArrowSwayMs,
          iterations: Infinity,
          easing: "ease-in-out",
        },
      );
    const animations = [
      sway(leftArrowRef.current, 1),
      sway(rightArrowRef.current, -1),
    ];
    return () => animations.forEach((animation) => animation?.cancel());
  }, []);

  /** 往左（-1）或往右（+1）換頁 */
  const turnPage = async (direction: number) => {
    if (isSliding.current) return;
    isSliding.current = true;
    await playKeyframes(
      pagesRef.current,
      [
        { transform: "translateX(0)" },
        { transform: `translateX(${designUnit(-640 * direction)})` },
      ],
      starterSelectTiming.starterPageSlideMs,
      "ease-out",
    );
    // 先同步把頁序換好（flushSync 立刻更新 DOM），再取消動畫：兩件事在同一格完成，不會閃回舊頁
    flushSync(() => setPageIndex((index) => (index + direction + 3) % 3));
    pagesRef
      .current!.getAnimations()
      .forEach((animation) => animation.cancel());
    isSliding.current = false;
  };

  const starter = STARTER_GENERALS[pageIndex]!;
  /** 某位武將的頁面相對於目前頁的位置：-1 左、0 中、1 右 */
  const pageOffset = (starterIndex: number) =>
    ((starterIndex - pageIndex + 4) % 3) - 1;

  const confirm = () => {
    saveStore.update((data) => {
      data.starterFaction = starter.faction as typeof data.starterFaction;
    });
    sceneRouter.replace("story");
  };
  return (
    <div className="scene" style={{ background: "#000" }}>
      <div
        ref={contentRef}
        style={{ position: "absolute", inset: 0 }}
        onPointerDown={(event) => (swipeStartX.current = event.clientX)}
        onPointerUp={(event) => {
          const startX = swipeStartX.current;
          if (
            startX != null &&
            Math.abs(event.clientX - startX) > SWIPE_THRESHOLD_PX
          )
            void turnPage(event.clientX < startX ? 1 : -1);
          swipeStartX.current = null;
        }}
      >
        <Sprite
          assetId={uiAsset("background001")}
          x={-130}
          y={0}
          w={900}
          h={1200}
        />
        <Sprite assetId={uiAsset("caption_02")} x={22} y={60} />
        <TextLabel x={56} y={82} size={38} stroke={6}>
          選擇武將
        </TextLabel>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: designUnit(640),
            height: designUnit(760),
            overflow: "hidden",
          }}
        >
          <div ref={pagesRef} style={{ position: "absolute", inset: 0 }}>
            {STARTER_GENERALS.map((general, index) => (
              // key 用武將代號：換頁時 React 只移動位置，圖片不會重新處理
              <div
                key={general.assetCode}
                style={{
                  position: "absolute",
                  left: designUnit(640 * pageOffset(index)),
                  top: 0,
                  width: designUnit(640),
                  height: "100%",
                }}
              >
                <StarterPage starter={general} />
              </div>
            ))}
          </div>
        </div>
        <Sprite assetId={uiAsset("tutorial_kakunin")} x={0} y={775} />
        <TextLabel
          x={0}
          w={640}
          y={795}
          size={30}
          align="center"
          stroke={4}
        >{`要與【${starter.name}】一起取得天下嗎？`}</TextLabel>
        <TextLabel
          x={0}
          w={640}
          y={840}
          size={26}
          align="center"
          stroke={4}
          color="#ff2a2a"
        >
          ＊選擇後將會與他一起征戰天下。
        </TextLabel>
        <SpriteButton
          assetId={uiAsset("button_small_2")}
          pressedAssetId={uiAsset("button_small_2_dark")}
          x={36}
          y={885}
          onTap={confirm}
        >
          <TextLabel
            x={0}
            w={260}
            y={18}
            size={30}
            align="center"
            stroke={5}
            strokeColor="#3a0806"
          >
            選擇這名武將
          </TextLabel>
        </SpriteButton>
        <SpriteButton
          assetId={uiAsset("button_small")}
          pressedAssetId={uiAsset("button_small_dark")}
          x={344}
          y={877}
          onTap={() => void turnPage(1)}
        >
          <TextLabel
            x={0}
            w={260}
            y={18}
            size={30}
            align="center"
            stroke={5}
            strokeColor="#082438"
          >
            選擇其他武將
          </TextLabel>
        </SpriteButton>
      </div>
      <div ref={leftArrowRef} style={{ position: "absolute", left: 0, top: 0 }}>
        <SpriteButton
          assetId={uiAsset("button_arrowL")}
          pressedAssetId={uiAsset("button_arrowL_dark")}
          x={0}
          y={521}
          w={53}
          h={61}
          onTap={() => void turnPage(-1)}
        />
      </div>
      <div
        ref={rightArrowRef}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <SpriteButton
          assetId={uiAsset("button_arrowR")}
          pressedAssetId={uiAsset("button_arrowR_dark")}
          x={587}
          y={521}
          w={53}
          h={61}
          onTap={() => void turnPage(1)}
        />
      </div>
    </div>
  );
}

/**
 * 圖片補丁：以原圖自身的像素覆蓋原圖的一塊（例：用說明框的空白處蓋掉日文說明），不產生新像素。
 * 每個補丁：從 source 矩形取像素，平鋪到 target 矩形。結果以 dataURL 快取。
 */
/** 矩形：[x, y, 寬, 高]（原圖像素） */
type PixelRect = [number, number, number, number];
interface PixelPatch {
  source: PixelRect;
  target: PixelRect;
}
const patchedCache = new Map<string, Promise<string>>();

function createPatchedImage(
  assetId: string,
  patches: PixelPatch[],
): Promise<string> {
  const cacheKey = assetId + JSON.stringify(patches);
  let result = patchedCache.get(cacheKey);
  if (!result) {
    result = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        for (const {
          source: [sx, sy, sw, sh],
          target: [tx, ty, tw, th],
        } of patches) {
          const tile = context.getImageData(sx, sy, sw, sh);
          for (let y = ty; y < ty + th; y += sh)
            for (let x = tx; x < tx + tw; x += sw) {
              context.putImageData(
                tile,
                x,
                y,
                0,
                0,
                Math.min(sw, tx + tw - x),
                Math.min(sh, ty + th - y),
              );
            }
        }
        resolve(canvas.toDataURL());
      };
      image.onerror = reject;
      image.src = getAssetUrl(assetId);
    });
    patchedCache.set(cacheKey, result);
  }
  return result;
}
