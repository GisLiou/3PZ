/** 進入點：手勢限制、返回鍵、掛載 App */
import { createRoot } from "react-dom/client";
import { App } from "./app/components/App";
import { installBackButtonHandling } from "@core/backButton";
import "./app/styles/global.css";

// 擋掉手機瀏覽器的雙指縮放、長按選單與拖動整頁
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 1) event.preventDefault();
  },
  { passive: false },
);

// 開發版：網址的 #scene=…&stage=… 改了就整頁重新載入。
// 只改 # 後面時瀏覽器不會重新載入，畫面不會換、正在播的背景音樂也還在，接著再開一首就會疊在一起
if (import.meta.env.DEV || import.meta.env.VITE_DEBUG)
  window.addEventListener("hashchange", () => location.reload());

void installBackButtonHandling();

createRoot(document.getElementById("root")!).render(<App />);
