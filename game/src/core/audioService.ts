/**
 * 音訊：背景音樂（循環、切換時淡入淡出）、音效、武將語音。
 * 全部用 Web Audio API（AudioContext）播放，不用 <audio>：
 *  - 手機上 <audio> 會向系統要求「音訊焦點」，把其他 App 的聲音（Spotify、YouTube…）停掉；
 *    Web Audio 不會搶焦點，iOS 再設定 navigator.audioSession.type = 'ambient'，就能與其他聲音同時播放。
 *  - 音量用 GainNode 控制，淡入淡出由音訊時鐘排程，不受畫面更新（requestAnimationFrame）暫停影響。
 * 語音不在安裝包內，播放前向語音包模組取得已下載的檔案；未下載時靜音略過。
 * 瀏覽器要使用者操作過之後才能出聲：每次觸碰、點擊、按鍵都呼叫 unlock()，聲音還沒開始時再試一次。
 */
import { saveStore } from "./saveStore";
import { ASSET_ROOT } from "./assetLoader";

const BGM_FADE_IN_MS = 400;
const BGM_FADE_OUT_MS = 300;

/** Safari 16.4 以上的音訊工作階段設定（其他瀏覽器沒有這個屬性） */
type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

interface BackgroundMusicTrack {
  id: string;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
}

class AudioService {
  private context: AudioContext | null = null;
  private bgm: BackgroundMusicTrack | null = null;
  /** 解碼後的音效（重複播放的短音效才快取；BGM、語音很大，不快取） */
  private soundEffectBuffers = new Map<string, Promise<AudioBuffer>>();
  unlocked = false;
  /** dispose() 之後不再出聲（熱更新留下的舊物件） */
  private disposed = false;
  /** 由語音包模組注入：已下載時回傳可播放的網址，否則 null */
  resolveVoiceUrl: (voiceId: string) => Promise<string | null> = async () =>
    null;

  constructor() {
    // 與其他 App 的聲音共存（iOS Safari）；要在建立 AudioContext 之前設定
    const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
    if (audioSession) audioSession.type = "ambient";
    // 遊戲被切到背景（視窗最小化、切換分頁、手機回到桌面）時暫停全部聲音，回來時繼續
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private onVisibilityChange = () =>
    this.handleVisibilityChange(document.hidden);

  /** 目前的背景音樂 id（沒有則 null） */
  get currentBackgroundMusic() {
    return this.bgm?.id ?? null;
  }

  /**
   * 整個關掉：停止所有聲音、釋放 AudioContext、移除監聽。
   * 開發時這個檔案被熱更新會建立新的 AudioService；舊的不關掉的話，舊音樂會繼續播，新音樂再疊上去。
   */
  dispose() {
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.bgm = null;
    void this.context?.close().catch(() => {});
    this.context = null;
  }

  private handleVisibilityChange(isHidden: boolean) {
    if (!this.context || !this.unlocked) return;
    void (isHidden ? this.context.suspend() : this.context.resume()).catch(
      () => {},
    );
  }

  private getContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  /**
   * 使用者操作時呼叫：讓聲音開始（AudioContext 從暫停恢復）。
   * 可以重複呼叫：手機上「手指按下」還不算使用者操作（要放開才算），按下時恢復會失敗，放開時會再試一次；
   * 已經在出聲時什麼都不做。
   */
  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    const context = this.getContext();
    if (context.state !== "running") void context.resume().catch(() => {});
  }

  /** 播放背景音樂（id＝遊戲素材/BGM 的檔名，例 'bg_00001'）；與目前相同時不重播 */
  playBackgroundMusic(bgmId: string) {
    if (this.disposed) return;
    if (bgmId === this.bgm?.id) return;
    const context = this.getContext();
    this.fadeOutAndStop(this.bgm, BGM_FADE_IN_MS);
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    const track: BackgroundMusicTrack = { id: bgmId, gain, source: null };
    this.bgm = track;
    void this.decode(`${ASSET_ROOT}bgm/${bgmId}.mp3`)
      .then((buffer) => {
        if (this.bgm !== track) return; // 載入期間又換了別首
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start(); // 尚未解鎖時 context 是暫停狀態，解鎖後才真正出聲
        track.source = source;
        this.rampVolume(
          gain,
          saveStore.data.settings.bgmVolume,
          BGM_FADE_IN_MS,
        );
      })
      .catch(() => {});
  }

  stopBackgroundMusic() {
    this.fadeOutAndStop(this.bgm, BGM_FADE_OUT_MS);
    this.bgm = null;
  }

  playSoundEffect(url: string) {
    if (this.disposed) return;
    if (!this.unlocked) return;
    let loading = this.soundEffectBuffers.get(url);
    if (!loading) {
      loading = this.decode(url);
      loading.catch(() => this.soundEffectBuffers.delete(url));
      this.soundEffectBuffers.set(url, loading);
    }
    void loading
      .then((buffer) =>
        this.playBuffer(buffer, saveStore.data.settings.soundEffectVolume),
      )
      .catch(() => {});
  }

  async playVoice(voiceId: string) {
    if (this.disposed) return;
    if (!this.unlocked) return;
    const url = await this.resolveVoiceUrl(voiceId);
    if (!url) return;
    try {
      this.playBuffer(
        await this.decode(url),
        saveStore.data.settings.voiceVolume,
      );
    } catch {
      /* 檔案損壞等：不出聲 */
    } finally {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url); // 語音包給的是暫時網址，用完釋放
    }
  }

  /** 下載並解碼成 AudioBuffer */
  private async decode(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`音訊載入失敗：${url}`);
    return this.getContext().decodeAudioData(await response.arrayBuffer());
  }

  /** 播放一次（音效、語音） */
  private playBuffer(buffer: AudioBuffer, volume: number) {
    const context = this.getContext();
    const gain = context.createGain();
    gain.gain.value = volume;
    gain.connect(context.destination);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.onended = () => gain.disconnect();
    source.start();
  }

  private fadeOutAndStop(
    track: BackgroundMusicTrack | null,
    durationMs: number,
  ) {
    if (!track) return;
    this.rampVolume(track.gain, 0, durationMs);
    if (!track.source) {
      track.gain.disconnect();
      return;
    }
    track.source.onended = () => track.gain.disconnect();
    track.source.stop(this.getContext().currentTime + durationMs / 1000);
  }

  /** 音量從目前值線性變化到 to（由音訊時鐘排程） */
  private rampVolume(gain: GainNode, to: number, durationMs: number) {
    const now = this.getContext().currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + durationMs / 1000);
  }
}

/** 全域只保留一個 AudioService（存在 globalThis，熱更新重新執行這個檔案時找得到舊的） */
const GLOBAL_KEY = "__3pzAudioService";
type GlobalWithAudio = typeof globalThis & { [GLOBAL_KEY]?: AudioService };
const previous = (globalThis as GlobalWithAudio)[GLOBAL_KEY];

export const audioService = new AudioService();
(globalThis as GlobalWithAudio)[GLOBAL_KEY] = audioService;

// 開發時熱更新會重新執行這個檔案、建立新的 AudioService：
// 舊的若不關掉，舊音樂會繼續播、新音樂再疊上去。這裡關掉舊的，新的接著播同一首（已解鎖的狀態也沿用）。
if (previous) {
  const bgmId = previous.currentBackgroundMusic;
  const unlocked = previous.unlocked;
  previous.dispose();
  if (unlocked) audioService.unlock();
  if (bgmId) audioService.playBackgroundMusic(bgmId);
}
