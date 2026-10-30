/**
 * 素材載入：所有圖檔都由 tools/assets/build-assets.mjs 從「遊戲素材」轉成 webp，並產生 manifest.json。
 * 程式碼只用素材的原始相對路徑（例 'UI等/界面/resources-auto/button_close'）當素材 id，
 * 不直接寫網址，這樣素材換版本時只需要重跑轉檔。
 */
export interface AssetInfo { url: string; width: number; height: number }
/** manifest.json 的原始格式（由轉檔工具產生，欄位名稱為 w／h） */
type ManifestFile = Record<string, { url: string; w: number; h: number }>;

/** 素材根目錄：正式版 './'；開發版放在 /develop/，與正式版共用素材，建置時設 VITE_ASSET_ROOT='../' */
export const ASSET_ROOT: string = import.meta.env.VITE_ASSET_ROOT || './';
let manifest = new Map<string, AssetInfo>();
const imageCache = new Map<string, Promise<HTMLImageElement>>();

export async function loadAssetManifest(): Promise<void> {
  const response = await fetch(`${ASSET_ROOT}assets/manifest.json`);
  const file = (await response.json()) as ManifestFile;
  const rebase = (url: string) => (ASSET_ROOT === './' ? url : url.replace(/^\.\//, ASSET_ROOT));
  manifest = new Map(Object.entries(file).map(([id, entry]) => [id, { url: rebase(entry.url), width: entry.w, height: entry.h }]));
}

/** 取得素材資訊；id 不存在時丟錯，避免畫面默默缺圖 */
export function getAsset(id: string): AssetInfo {
  const info = manifest.get(id);
  if (!info) throw new Error(`素材不存在：${id}`);
  return info;
}

export const getAssetUrl = (id: string) => getAsset(id).url;

/** 素材原尺寸（設計單位） */
export function getAssetSize(id: string) {
  const { width, height } = getAsset(id);
  return { width, height };
}

/** 預先下載並解碼一組圖，onProgress 給讀取條使用 */
export async function preloadAssets(ids: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  let done = 0;
  await Promise.all(
    ids.map((id) => {
      let loading = imageCache.get(id);
      if (!loading) {
        loading = new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`載入失敗：${id}`));
          image.src = getAssetUrl(id);
        });
        imageCache.set(id, loading);
      }
      return loading.then(() => onProgress?.(++done, ids.length));
    }),
  );
}
