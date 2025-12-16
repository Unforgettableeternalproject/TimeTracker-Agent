## 專案總覽

### 核心概念

* **VS Code Extension**：負責「自動計時」與「蒐集開發脈絡（repo/branch/檔案變更/terminal 活動）」
* **Core（共用邏輯）**：session 聚合、閒置判定、資料庫、規則分類、與 git 解析
* **CLI Exporter**：一鍵輸出 Excel（套用你的表格格式與欄位）
* **（可選）Local Helper**：如果你想做到「OS 真閒置」才需要；MVP 可以先不做

---

## 建議專案架構（Monorepo）

```
timesheet-agent/
  README.md
  package.json
  pnpm-workspace.yaml

  packages/
    core/                      # 共用核心邏輯（Node/TS）
      src/
        db/
          schema.sql
          db.ts
        model/
          types.ts
        tracker/
          activityAggregator.ts
          idlePolicy.ts
          sessionService.ts
        git/
          gitService.ts
          githubLink.ts
        classify/
          ruleEngine.ts
          taxonomy.ts
        report/
          timesheetMapper.ts
          dayAggregator.ts
      tests/

    vscode-extension/          # VS Code Insiders / Codespaces 都能跑
      src/
        extension.ts
        commands/
          addNote.ts
          setTag.ts
          exportToday.ts
        telemetry/
          activityRecorder.ts   # 接 VS Code 事件 -> core
        ui/
          statusBar.ts
      package.json

    cli/                       # 匯出 Excel、補資料、查詢
      src/
        index.ts
        commands/
          export.ts
          summarize.ts
          fixup.ts
      package.json

    templates/
      工作時數_template.xlsx    # 直接放你的模板（或你指定格式的副本）
```

技術建議：

* Extension：TypeScript
* Core/CLI：Node.js + TypeScript
* DB：SQLite（用 `better-sqlite3` 或 `sqlite3`）
* Excel：`exceljs` 或 `openpyxl`（如果你偏 Python，也能把 cli 換成 Python；但全 Node 會比較一致）

---

## 基本設計文件（MVP 版）

### 1. 需求與範圍

#### 目標

1. 自動記錄在 VS Code 工作的「有效工時」（排除 idle）
2. 自動綁定到「工作專案（repo）」與「成果連結（commit/PR）」
3. 輸出成與 `工作時數.xlsx` 同欄位結構的 Excel 檔

#### 非目標（先不做，避免卡住）

* 100% 自動寫出完美的「工作內容/詳細」敘述（先以規則 + 少量補寫 UI 解決）
* OS 層鍵鼠監控（MVP 不需要）

---

### 2. 使用流程（你實際會怎麼用）

#### 日常（自動）

1. 你打開 VS Code（insiders/codespace）開始做事
2. Extension 偵測活動，累積 active time（idle 超過門檻就停表）
3. 你在 repo 內 commit 或開 PR（至少 commit）
4. Agent 自動把「上一段 active time」分配到這次成果上（可調整）

#### 需要交付時（手動一鍵）

1. 跑 `timesheet export --from 2025-10-01 --to 2025-10-31`
2. 產出 `工作時數_2025-10.xlsx`（格式與欄位一致）

---

### 3. 關鍵設計：如何把「工時」變成「表格一列」

你的表格每一列看起來是「一個成果（commit / PR merge）」+「一段時數」。

所以建議資料模型分兩層：

* **Session**：純粹計時（你真的在工作多久）
* **WorkItem**：可交付成果（commit / PR）
* **Allocation**：把 Session time 分配到 WorkItem 上（最後輸出就是 Allocation 列表）

MVP 最簡單的分配策略：

* 每次偵測到「新的 commit」時：

  * 把「距離上一個 work item 以來累積的 active time」分配給這次 commit
  * 若沒有上一個 work item（今天第一個），就從 session 開始累積

這會讓輸出自然長成你那張表的樣子。

---

### 4. 欄位對應規則（直接對到你的 Excel）

| Excel 欄位 | 來源                                                                              |
| -------- | ------------------------------------------------------------------------------- |
| 日期       | WorkItem 的時間（commit time）或 Allocation 結束時間                                      |
| 工作專案     | git remote repo name（例：`AI-Website-Web`）                                        |
| 工作種類     | WorkItem 類型：Commit / PR Merge / Manual                                          |
| 工作內容     | 從 commit message 或 PR title 推導（可再用 rule engine 摘要成 1~2 字，如 fix/feat/merge/docs） |
| 工作詳細     | 完整 commit message / PR title（或你手動補一行）                                           |
| 實際工作成果連結 | 自動組 GitHub URL（commit/PR）                                                       |
| 時數       | Allocation minutes / 60（可依公司規則四捨五入或進位）                                          |

---

### 5. Idle 判定策略（VS Code 內可行的版本）

Extension 監聽這些事件，任何一個發生就算 active：

* 文字編輯變更（onDidChangeTextDocument）
* 存檔（onDidSaveTextDocument）
* 游標選取變更（onDidChangeTextEditorSelection）
* Terminal 輸入（onDidWriteTerminalData 或相關事件）
* 視窗 focus（onDidChangeWindowState）

Idle 判定：

* 若連續 `IDLE_THRESHOLD_MINUTES`（例如 5）都沒有 active event

  * 當前 session 暫停累積
* 事件恢復就繼續

資料只要記「active chunk」即可，不用每秒寫 DB。

---

### 6. 規則分類（工作內容/種類自動化）

先做「規則引擎」就夠用：

* 工作種類：

  * commit → `Commit`
  * merge commit 或 PR merge 偵測到 → `PR Merge`
  * 手動補登 → `Manual`

* 工作內容（短字）：

  * commit message 以 `fix:` `feat:` `docs:` `refactor:` `chore:` 開頭 → 直接取 prefix
  * merge 類 → `merge`
  * 沒有 prefix → 用檔案變更路徑推斷（例如 `frontend/`、`api/`、`db/`、`crawler/`）

* 工作詳細：

  * commit message 全文或 PR title 全文

---

### 7. 資料庫 Schema（建議）

**sessions**

* id
* repo
* branch
* start_at
* end_at
* active_seconds

**work_items**

* id
* repo
* type (`commit|pr_merge|manual`)
* title
* detail
* occurred_at
* url
* commit_sha (nullable)
* pr_number (nullable)

**allocations**

* id
* work_item_id
* date (yyyy-mm-dd)
* hours (float)
* note (nullable)
* tag (nullable)

輸出 Excel = `allocations JOIN work_items` 的清單。

---

### 8. CLI 匯出規格
指令：

* `export --from YYYY-MM-DD --to YYYY-MM-DD --out PATH`
* `summarize --date YYYY-MM-DD`（看今天記了多少、有哪些成果）
* `fixup --date YYYY-MM-DD`（開互動式介面讓你補 tag/note/調整 hours）

Excel 匯出策略：

* 直接讀 `templates/工作時數_template.xlsx`
* 把資料逐列寫入（A~G 欄）
* 保留原有格式、欄寬、字型
