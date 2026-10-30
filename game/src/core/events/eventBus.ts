/** 型別安全的全域事件匯流排。模組之間只透過事件溝通，避免互相 import 造成循環相依。 */
export type EventHandler<Payload> = (payload: Payload) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<EventHandler<never>>>();

  /** 訂閱事件；回傳取消訂閱的函式 */
  on<Name extends keyof Events>(name: Name, handler: EventHandler<Events[Name]>): () => void {
    let set = this.handlers.get(name);
    if (!set) this.handlers.set(name, (set = new Set()));
    set.add(handler as EventHandler<never>);
    return () => set!.delete(handler as EventHandler<never>);
  }

  emit<Name extends keyof Events>(name: Name, payload: Events[Name]): void {
    this.handlers.get(name)?.forEach((handler) => (handler as EventHandler<Events[Name]>)(payload));
  }
}

/** 全遊戲共用的事件表；新增事件時在這裡登記型別。 */
export type GameEvents = {
  'navigation:back': void;
  'account:changed': { accountId: string | null };
  'save:changed': void;
  'voicePack:status': { state: 'none' | 'downloading' | 'ready'; done: number; total: number };
};

export const eventBus = new EventBus<GameEvents>();
