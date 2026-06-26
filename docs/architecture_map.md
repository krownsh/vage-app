# Architecture Map

vage-app 整體依賴與資料流圖。每次任務結束必須更新本檔。

## 系統總覽

```mermaid
graph TD
  subgraph Sources[三大資料來源]
    A1[data.gov.tw<br/>政府資料開放平臺<br/>目前未用]
    A2[data.moa.gov.tw<br/>農產品交易行情 API<br/>FarmTransData]
    A3[data.moa.gov.tw<br/>農作物統一名稱 API<br/>LC7YWlenhLuP]
  end

  subgraph StaticData[靜態資料層]
    B1[public/data/<br/>crop_catalog.json<br/>919 筆, 312KB]
    B2[public/data/<br/>prices_cache.json<br/>每日由 daily_cache.cjs 產出<br/>10K 筆 / 30 天 / 3.2MB]
  end

  subgraph DailyCache[後端每日快取層 scripts/daily_cache.cjs]
    DC1[buildInitial 首次: 抓 30 天]
    DC2[incrementalUpdate 後續: 抓 1 天 + trim]
  end

  subgraph LLM[LLM 補完層（NVIDIA NIM）]
    E1[batches/<br/>14 batch × 30 項]
    E2[estimate_crop_weights.cjs<br/>跑 nemotron-super-49b]
    E3[estimate_crop_seasons.cjs<br/>同架構補產季月份]
    E4[crop_weights.json<br/>public/data/]
    E5[crop_seasons.json<br/>public/data/]
  end

  subgraph Fetch[前端抓取層 src/services/api.js]
    C1[fetchPrices 優先讀 prices_cache.json<br/>fallback: fetchPricesLive 即時抓 4 天]
    CW[loadCropWeights<br/>讀 crop_weights.json]
    CS[loadCropSeasons<br/>讀 crop_seasons.json]
  end

  subgraph Match[比對層 src/utils/cropIndex.js]
    D1[buildCropIndex]
    D2[lookupCrop<br/>四級匹配:<br/>1.CNAME 精確<br/>2.PLV3_NAME<br/>3.MARKET_ALIAS<br/>4.模糊搜尋]
  end

  subgraph Aggregate[聚合層 src/utils/aggregation.js]
    E1[aggregatePrices<br/>依市場分組 → 平均價]
    E2[filterCrops<br/>分類: all/01-99/fruit/fav]
  end

  subgraph UI[前端 React]
    F1[App.jsx<br/>cache-meta + 狀態管理]
    F2[DetailModal<br/>Bottom Sheet<br/>summary card / 市場表 / 變體表 / 輸入區 / 趨勢]
    F3[favorites<br/>localStorage<br/>vege_favorites]
  end

  subgraph UIComp[UI 元件層 src/components]
    UC1[Header<br/>大標 + 農業 badge<br/>+ 搜尋]
    UC2[CategoryTabs<br/>白圓容器 + 黃 chip]
    UC3[ProductCard<br/>圖示 + 名 + 分類 + 大價 + fav + share]
    UC4[FAB<br/>黃圓黑邊加號]
    UC5[TrendChart<br/>SVG 折線圖<br/>高點黃圓 + 平均虛線]
    UC6[CheckerModal<br/>划算計算機]
    UC7[CropIcon<br/>統一圖片佔位<br/>奶油底圓 + 中文首字]
  end

  A2 -->|每日/即時| C1
  A3 -->|每週更新| B1
  C1 --> D2
  B1 --> D1
  D1 --> D2
  DC1 --> B2
  DC2 --> B2
  B2 --> C1
  E1 --> E2 --> E4
  E1 --> E3 --> E5
  E4 --> CW
  E5 --> CS
  D2 --> E1
  E1 --> E2
  E1 --> F1
  F1 --> UC1
  F1 --> UC2
  F1 --> UC3
  F1 --> UC4
  F1 --> UC2
  F3 --> E2
  UC3 --> UC7
  F2 --> UC5
  F2 --> UC7
```

## PLV1 分類保留策略

| PLV1 代碼 | 名稱 | 筆數 | 狀態 |
|-----------|------|------|------|
| 001 | 稻米類 | 0 | 🔪 已過濾 (catalog + fetch) |
| 002 | 蔬菜類 | 531 | ✅ 保留 |
| 003 | 果樹類 | 332 | ✅ 保留 (水果分類) |
| 004 | 花卉類 | 0 | 🔪 已過濾 (catalog + fetch N06) |
| 005 | 雜糧類 | 56 | ✅ 保留 (玉米/落花生) |
| 006 | 特用作物類 | 0 | 🔪 已過濾 (茶/咖啡/油料) |
| 007 | 農產品加工類 | 0 | 🔪 已過濾 (加工品) |
| 010 | 其他作物類 | 0 | 🔪 已過濾 (雜項) |

**最終保留：919 筆（蔬菜 531 + 果樹 332 + 雜糧 56）**

## 已實作 / 待實作

- [x] 作物名稱四級匹配 (cropIndex.js)
- [x] MARKET_ALIAS 別名表 (北農 → 官方)
- [x] 過濾花卉 (catalog + fetchPrices N06)
- [x] 過濾稻米 (catalog)
- [x] 修正 fruit 分類條件 (aggregation.js: plv1 === '003')
- [x] 30 天價格曲線 (fetchPrices + DetailModal slice(-30))
- [x] DetailModal 跨變體彙整 (mainName)
- [x] fetchPrices timeout + retry
- [x] MARKET_ORDER 統一單一真源
- [x] 後端每日快取 (scripts/daily_cache.cjs + prices_cache.json)
- [x] localStorage 鍵統一為 vege_favorites
- [x] NVIDIA NIM 重量預估管線（split/test/run/merge）
- [x] NVIDIA NIM 季節預估管線（同架構）
- [x] 30 天趨勢折線圖 (TrendChart.jsx, SVG)
- [x] UI/UX 全面對齊 [docs/uiux.md](uiux.md)（晚間追加 #12）
- [x] CropIcon 統一圖片佔位元件
- [x] Bottom Sheet 結構（drag handle + 關閉鈕 + summary card）
- [ ] 各作物手繪插圖（主人提供）
- [ ] 右上蔬菜籃插圖（主人提供）
- [ ] 地區 chips 篩選功能（依主人決定暫不做）
- [ ] MARKET_ALIAS 持續補充

## 關鍵檔案索引

- [src/services/api.js](../src/services/api.js) — fetchPrices + loadCropCatalog
- [src/utils/cropIndex.js](../src/utils/cropIndex.js) — 比對核心
- [src/utils/aggregation.js](../src/utils/aggregation.js) — 聚合與過濾
- [scripts/update_catalog.cjs](../scripts/update_catalog.cjs) — Catalog 重抓
- [scripts/test_match.cjs](../scripts/test_match.cjs) — 比對驗證
- [public/data/crop_catalog.json](../public/data/crop_catalog.json) — 靜態目錄
- [src/components/CropIcon/CropIcon.jsx](../src/components/CropIcon/CropIcon.jsx) — 圖片佔位（主人給圖只改這個）
- [src/index.css](../src/index.css) — Design tokens + 元件樣式
- [docs/uiux.md](../docs/uiux.md) — UI/UX 規格基準
- [main.md](../main.md) — 高階架構圖 (舊版)
- [api.md](../api.md) — API 規格
