import { describe, expect, it } from 'vitest';
import { saveMigrations } from './saveMigrations';

describe('存檔遷移 v1 → v2', () => {
  it('欄位改名後數值不變', () => {
    const v1 = {
      v: 1, createdAt: 1, updatedAt: 2, tutorialStep: 1, starter: 'wu',
      player: { name: '玩家', lv: 3, exp: 40, money: 5, gem: 6, stamina: 30, staminaAt: 7 },
      settings: { bgm: 0.5, se: 0.4, voice: 0.3, voiceAsked: true },
    };
    expect(saveMigrations[1]!(v1)).toEqual({
      version: 2, createdAt: 1, updatedAt: 2, tutorialStep: 1, starterFaction: 'wu',
      player: { name: '玩家', level: 3, experience: 40, money: 5, gems: 6, stamina: 30, staminaUpdatedAt: 7 },
      settings: { bgmVolume: 0.5, soundEffectVolume: 0.4, voiceVolume: 0.3, voiceDownloadAsked: true },
    });
  });
  it('沒選主角時不產生 starterFaction', () => {
    const migrated = saveMigrations[1]!({ v: 1, player: {}, settings: {} });
    expect('starterFaction' in migrated).toBe(false);
  });
});
