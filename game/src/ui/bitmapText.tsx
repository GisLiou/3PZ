/**
 * 點陣字：使用原版字型圖（遊戲素材/UI等/字體），字的座標由 _開發工具_不需修改/素材轉檔/slice-font.py 切出（src/data/font/*.json）。
 * 原版字型多為白字＋黑描邊，執行時上色；這裡用 canvas 做「乘色」：白→指定色、黑描邊維持黑，不產生新圖形。
 * 數字一直在變的地方（HP、傷害數字）用逐字排列：整張字型圖每種顏色只上色一次，每個字取其中一塊，不必每個字串重做一張圖（手機上才不會卡）。
 */
import { getAssetUrl } from "@core/assetLoader";
import { useEffect, useState, type CSSProperties } from "react";
import { designUnit } from "@core/stage";

interface Glyph {
  x: number;
  y: number;
  w: number;
  h: number;
  top: number;
}
interface BitmapFontDefinition {
  w: number;
  h: number;
  glyphs: Record<string, Glyph>;
}
/** 已上色的文字圖（width／height 為原字型像素） */
export interface RenderedText {
  url: string;
  width: number;
  height: number;
}

const fontFiles = import.meta.glob("/src/data/font/*.json", {
  eager: true,
  import: "default",
}) as Record<string, BitmapFontDefinition>;
/** 字型名稱（＝字型圖檔名，例 'BFBattleNum'）→ 切字座標 */
const FONTS: Record<string, BitmapFontDefinition> = Object.fromEntries(
  Object.entries(fontFiles).map(([path, definition]) => [
    path.split("/").pop()!.replace(".json", ""),
    definition,
  ]),
);
const fontImages = new Map<string, Promise<HTMLImageElement>>();
const renderedCache = new Map<string, RenderedText>();

const cacheKey = (
  font: string,
  text: string,
  color: string | undefined,
  spacing: number,
) => `${font}|${text}|${color ?? ""}|${spacing}`;

function loadFontImage(font: string) {
  let loading = fontImages.get(font);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = getAssetUrl(`UI等/字體/${font}`);
    });
    fontImages.set(font, loading);
  }
  return loading;
}

/** 已經畫過的字串直接取快取（沒有則 undefined） */
export const getCachedBitmapText = (
  font: string,
  text: string,
  color?: string,
  spacing = 0,
) => renderedCache.get(cacheKey(font, text, color, spacing));

// ---------- 逐字排列（數字一直在變的地方用：不必每個字串重做一張圖） ----------
/** 一個字在字串中的位置（原字型像素）與在字型圖中的位置 */
export interface PlacedGlyph {
  x: number;
  y: number;
  w: number;
  h: number;
  sourceX: number;
  sourceY: number;
}
/** 字串的排列：寬高（原字型像素）＋每個字的位置；字底對齊 */
export function layoutBitmapText(font: string, text: string, spacing = 0) {
  const definition = FONTS[font];
  if (!definition) throw new Error(`字型不存在：${font}`);
  const glyphs = [...text]
    .map((char) => definition.glyphs[char])
    .filter(Boolean) as Glyph[];
  const height = glyphs.length
    ? Math.max(...glyphs.map((glyph) => glyph.h))
    : 1;
  let x = 0;
  const placed: PlacedGlyph[] = glyphs.map((glyph) => {
    const item = {
      x,
      y: height - glyph.h,
      w: glyph.w,
      h: glyph.h,
      sourceX: glyph.x,
      sourceY: glyph.y,
    };
    x += glyph.w + spacing;
    return item;
  });
  return {
    width: Math.max(1, x - spacing),
    height,
    sheetWidth: definition.w,
    sheetHeight: definition.h,
    glyphs: placed,
  };
}

const tintedSheets = new Map<string, Promise<string>>();
const tintedSheetUrls = new Map<string, string>();
const sheetKey = (font: string, color?: string) => `${font}|${color ?? ""}`;
/** 整張字型圖上色後的網址（每種字型＋顏色只做一次） */
export function tintedFontSheet(font: string, color?: string): Promise<string> {
  const key = sheetKey(font, color);
  let loading = tintedSheets.get(key);
  if (!loading) {
    loading = loadFontImage(font).then((image) => {
      if (!color) return image.src;
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      tint(context, canvas.width, canvas.height, color);
      return canvas.toDataURL();
    });
    loading.then((url) => tintedSheetUrls.set(key, url)).catch(() => {});
    tintedSheets.set(key, loading);
  }
  return loading;
}
/** 已上色的字型圖網址（還沒做好則 undefined） */
export const getCachedFontSheet = (font: string, color?: string) =>
  tintedSheetUrls.get(sheetKey(font, color));

