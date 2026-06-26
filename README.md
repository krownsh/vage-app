# vage-app

臺灣蔬菜水果批發行情 App。資料來源：農業部農產品交易行情 API + 農作物統一名稱與代碼。

- 前端：React 19 + Vite 8
- 行動 App：Capacitor 8 (Android)
- 資料：靜態 catalog + GitHub Pages 每日快取

---

## 開發

```bash
# 安裝依賴（需 Node.js ≥20.19）
npm install

# 本地開發伺服器
npm run dev

# 生產 build
npm run build

# Lint
npm run lint
```

### 環境需求

- Node.js **≥ 20.19**（Vite 8 要求）
- Android Studio + JDK 17（編譯 APK）

---

## 資料管線

### Catalog（靜態，每週更新）

```bash
node scripts/update_catalog.cjs
```

從農業部 LC7YWlenhLuP 拉取，過濾掉稻米 / 花卉 / 特用 / 加工 / 其他類別後寫入 `public/data/crop_catalog.json`（919 筆 / 312 KB）。

### 每日行情快取

```bash
node scripts/daily_cache.cjs
```

抓近 30 天行情，依規則過濾（3 市場 + N04/N05），去重，trim 到 30 天，**瘦身欄位**後寫入 `public/data/prices_cache.json`（~1.7 MB / 10K 筆）。

---

## 部署流程

### 一次性設定

```bash
# 建立 gh-pages 分支（首次部署）
git checkout --orphan gh-pages
git commit --allow-empty -m "init gh-pages"
git push origin gh-pages
git checkout main
```

### 日常

`.github/workflows/daily-cache.yml` 會在每日 **UTC 10:00（台北 18:00）** 自動：

1. checkout repo
2. setup Node 20 + `npm ci`
3. 跑 `scripts/daily_cache.cjs` 產出最新 cache
4. 部署 `public/data/` 到 `gh-pages/data/`

**公開 URL**：`https://krownsh.github.io/vage-app/data/prices_cache.json`

### App 端資料流（四層 fallback）

```
App 啟動
  ↓
fetchPrices()
  ├─ ① 遠端 GitHub Pages URL（阻塞首屏，10s timeout）
  │   └ 成功 → 寫入 IndexedDB → 用新資料渲染
  ├─ ② IndexedDB 本地快取（離線可用）
  ├─ ③ APK 內建靜態（首次安裝 / 完全離線）
  └─ ④ 即時抓政府 API 4 天（以上都失敗）
```

### 驗證部署

```bash
# 確認 gh-pages 部署成功
curl -I https://krownsh.github.io/vage-app/data/prices_cache.json

# 預期回應：HTTP/2 200，Content-Type: application/json
```

---

## Android APK

```bash
# Build 前端 + 同步到 android/
npm run build
npx cap sync android

# 用 Android Studio 開啟 android/ 資料夾，按 Run
```

---

## 架構文件

- [main.md](main.md) — 高階架構圖
- [api.md](api.md) — API 規格與每日快取機制
- [docs/architecture_map.md](docs/architecture_map.md) — Mermaid 完整依賴圖
- [Task_Logs/](Task_Logs/) — 工作日誌

---

## React + Vite 模板資訊

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).
