/**
 * 點陣字：使用原版字型圖（遊戲素材/UI等/字體），字的座標由 tools/assets/slice-font.py 切出（src/data/font/*.json）。
 * 原版字型多為白字＋黑描邊，執行時上色；這裡用 canvas 做「乘色」：白→指定色、黑描邊維持黑，不產生新圖形。
 */
import { getAssetUrl } from '@core/assets/assetLoader';

interface Glyph { x: number; y: number; w: number; h: number; top: number }
interface BitmapFontDefinition { w: number; h: number; glyphs: Record<string, Glyph> }
/** 已上色的文字圖（width／height 為原字型像素） */
export interface RenderedText { url: string; width: number; height: number }

const fontFiles = import.meta.glob('../../data/font/*.json', { eager: true, import: 'default' }) as Record<string, BitmapFontDefinition>;
/** 字型名稱（＝字型圖檔名，例 'BFBattleNum'）→ 切字座標 */
const FONTS: Record<string, BitmapFontDefinition> = Object.fromEntries(
  Object.entries(fontFiles).map(([path, definition]) => [path.split('/').pop()!.replace('.json', ''), definition]),
);
const fontImages = new Map<string, Promise<HTMLImageElement>>();
const renderedCache = new Map<string, RenderedText>();

const cacheKey = (font: string, text: string, color: string | undefined, spacing: number) => `${font}|${text}|${color ?? ''}|${spacing}`;

function loadFontImage(font: string) {
  let loading = fontImages.get(font);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image); image.onerror = reject;
      image.src = getAssetUrl(`UI等/字體/${font}`);
    });
    fontImages.set(font, loading);
  }
  return loading;
}

/** 已經畫過的字串直接取快取（沒有則 undefined） */
export const getCachedBitmapText = (font: string, text: string, color?: string, spacing = 0) => renderedCache.get(cacheKey(font, text, color, spacing));

/** 字串 → 已上色的圖（快取）。color 為 '#rrggbb' */
export async function renderBitmapText(font: string, text: string, color?: string, spacing = 0): Promise<RenderedText> {
  const key = cacheKey(font, text, color, spacing);
  const cached = renderedCache.get(key);
  if (cached) return cached;
  const definition = FONTS[font];
  if (!definition) throw new Error(`字型不存在：${font}`);
  const missing = [...text].filter((char) => !definition.glyphs[char]);
  if (missing.length) console.warn(`字型 ${font} 缺字：${missing.join('')}`);
  const glyphs = [...text].map((char) => definition.glyphs[char]).filter(Boolean) as Glyph[];
  if (!glyphs.length) return { url: '', width: 1, height: 1 };
  const height = Math.max(...glyphs.map((glyph) => glyph.h));
  const width = glyphs.reduce((sum, glyph) => sum + glyph.w + spacing, -spacing);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
  const context = canvas.getContext('2d')!;
  const image = await loadFontImage(font);
  let x = 0;
  for (const glyph of glyphs) { context.drawImage(image, glyph.x, glyph.y, glyph.w, glyph.h, x, height - glyph.h, glyph.w, glyph.h); x += glyph.w + spacing; }
  if (color) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height), pixels = imageData.data;
    const rgb = parseInt(color.slice(1), 16), red = (rgb >> 16) & 255, green = (rgb >> 8) & 255, blue = rgb & 255;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = (pixels[i]! * red) / 255; pixels[i + 1] = (pixels[i + 1]! * green) / 255; pixels[i + 2] = (pixels[i + 2]! * blue) / 255;
    }
    context.putImageData(imageData, 0, 0);
  }
  const rendered = { url: canvas.toDataURL(), width, height };
  renderedCache.set(key, rendered);
  return rendered;
}
