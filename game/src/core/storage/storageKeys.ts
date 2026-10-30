/**
 * 本機儲存（localStorage）的 key 一律由這裡產生，前綴統一為專案名稱（3PZ）。
 * 舊版前綴（日文簡稱「sanpazu」、英文全名「threeKingdomsPuzzleWars」）由 migrateLegacyStorageKeys() 在啟動時搬到新 key，舊存檔不會遺失。
 */
export const STORAGE_PREFIX = '3PZ';
/** 舊版前綴，越新的放越前面（同一筆資料以較新的為準） */
const LEGACY_PREFIXES = ['threeKingdomsPuzzleWars', 'sanpazu'];

export const storageKey = (name: string) => `${STORAGE_PREFIX}.${name}`;

/** 舊 key（threeKingdomsPuzzleWars.xxx、sanpazu.xxx）→ 新 key（3PZ.xxx）；新 key 已有資料時不覆蓋。可重複呼叫。 */
export function migrateLegacyStorageKeys(): void {
  try {
    for (const legacyPrefix of LEGACY_PREFIXES) {
      const legacyKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${legacyPrefix}.`)) legacyKeys.push(key);
      }
      for (const legacyKey of legacyKeys) {
        const newKey = storageKey(legacyKey.slice(legacyPrefix.length + 1));
        const value = localStorage.getItem(legacyKey);
        if (value != null && localStorage.getItem(newKey) == null) localStorage.setItem(newKey, value);
        localStorage.removeItem(legacyKey);
      }
    }
  } catch {
    /* 隱私模式等無法使用 localStorage */
  }
}
