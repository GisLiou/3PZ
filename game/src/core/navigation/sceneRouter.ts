/**
 * 場景路由（手遊式場景堆疊，不使用瀏覽器網址路由）。
 * - 根場景：底部頁籤所在的場景（任務／武將／商店／轉蛋／對戰／其他）
 * - 子場景堆疊：在根場景上 push 的子場景
 * 返回只會 pop 遊戲內的堆疊；瀏覽器返回／手機實體返回鍵都被 backButton.ts 攔截後導到這裡。
 */
import { useSyncExternalStore } from 'react';

export interface SceneEntry<Params = unknown> {
  id: string;
  params?: Params;
  /** 場景自己決定能否返回（例如戰鬥中要先跳確認視窗）；回傳 false 代表已自行處理 */
  onBack?: () => boolean;
}

export interface SceneStack { root: SceneEntry; children: SceneEntry[] }
type Listener = () => void;

class SceneRouter {
  private root: SceneEntry = { id: 'boot' };
  private children: SceneEntry[] = [];
  private listeners = new Set<Listener>();
  private snapshot: SceneStack = { root: this.root, children: [] };
  /** 返回已到底時呼叫（App 端決定要不要跳「結束遊戲？」） */
  onExitRequest: () => void = () => {};

  private commit() {
    this.snapshot = { root: this.root, children: [...this.children] };
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;

  get current(): SceneEntry {
    return this.children[this.children.length - 1] ?? this.root;
  }

  /** 切換根場景（點底部頁籤），會清空子場景 */
  setRoot(id: string, params?: unknown) {
    this.root = { id, params };
    this.children = [];
    this.commit();
  }

  push(id: string, params?: unknown) {
    this.children.push({ id, params });
    this.commit();
  }

  /** 取代目前最上層的場景（沒有子場景時取代根場景） */
  replace(id: string, params?: unknown) {
    if (this.children.length) this.children[this.children.length - 1] = { id, params };
    else this.root = { id, params };
    this.commit();
  }

  /** 讓目前場景註冊自己的返回處理（例如戰鬥中、對話中） */
  setBackHandler(handler: (() => boolean) | undefined) {
    this.current.onBack = handler;
  }

  /** 遊戲內返回：先問場景，再 pop；已在根場景則交給 onExitRequest */
  back() {
    const current = this.current;
    if (current.onBack && current.onBack() === false) return;
    if (this.children.length) {
      this.children.pop();
      this.commit();
    } else this.onExitRequest();
  }
}

export const sceneRouter = new SceneRouter();

/** React：取得目前的場景堆疊，變動時重新渲染 */
export function useSceneStack() {
  return useSyncExternalStore(sceneRouter.subscribe, sceneRouter.getSnapshot);
}
