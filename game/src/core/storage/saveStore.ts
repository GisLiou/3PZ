/**
 * 存檔：每個帳號一份，帶版本號與遷移函式。
 * 本機存在 localStorage；帳號模組若接上雲端，會在登入／存檔時同步同一份 JSON。
 */
import { eventBus } from '@core/events/eventBus';
import { saveMigrations } from './saveMigrations';
import { storageKey } from './storageKeys';

export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  /** 已完成的新手教學進度（0＝尚未完成教學戰鬥 1） */
  tutorialStep: number;
  /** 選擇的主角勢力（選擇武將畫面寫入） */
  starterFaction?: 'wei' | 'wu' | 'shu';
  player: { name: string; level: number; experience: number; money: number; gems: number; stamina: number; staminaUpdatedAt: number };
  settings: { bgmVolume: number; soundEffectVolume: number; voiceVolume: number; voiceDownloadAsked: boolean };
  /** 之後的模組（武將、部隊、任務進度…）各自在這裡掛自己的欄位 */
  [field: string]: unknown;
}

export function createNewSave(): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION, createdAt: now, updatedAt: now, tutorialStep: 0,
    player: { name: '', level: 1, experience: 0, money: 0, gems: 0, stamina: 30, staminaUpdatedAt: now },
    settings: { bgmVolume: 0.8, soundEffectVolume: 0.8, voiceVolume: 1, voiceDownloadAsked: false },
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
    eventBus.emit('save:changed', undefined);
  }

  /** 修改存檔一律走這裡：修改後自動寫回並通知畫面 */
  update(modify: (data: SaveData) => void) {
    modify(this.data);
    this.data.updatedAt = Date.now();
    this.persist();
    eventBus.emit('save:changed', undefined);
  }

  persist() {
    if (!this.accountId) return;
    try { localStorage.setItem(saveKey(this.accountId), JSON.stringify(this.data)); } catch { /* 隱私模式等 */ }
  }

  exportJson() { return JSON.stringify(this.data); }

  importJson(json: string) {
    this.data = migrateSave(JSON.parse(json));
    this.persist();
    eventBus.emit('save:changed', undefined);
  }
}

export const saveStore = new SaveStore();
