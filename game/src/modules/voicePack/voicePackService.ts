/**
 * 武將語音包：不放進安裝包，由使用者決定是否下載。
 * - voice-index.json（建置時產生）列出全部語音檔與總大小
 * - 下載：逐檔抓進 Cache Storage（網頁版與 Capacitor WebView 都支援），可續傳、可刪除
 * - 播放：audioService.resolveVoiceUrl 只會回傳已快取的檔案；沒下載就不出聲，遊戲照常進行
 */
import { eventBus } from '@core/events/eventBus';
import { audioService } from '@core/audio/audioService';
import { ASSET_ROOT } from '@core/assets/assetLoader';

const VOICE_CACHE_NAME = '3pz-voice-v1';
/**
 * 舊版快取名稱。語音資料夾已由簡體改為繁體（docs/素材改名對照.md），舊快取的網址全部對不上，
 * 所以不搬移，直接刪除；使用者需重新下載語音。
 */
const LEGACY_VOICE_CACHE_NAMES = ['three-kingdoms-puzzle-wars-voice-v1', 'sanpazu-voice-v1'];
/** 同時下載的檔案數 */
const DOWNLOAD_CONCURRENCY = 6;
/** 語音檔來源：網頁版同站 ./voice/；App 版（安裝包不含語音）由 VITE_VOICE_BASE 指到 GitHub Pages 上的 voice/ */
const VOICE_BASE_URL: string = import.meta.env.VITE_VOICE_BASE || `${ASSET_ROOT}voice/`;
const toAbsoluteUrl = (relativeUrl: string) => new URL(relativeUrl.replace(/^\.\/voice\//, ''), new URL(VOICE_BASE_URL, location.href)).toString();

/** voice-index.json：files＝語音 id → 相對網址 */
export interface VoiceIndex { total: number; bytes: number; files: Record<string, string> }
export type VoicePackState = 'none' | 'downloading' | 'ready';

let voiceIndex: VoiceIndex | null = null;
let state: VoicePackState = 'none';
let abortController: AbortController | null = null;
let legacyCacheCleanup: Promise<void> | null = null;

async function loadVoiceIndex(): Promise<VoiceIndex> {
  if (!voiceIndex) voiceIndex = await (await fetch(new URL('voice-index.json', new URL(VOICE_BASE_URL, location.href)))).json();
  return voiceIndex!;
}

/** 開啟語音快取（第一次呼叫時先刪掉舊名稱的快取） */
async function openVoiceCache(): Promise<Cache> {
  legacyCacheCleanup ??= Promise.all(LEGACY_VOICE_CACHE_NAMES.map((name) => caches.delete(name))).then(() => {}, () => {});
  await legacyCacheCleanup;
  return caches.open(VOICE_CACHE_NAME);
}

export const voicePackService = {
  get state() { return state; },

  /** 檢查已下載數量（啟動時呼叫） */
  async refresh(): Promise<{ done: number; total: number; bytes: number }> {
    const index = await loadVoiceIndex();
    const cache = await openVoiceCache();
    const done = (await cache.keys()).length;
    state = done >= index.total ? 'ready' : 'none';
    eventBus.emit('voicePack:status', { state, done, total: index.total });
    return { done, total: index.total, bytes: index.bytes };
  },

  /** 下載全部語音（已下載的會跳過，所以中斷後再按一次就是續傳） */
  async download(onProgress?: (done: number, total: number) => void) {
    const index = await loadVoiceIndex();
    const cache = await openVoiceCache();
    const alreadyCached = new Set((await cache.keys()).map((request) => request.url));
    const urls = Object.values(index.files);
    let done = 0;
    state = 'downloading';
    abortController = new AbortController();
    const queue = urls.slice();
    const downloadWorker = async () => {
      while (queue.length) {
        const url = toAbsoluteUrl(queue.shift()!);
        if (!alreadyCached.has(url)) {
          const response = await fetch(url, { signal: abortController!.signal });
          if (response.ok) await cache.put(url, response);
        }
        done++;
        onProgress?.(done, urls.length);
        eventBus.emit('voicePack:status', { state, done, total: urls.length });
      }
    };
    try {
      await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, downloadWorker));
      state = 'ready';
    } catch { state = 'none'; }
    eventBus.emit('voicePack:status', { state, done, total: urls.length });
  },

  cancelDownload() { abortController?.abort(); },

  async remove() {
    await caches.delete(VOICE_CACHE_NAME);
    state = 'none';
    await this.refresh();
  },
};

/** 把語音來源接到 audioService */
audioService.resolveVoiceUrl = async (voiceId: string) => {
  const index = await loadVoiceIndex().catch(() => null);
  const relativeUrl = index?.files[voiceId];
  if (!relativeUrl) return null;
  const cached = await (await openVoiceCache()).match(toAbsoluteUrl(relativeUrl));
  return cached ? URL.createObjectURL(await cached.blob()) : null;
};
