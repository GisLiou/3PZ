import { AccountError } from './accountTypes';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

/** 檢查信箱格式與密碼長度；不符時丟出 AccountError */
export function validateCredentials(email: string, password: string) {
  if (!EMAIL_PATTERN.test(email)) throw new AccountError('請輸入正確的電子信箱');
  if (password.length < MIN_PASSWORD_LENGTH) throw new AccountError(`密碼至少 ${MIN_PASSWORD_LENGTH} 個字元`);
}

/** 信箱一律去空白、轉小寫後比對 */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
