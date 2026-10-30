/** 進入點：手勢限制、返回鍵、掛載 App */
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installBackButtonHandling } from '@core/navigation/backButton';
import { sceneRouter } from '@core/navigation/sceneRouter';
import './app/global.css';

// 擋掉手機瀏覽器的雙指縮放、長按選單與拖動整頁
document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('touchmove', (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });

// 已在根場景再按返回：原生 App 由系統處理（Capacitor 預設不關閉），網頁版不做任何事
sceneRouter.onExitRequest = () => {};
void installBackButtonHandling();

createRoot(document.getElementById('root')!).render(<App />);
