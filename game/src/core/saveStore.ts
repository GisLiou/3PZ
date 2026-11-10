/**
 * 存檔：本機儲存 key、版本遷移、存檔本體 saveStore（依序）。
 */
/**
 * 本機儲存（localStorage）的 key 一律由這裡產生，前綴統一為專案名稱（3PZ）。
 * 舊版前綴（日文簡稱「sanpazu」、英文全名「threeKingdomsPuzzleWars」）由 migrateLegacyStorageKeys() 在啟動時搬到新 key，舊存檔不會遺失。
 */

export const STORAGE_PREFIX = "3PZ";
/** 舊版前綴，越新的放越前面（同一筆資料以較新的為準） */
const LEGACY_PREFIXES = ["threeKingdomsPuzzleWars", "sanpazu"];

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
        if (value != null && localStorage.getItem(newKey) == null)
          localStorage.setItem(newKey, value);
        localStorage.removeItem(legacyKey);
      }
    }
  } catch {
    /* 隱私模式等無法使用 localStorage */
  }
}

/**
 * 存檔版本遷移：key＝舊版本號，函式把該版存檔升成下一版。
 * 新增欄位或改名時：SAVE_VERSION 加一，並在這裡補上「舊版 → 新版」的函式。
 */
type RawSave = Record<string, unknown>;
type Obj = Record<string, unknown>;

export const saveMigrations: Record<number, (save: RawSave) => RawSave> = {
  /** v1 → v2：欄位改用完整英文名稱（v→version、lv→level、gem→gems、bgm→bgmVolume…、starter→starterFaction） */
  1: (save) => {
    const {
      v: _version,
      starter,
      player = {},
      settings = {},
      ...rest
    } = save as Obj & { player?: Obj; settings?: Obj };
    const { lv, exp, gem, staminaAt, ...playerRest } = player;
    const { bgm, se, voice, voiceAsked, ...settingsRest } = settings;
    return {
      ...rest,
      version: 2,
      ...(starter !== undefined ? { starterFaction: starter } : {}),
      player: {
        ...playerRest,
        level: lv ?? 1,
        experience: exp ?? 0,
        gems: gem ?? 0,
        staminaUpdatedAt: staminaAt ?? Date.now(),
      },
      settings: {
        ...settingsRest,
        bgmVolume: bgm ?? 0.8,
        soundEffectVolume: se ?? 0.8,
        voiceVolume: voice ?? 1,
        voiceDownloadAsked: voiceAsked ?? false,
      },
    };
  },
};

/**
 * 存檔：每個帳號一份，帶版本號與遷移函式。
 * 本機存在 localStorage；帳號模組若接上雲端，會在登入／存檔時同步同一份 JSON。
 */
export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  /** 已完成的新手教學進度（0＝尚未完成教學戰鬥 1） */
  tutorialStep: number;
  /** 選擇的主角勢力（選擇武將畫面寫入） */
  starterFaction?: "wei" | "wu" | "shu";
  player: {
    name: string;
    level: number;
    experience: number;
    money: number;
    gems: number;
    stamina: number;
    staminaUpdatedAt: number;
  };
  settings: {
    bgmVolume: number;
    soundEffectVolume: number;
    voiceVolume: number;
    voiceDownloadAsked: boolean;
  };
  /** 之後的模組（武將、部隊、任務進度…）各自在這裡掛自己的欄位 */
  [field: string]: unknown;
}

export function createNewSave(): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    tutorialStep: 0,
    player: {
      name: "",
      level: 1,
      experience: 0,
      money: 0,
      gems: 0,
      stamina: 30,
      staminaUpdatedAt: now,
    },
    settings: {
      bgmVolume: 0.8,
      soundEffectVolume: 0.8,
      voiceVolume: 1,
      voiceDownloadAsked: false,
    },
  };
}

/** 讀進來的存檔逐版升級到目前版本 */
function migrateSave(raw: Record<string, unknown>): SaveData {
  let save = raw;
  let version = Number(save.version ?? save.v ?? 1);
  while (version < SAVE_VERSION) {
    save = saveMigrations[version]!(save);
    version++;
  }
  return save as SaveData;
}

const saveKey = (accountId: string) => storageKey(`save.${accountId}`);

class SaveStore {
  private accountId: string | null = null;
  data: SaveData = createNewSave();

  /** 切換到某個帳號的存檔（沒有存檔時建立新的） */
  load(accountId: string) {
    this.accountId = accountId;
    try {
      const raw = localStorage.getItem(saveKey(accountId));
      this.data = raw ? migrateSave(JSON.parse(raw)) : createNewSave();
    } catch {
      this.data = createNewSave();
    }
  }

  /** 修改存檔一律走這裡：修改後自動寫回並通知畫面 */
  update(modify: (data: SaveData) => void) {
    modify(this.data);
    this.data.updatedAt = Date.now();
    this.persist();
  }

  persist() {
    if (!this.accountId) return;
    try {
      localStorage.setItem(saveKey(this.accountId), JSON.stringify(this.data));
    } catch {
      /* 隱私模式等 */
    }
  }

  exportJson() {
    return JSON.stringify(this.data);
  }

  importJson(json: string) {
    this.data = migrateSave(JSON.parse(json));
    this.persist();
  }
}

export const saveStore = new SaveStore();
