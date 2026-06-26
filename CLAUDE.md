# Project Agent Rules

Mode: sideproject

Read:
- Global rules are loaded from the agent global dir before this project file.
- Mode-specific shared rules: `./modes/sideproject.md`
- Path contract: `./core/path-contract.md`

Project constraints:
- 可主動提出架構改善
- 可建立 sandbox / prototype / docs
- 大改前先列驗收標準
- 架構關聯維護紀律: 每次任務結束前，必須檢視並更新 `$PROJECT_ROOT/docs/architecture_map.md`，以 Mermaid 圖 (graph TD/LR) 補充當次異動的 Component/API/DB 關聯，維持全局依賴關係的清晰。

Path contract:
- 依 agent global dir 的 `./core/path-contract.md` 解析 `AGENT_GLOBAL_DIR`、`PROJECT_ROOT`、寫入路由與 Task Event Logging。
- 本專案 Task Log 固定寫入 `$PROJECT_ROOT/Task_Logs/YYYY-MM-DD.md`。
