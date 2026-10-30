import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // App 識別碼（Android 套件名稱／iOS Bundle ID）；上架後不可再改。
  // 專案代號 3PZ；Android 套件名稱的每一段不可用數字開頭，所以寫成 threepz
  appId: 'io.github.gisliou.threepz',
  appName: '三國志拼圖大戰',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
