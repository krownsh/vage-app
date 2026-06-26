# LLM 重量預估 Prompt 模板（NVIDIA NIM）

目的：對 catalog 內每個農產品，估計「平均單顆/單位重量（公斤）」，用於「單位轉換成克」功能（待討論事項 #2）。

## 資料來源

`public/data/crop_catalog.json` — 919 筆農作物（含 plv1~plv6 完整分類）。

## 預估 Schema

每筆要回答：

```json
{
  "name": "玉米-白玉米",
  "avgWeightKg": 0.30,           // 平均重量（公斤），沒把握可填 null
  "weightUnit": "perPiece",      // perPiece / perBundle / perKg（沒單位的秤重品填 perKg）
  "confidence": "high|medium|low",
  "note": "帶殼玉米筍約 200g，去殼後約 100g；大根玉米 300-400g"
}
```

### weightUnit 規則
- `perPiece`：一顆/一條/一株有明確單位（例如 高麗菜一顆、玉米一條）
- `perBundle`：一束/一把（葉菜類常用，例如 青江白菜一把約 0.5kg）
- `perKg`：已經是秤重品，沒單一顆概念（例如 豬肉、水果切塊）

### avgWeightKg 參考值

| 品項 | 單位 | 重量 |
|------|------|------|
| 高麗菜（甘藍） | 顆 | 1.0~1.5 kg |
| 玉米 | 條 | 0.3~0.4 kg（去殼） |
| 玉米筍 | 條 | 0.05~0.1 kg |
| 紅蘿蔔 | 條 | 0.15~0.25 kg |
| 馬鈴薯 | 顆 | 0.15~0.3 kg |
| 洋蔥 | 顆 | 0.2~0.3 kg |
| 青江白菜 | 株 | 0.3~0.5 kg |
| 蘿蔔 | 條 | 0.5~1.0 kg |
| 番茄 | 顆 | 0.1~0.2 kg |
| 小番茄 | 顆 | 0.01~0.02 kg |
| 苦瓜 | 條 | 0.3~0.5 kg |
| 絲瓜 | 條 | 0.4~0.7 kg |
| 茄子 | 條 | 0.2~0.3 kg |
| 甜椒 | 顆 | 0.15~0.25 kg |
| 辣椒 | 條 | 0.01~0.05 kg |
| 鳳梨 | 顆 | 1.5~2.5 kg |
| 西瓜 | 顆 | 3~5 kg |
| 木瓜 | 顆 | 0.5~1.0 kg |
| 芒果 | 顆 | 0.3~0.5 kg |
| 香蕉 | 串 | 1~2 kg |
| 蘋果 | 顆 | 0.2~0.3 kg |
| 芭樂 | 顆 | 0.3~0.5 kg |

## LLM 設定：NVIDIA NIM Hosted API

- **端點**：`https://integrate.api.nvidia.com/v1/chat/completions`
- **模型**：`nvidia/llama-3.3-nemotron-super-49b-v1`（預設，NVIDIA 優化版中英文強）
- **官方文件**：https://docs.api.nvidia.com/nim/reference/llm-apis
- **Key 來源**：本機 `api/nvidia/.env`（10 把 key，每把 40 RPM）
- **全域規則文件**：`AGENT_GLOBAL_DIR/api/nvidia-nim.md`

### Debug 順序（依全域規則）
1. 確認 model id 正確（先查 https://build.nvidia.com/models）
2. 確認 endpoint 正確
3. 確認 process 真的讀到 .env
4. **先用單一 key 做最小 curl 測試**
5. 檢查 40 RPM
6. 接回 pipeline

## Prompt 模板

```
你是台灣農產品重量專家。請根據台灣傳統市場常見情況，為以下農產品估計「平均單顆/單位重量（公斤）」。

回傳格式：JSON 陣列，每筆 {"name": "...", "avgWeightKg": 數字或 null, "weightUnit": "perPiece|perBundle|perKg", "confidence": "high|medium|low", "note": "簡短說明"}

重要規則：
1. 只回傳 JSON，不要任何其他文字
2. 沒有把握的填 null，不要猜
3. weightUnit 規則：perPiece = 一顆/條/株有明確單位，perBundle = 一束/把，perKg = 已秤重品
4. 台灣市場常見尺寸，不要用國外品種
5. 同一 plv3 主品項的不同變體，重量可能差異（例如 玉米筍 vs 大玉米）

品項清單：
{ITEMS}

JSON：
```

## 執行方式

### 切 batch

```bash
node scripts/estimate_crop_weights.cjs split
```

會產生 14 個 batch（30 筆/批，最後一批 1 筆）到 `batches/`。

### 呼叫 LLM

```bash
# 預設讀 api/nvidia/.env 的 NVIDIA_API_KEY_1..10
node scripts/estimate_crop_weights.cjs run
```

腳本會：
- 自動讀 .env 拿到所有 key
- round-robin 分配給 14 個 batch（避開單 key RPM 撞限）
- 呼叫 NIM API（單 key 限 1.5 秒/request = 40 RPM）
- 寫入 `batches/responses/batch_XXX.json`

### 合併結果

```bash
node scripts/estimate_crop_weights.cjs merge
```

合併 `batches/responses/` → `public/data/crop_weights.json`。

### 看進度

```bash
node scripts/estimate_crop_weights.cjs status
```

## 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `NVIDIA_ENV_PATH` | `D:/others/sideproject/My-claude-obsidian/my_agent主檔/api/nvidia/.env` | .env 檔位置 |
| `NVIDIA_MODEL` | `nvidia/llama-3.3-nemotron-super-49b-v1` | 用的模型 id |

## 注意事項

- 不要在沒有把握時填值，寧可 null
- LLM 容易低估變異（例如「蘿蔔-梅花」可能跟「蘿蔔-其他」差異大）
- 完成後**人工抽樣校對** 10-20 筆
- 校對後再加 `confidence` 標記，未來可做 fallback
- API 回應偶爾會把 JSON 包在 markdown code block，腳本有處理
- 失敗的 batch 會留在 `batches/responses/` 不存在狀態，下次 `run` 可重試（已存在的會 skip）
