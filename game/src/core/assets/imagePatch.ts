/**
 * 以原圖自身的像素覆蓋原圖的一塊（例：用說明框的空白處蓋掉日文說明），不產生新像素。
 * 每個補丁：從 source 矩形取像素，平鋪到 target 矩形。結果以 dataURL 快取。
 */
import { getAssetUrl } from './assetLoader';

/** 矩形：[x, y, 寬, 高]（原圖像素） */
export type PixelRect = [number, number, number, number];
export interface PixelPatch { source: PixelRect; target: PixelRect }
const patchedCache = new Map<string, Promise<string>>();

export function createPatchedImage(assetId: string, patches: PixelPatch[]): Promise<string> {
  const cacheKey = assetId + JSON.stringify(patches);
  let result = patchedCache.get(cacheKey);
  if (!result) {
    result = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        for (const { source: [sx, sy, sw, sh], target: [tx, ty, tw, th] } of patches) {
          const tile = context.getImageData(sx, sy, sw, sh);
          for (let y = ty; y < ty + th; y += sh) for (let x = tx; x < tx + tw; x += sw) {
            context.putImageData(tile, x, y, 0, 0, Math.min(sw, tx + tw - x), Math.min(sh, ty + th - y));
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
