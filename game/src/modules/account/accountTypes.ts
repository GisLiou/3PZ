/** 帳號的型別與「帳號提供者」介面（本機帳號、日後的雲端帳號都實作同一個介面） */
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
