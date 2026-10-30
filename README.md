# 3PZ（三國志拼圖大戰 復刻）

非商業、私人研究用的復刻專案。素材著作權屬原權利人（Cygames 等）所有，請勿公開散布或商用。

## 資料夾

| 路徑 | 內容 | 規則 |
|---|---|---|
| `game/` | 遊戲本體（Vite 8 + React 18 + TypeScript + Capacitor 8） | 開發 |
| `遊戲素材/` | 原版素材（BG、BGM、UI等、武將圖鑑立繪、武將圖鑑語音） | **內容原封不動**；簡體檔名已轉繁體，對照見 [`docs/素材改名對照.md`](docs/素材改名對照.md) |
| `自製素材/` | 非原版、因必要而自製的部分，每一項都記在 `自製素材/README.md` | 需記錄 |
| `參考資料/` | 原版錄影（逐禎復刻的依據），說明見 `參考資料/README.md` | **不進 git**，只放本機 |
| `docs/` | 架構、命名、分支與發布、開發步驟、復刻分析 | 隨開發更新 |

## 分支

- `main`：正式版，不直接推送；只透過 `develop` 或緊急修正（`hotfix/*`）的 PR 更新。
- `develop`：開發版，所有開發都在這裡；修改不會影響 `main` 的遊戲。

網址：正式版 `https://<GitHub 帳號>.github.io/<儲存庫名稱>/`，開發版加上 `/develop/`。細節見 [`docs/分支與發布.md`](docs/分支與發布.md)。

## 開始開發

需要 Node.js 22.12 以上。

指令可以在根目錄 `D:\3PZ` 或 `game/` 執行，效果相同：根目錄的 `package.json` 只負責把指令轉給 `game/`（相依套件只裝在 `game/node_modules`）。第一次請先執行 `npm run setup`（等於在 `game/` 執行 `npm ci`）。

```powershell
cd game
npm ci              # 必須顯示 found 0 vulnerabilities
npm run assets      # 把 遊戲素材/ 轉成 public/（webp、mp3），第一次約 10 分鐘；需要 ffmpeg，記錄在 build-assets.log
npm run assets -- --clean   # 同上，並刪除 public/ 裡已沒有來源的舊檔
npm run dev         # 開發伺服器；網址加 #scene=<場景 id> 可直接跳到該畫面
npm test            # 單元測試
npm run build       # 網頁版建置（含語音，供下載）
npm run build:app   # App 版建置（不含語音）→ npx cap sync
npm run check:mobile -- http://localhost:4173/   # 手機操作檢查（先 npx vite preview）
```

## 文件

1. [`docs/架構.md`](docs/架構.md)：技術、資料夾、規則
2. [`docs/模組相依.md`](docs/模組相依.md)：模組之間的關係與主要流程
3. [`docs/命名規範.md`](docs/命名規範.md)：命名規則與用語對照
4. [`docs/分支與發布.md`](docs/分支與發布.md)：main／develop、網站、發布流程
5. [`docs/開發步驟.md`](docs/開發步驟.md)：每個部分的審視狀態與待辦
6. [`docs/手機操作規範.md`](docs/手機操作規範.md)、[`docs/素材說明.md`](docs/素材說明.md)、[`docs/復刻分析/`](docs/復刻分析/)
