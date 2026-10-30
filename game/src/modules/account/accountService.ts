/**
 * 帳號（帳號＝電子信箱、密碼登入；畫面上建議使用 Gmail 信箱）。
 * 透過 AccountProvider 介面讓「本機帳號」與日後的「雲端帳號」互換，畫面與其他模組不需修改：
 * - LocalAccountProvider：本機帳號（providers/localAccountProvider.ts）
 * - 雲端提供者：尚未接上（需要後端，見 docs/開發步驟.md 待決事項），接上後登入即可下載雲端存檔
 */
import { eventBus } from "@core/events/eventBus";
import { saveStore } from "@core/storage/saveStore";
import { storageKey } from "@core/storage/storageKeys";
import type { Account, AccountProvider } from "./accountTypes";
import { LocalAccountProvider } from "./providers/localAccountProvider";

/** 上次登入的帳號（下次開啟時自動登入） */
const SESSION_KEY = storageKey("session");

class AccountService {
  provider: AccountProvider = new LocalAccountProvider();
  current: Account | null = null;

  /** 啟動時恢復上次登入 */
  restoreSession(): Account | null {
    try {
      const account = JSON.parse(
        localStorage.getItem(SESSION_KEY) || "null",
      ) as Account | null;
      if (account) this.signIn(account);
      return account;
    } catch {
      return null;
    }
  }

  async register(email: string, password: string) {
    this.signIn(await this.provider.register(email, password));
  }

  async login(email: string, password: string) {
    const account = await this.provider.login(email, password);
    this.signIn(account);
    const cloudSave = await this.provider.downloadSave?.(account);
    if (cloudSave) saveStore.importJson(cloudSave);
  }

  /** 遊客：不建立帳號，存檔只放在這台裝置（存檔 id 為 guest）；下次開啟會自動以遊客進入 */
  playAsGuest() {
    this.signIn({
      id: "guest",
      email: "",
      createdAt: Date.now(),
      isGuest: true,
    });
  }

  logout() {
    localStorage.removeItem(SESSION_KEY);
    this.current = null;
    eventBus.emit("account:changed", { accountId: null });
  }

  /** 設為目前帳號：記住登入、載入該帳號的存檔 */
  private signIn(account: Account) {
    this.current = account;
    localStorage.setItem(SESSION_KEY, JSON.stringify(account));
    saveStore.load(account.id);
    eventBus.emit("account:changed", { accountId: account.id });
  }
}

export const accountService = new AccountService();
