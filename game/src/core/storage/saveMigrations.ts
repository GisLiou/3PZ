/**
 * 存檔版本遷移：key＝舊版本號，函式把該版存檔升成下一版。
 * 新增欄位或改名時：SAVE_VERSION 加一，並在這裡補上「舊版 → 新版」的函式。
 */
type RawSave = Record<string, unknown>;
type Obj = Record<string, unknown>;

export const saveMigrations: Record<number, (save: RawSave) => RawSave> = {
  /** v1 → v2：欄位改用完整英文名稱（v→version、lv→level、gem→gems、bgm→bgmVolume…、starter→starterFaction） */
  1: (save) => {
    const { v: _version, starter, player = {}, settings = {}, ...rest } = save as Obj & { player?: Obj; settings?: Obj };
    const { lv, exp, gem, staminaAt, ...playerRest } = player;
    const { bgm, se, voice, voiceAsked, ...settingsRest } = settings;
    return {
      ...rest,
      version: 2,
      ...(starter !== undefined ? { starterFaction: starter } : {}),
      player: { ...playerRest, level: lv ?? 1, experience: exp ?? 0, gems: gem ?? 0, staminaUpdatedAt: staminaAt ?? Date.now() },
      settings: { ...settingsRest, bgmVolume: bgm ?? 0.8, soundEffectVolume: se ?? 0.8, voiceVolume: voice ?? 1, voiceDownloadAsked: voiceAsked ?? false },
    };
  },
};