/** 把 element 的子元素排成字串（每個字一個 <i>，取上色字型圖的一塊）；scale＝設計單位／原字型像素 */
export function placeGlyphElements(
  element: HTMLElement,
  layout: ReturnType<typeof layoutBitmapText>,
  sheetUrl: string,
  scale: number,
) {
  const { glyphs } = layout;
  while (element.children.length > glyphs.length) element.lastChild!.remove();
  while (element.children.length < glyphs.length)
    element.appendChild(document.createElement("i"));
  glyphs.forEach((glyph, index) => {
    const child = element.children[index] as HTMLElement;
    Object.assign(child.style, {
      position: "absolute",
      left: designUnit(glyph.x * scale),
      top: designUnit(glyph.y * scale),
      width: designUnit(glyph.w * scale),
      height: designUnit(glyph.h * scale),
      backgroundImage: `url(${sheetUrl})`,
      backgroundSize: `${designUnit(layout.sheetWidth * scale)} ${designUnit(layout.sheetHeight * scale)}`,
      backgroundPosition: `${designUnit(-glyph.sourceX * scale)} ${designUnit(-glyph.sourceY * scale)}`,
      backgroundRepeat: "no-repeat",
    });
  });
}

/** 乘色：白→color、黑描邊維持黑 */
function tint(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
) {
  const imageData = context.getImageData(0, 0, width, height),
    pixels = imageData.data;
  const rgb = parseInt(color.slice(1), 16),
    red = (rgb >> 16) & 255,
    green = (rgb >> 8) & 255,
    blue = rgb & 255;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (pixels[i]! * red) / 255;
    pixels[i + 1] = (pixels[i + 1]! * green) / 255;
    pixels[i + 2] = (pixels[i + 2]! * blue) / 255;
  }
  context.putImageData(imageData, 0, 0);
}

/** 字串 → 已上色的圖（快取）。color 為 '#rrggbb' */
export async function renderBitmapText(
  font: string,
  text: string,
  color?: string,
  spacing = 0,
): Promise<RenderedText> {
  const key = cacheKey(font, text, color, spacing);
  const cached = renderedCache.get(key);
  if (cached) return cached;
  const definition = FONTS[font];
  if (!definition) throw new Error(`字型不存在：${font}`);
  const missing = [...text].filter((char) => !definition.glyphs[char]);
  if (missing.length) console.warn(`字型 ${font} 缺字：${missing.join("")}`);
  const glyphs = [...text]
    .map((char) => definition.glyphs[char])
    .filter(Boolean) as Glyph[];
  if (!glyphs.length) return { url: "", width: 1, height: 1 };
  const height = Math.max(...glyphs.map((glyph) => glyph.h));
  const width = glyphs.reduce(
    (sum, glyph) => sum + glyph.w + spacing,
    -spacing,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d")!;
  const image = await loadFontImage(font);
  let x = 0;
  for (const glyph of glyphs) {
    context.drawImage(
      image,
      glyph.x,
      glyph.y,
      glyph.w,
      glyph.h,
      x,
      height - glyph.h,
      glyph.w,
      glyph.h,
    );
    x += glyph.w + spacing;
  }
  if (color) tint(context, canvas.width, canvas.height, color);
  const rendered = { url: canvas.toDataURL(), width, height };
  renderedCache.set(key, rendered);
  return rendered;
}

/**
 * 顯示點陣字（React）。h＝顯示高度（設計單位），省略則用原字高。
 * anchor：x,y 代表的位置（'center' 置中、'right' 右對齊）。
 */
export interface BitmapTextProps {
  font: string;
  text: string;
  color?: string;
  h?: number;
  x?: number;
  y?: number;
  anchor?: "left" | "center" | "right";
  spacing?: number;
  style?: CSSProperties;
  className?: string;
}

export function BitmapText({
  font,
  text,
  color,
  h,
  x = 0,
  y = 0,
  anchor = "left",
  spacing = 0,
  style,
  className,
}: BitmapTextProps) {
  // 逐字排列（同一張上色字型圖），數字一直變時也不用每次重做圖
  const [sheetUrl, setSheetUrl] = useState(() =>
    getCachedFontSheet(font, color),
  );
  useEffect(() => {
    let mounted = true;
    void tintedFontSheet(font, color).then(
      (url) => mounted && setSheetUrl(url),
    );
    return () => {
      mounted = false;
    };
  }, [font, color]);
  if (!sheetUrl) return null;
  const layout = layoutBitmapText(font, text, spacing);
  const scale = h ? h / layout.height : 1,
    width = layout.width * scale,
    height = layout.height * scale;
  const left =
    anchor === "center" ? x - width / 2 : anchor === "right" ? x - width : x;
  return (
    <i
      className={className}
      style={{
        position: "absolute",
        left: designUnit(left),
        top: designUnit(y),
        width: designUnit(width),
        height: designUnit(height),
        display: "block",
        pointerEvents: "none",
        ...style,
      }}
    >
      {layout.glyphs.map((glyph, index) => (
        <i
          key={index}
          style={{
            position: "absolute",
            left: designUnit(glyph.x * scale),
            top: designUnit(glyph.y * scale),
            width: designUnit(glyph.w * scale),
            height: designUnit(glyph.h * scale),
            backgroundImage: `url(${sheetUrl})`,
            backgroundSize: `${designUnit(layout.sheetWidth * scale)} ${designUnit(layout.sheetHeight * scale)}`,
            backgroundPosition: `${designUnit(-glyph.sourceX * scale)} ${designUnit(-glyph.sourceY * scale)}`,
            backgroundRepeat: "no-repeat",
          }}
        />
      ))}
    </i>
  );
}
