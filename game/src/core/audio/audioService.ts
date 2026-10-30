/**
 * 音訊：背景音樂（循環、切換時淡入淡出）、音效、武將語音。
 * 語音不在安裝包內，播放前向語音包模組取得已下載的檔案；未下載時靜音略過。
 * 手機瀏覽器需要使用者第一次觸碰後才能出聲，unlock() 在第一次觸碰時呼叫。
 */
import { saveStore } from "@core/storage/saveStore";
import { ASSET_ROOT } from "@core/assets/assetLoader";

const BGM_FADE_IN_MS = 400;
const BGM_FADE_OUT_MS = 300;

class AudioService {
  private bgm: HTMLAudioElement | null = null;
  private bgmId = "";
  unlocked = false;

  constructor() {
    // 遊戲被切到背景（視窗最小化、切換分頁、手機回到桌面）時暫停背景音樂，回來時繼續
    document.addEventListener("visibilitychange", () =>
      this.handleVisibilityChange(document.hidden),
    );
  }

  private handleVisibilityChange(isHidden: boolean) {
    if (!this.bgm) return;
    if (isHidden) this.bgm.pause();
    else if (this.unlocked) void this.bgm.play().catch(() => {});
  }
  /** 由語音包模組注入：已下載時回傳可播放的網址，否則 null */
  resolveVoiceUrl: (voiceId: string) => Promise<string | null> = async () =>
    null;

  /** 第一次觸碰後呼叫：之後才能播放聲音 */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.bgm) void this.bgm.play().catch(() => {});
  }

  /** 播放背景音樂（id＝遊戲素材/BGM 的檔名，例 'bg_00001'）；與目前相同時不重播 */
  playBackgroundMusic(bgmId: string) {
    if (bgmId === this.bgmId) return;
    this.bgmId = bgmId;
    const previous = this.bgm;
    const next = new Audio(`${ASSET_ROOT}bgm/${bgmId}.mp3`);
    next.loop = true;
    next.volume = 0;
    this.bgm = next;
    if (this.unlocked) void next.play().catch(() => {});
    this.fadeVolume(next, saveStore.data.settings.bgmVolume, BGM_FADE_IN_MS);
    if (previous)
      this.fadeVolume(previous, 0, BGM_FADE_IN_MS, () => previous.pause());
  }

  stopBackgroundMusic() {
    const current = this.bgm;
    this.bgm = null;
    this.bgmId = "";
    if (current)
      this.fadeVolume(current, 0, BGM_FADE_OUT_MS, () => current.pause());
  }

  playSoundEffect(url: string) {
    if (!this.unlocked) return;
    const sound = new Audio(url);
    sound.volume = saveStore.data.settings.soundEffectVolume;
    void sound.play().catch(() => {});
  }

  async playVoice(voiceId: string) {
    if (!this.unlocked) return;
    const url = await this.resolveVoiceUrl(voiceId);
    if (!url) return;
    const voice = new Audio(url);
    voice.volume = saveStore.data.settings.voiceVolume;
    void voice.play().catch(() => {});
  }

  private fadeVolume(
    audio: HTMLAudioElement,
    to: number,
    durationMs: number,
    onDone?: () => void,
  ) {
    const from = audio.volume,
      startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      audio.volume = Math.min(1, Math.max(0, from + (to - from) * progress));
      if (progress < 1) requestAnimationFrame(step);
      else onDone?.();
    };
    requestAnimationFrame(step);
  }
}

export const audioService = new AudioService();
