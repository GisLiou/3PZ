/**
 * 帳號服務：型別與「帳號提供者」介面、帳密檢查、密碼雜湊、本機帳號提供者、accountService（註冊／登入／遊客／登出／恢復）。
 */
/** 帳號的型別與「帳號提供者」介面（本機帳號、日後的雲端帳號都實作同一個介面） */
import { storageKey, saveStore } from "@core/saveStore";

export interface Account {
  id: string;
  email: string;
  createdAt: number;
  isGuest?: boolean;
}

export interface AccountProvider {
  register(email: string, password: string): Promise<Account>;
  login(email: string, password: string): Promise<Account>;
  /** 雲端存檔；本機提供者不實作 */
  uploadSave?(account: Account, saveJson: string): Promise<void>;
  downloadSave?(account: Account): Promise<string | null>;
}

/** 給使用者看的帳號錯誤（訊息直接顯示在畫面上） */
export class AccountError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

/** 檢查信箱格式與密碼長度；不符時丟出 AccountError */
export function validateCredentials(email: string, password: string) {
  if (!EMAIL_PATTERN.test(email))
    throw new AccountError("請輸入正確的電子信箱");
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new AccountError(`密碼至少 ${MIN_PASSWORD_LENGTH} 個字元`);
}

/** 信箱一律去空白、轉小寫後比對 */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** 密碼雜湊：PBKDF2-SHA256，120 000 次，輸出 256 位元的十六進位字串 */
const PBKDF2_ITERATIONS = 120_000;

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return [...new Uint8Array(bits)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 本機帳號：帳號與密碼雜湊存在本機（localStorage），可離線使用，但換手機無法回溯。
 */
const ACCOUNTS_KEY = storageKey("accounts");
type StoredAccount = Account & { salt: string; hash: string };

const toAccount = ({ id, email, createdAt }: StoredAccount): Account => ({
  id,
  email,
  createdAt,
});

export class LocalAccountProvider implements AccountProvider {
  private readAll(): StoredAccount[] {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  async register(email: string, password: string) {
    validateCredentials(email, password);
    const accounts = this.readAll(),
      normalized = normalizeEmail(email);
    if (accounts.some((stored) => stored.email === normalized))
      throw new AccountError("此信箱已註冊");
    const salt = crypto.randomUUID();
    const stored: StoredAccount = {
      id: crypto.randomUUID(),
      email: normalized,
      createdAt: Date.now(),
      salt,
      hash: await hashPassword(password, salt),
    };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, stored]));
    return toAccount(stored);
  }

  async login(email: string, password: string) {
    const stored = this.readAll().find(
      (candidate) => candidate.email === normalizeEmail(email),
    );
    if (!stored || (await hashPassword(password, stored.salt)) !== stored.hash)
      throw new AccountError("信箱或密碼錯誤");
    return toAccount(stored);
  }
}

/**
 * 帳號（帳號＝電子信箱、密碼登入；畫面上建議使用 Gmail 信箱）。
 * 透過 AccountProvider 介面讓「本機帳號」與日後的「雲端帳號」互換，畫面與其他模組不需修改：
 * - LocalAccountProvider：本機帳號（providers/localAccountProvider.ts）
 * - 雲端提供者：尚未接上（需要後端，見 docs/開發步驟.md 待決事項），接上後登入即可下載雲端存檔
 */
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
  }

  /** 設為目前帳號：記住登入、載入該帳號的存檔 */
  private signIn(account: Account) {
    this.current = account;
    localStorage.setItem(SESSION_KEY, JSON.stringify(account));
    saveStore.load(account.id);
  }
}

export const accountService = new AccountService();
