/**
 * 本機帳號：帳號與密碼雜湊存在本機（localStorage），可離線使用，但換手機無法回溯。
 */
import { storageKey } from '@core/storage/storageKeys';
import { AccountError, type Account, type AccountProvider } from '../accountTypes';
import { normalizeEmail, validateCredentials } from '../credentialValidation';
import { hashPassword } from './passwordHashing';

const ACCOUNTS_KEY = storageKey('accounts');
type StoredAccount = Account & { salt: string; hash: string };

const toAccount = ({ id, email, createdAt }: StoredAccount): Account => ({ id, email, createdAt });

export class LocalAccountProvider implements AccountProvider {
  private readAll(): StoredAccount[] {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; }
  }

  async register(email: string, password: string) {
    validateCredentials(email, password);
    const accounts = this.readAll(), normalized = normalizeEmail(email);
    if (accounts.some((stored) => stored.email === normalized)) throw new AccountError('此信箱已註冊');
    const salt = crypto.randomUUID();
    const stored: StoredAccount = { id: crypto.randomUUID(), email: normalized, createdAt: Date.now(), salt, hash: await hashPassword(password, salt) };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, stored]));
    return toAccount(stored);
  }

  async login(email: string, password: string) {
    const stored = this.readAll().find((candidate) => candidate.email === normalizeEmail(email));
    if (!stored || (await hashPassword(password, stored.salt)) !== stored.hash) throw new AccountError('信箱或密碼錯誤');
    return toAccount(stored);
  }
}
