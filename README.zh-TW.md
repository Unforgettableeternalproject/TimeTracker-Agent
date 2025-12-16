# TimeTracker Agent

### 這份專案有提供多語言 README 供參考
[![en](https://img.shields.io/badge/lang-en-red.svg)](./README.md) [![zh-TW](https://img.shields.io/badge/lang-zh--tw-yellow.svg)](./README.zh-TW.md)

> 開發者專用的自動工時追蹤助理

## 專案簡介

**TimeTracker Agent** 是一個專為開發者設計的智慧工時追蹤系統，能夠自動記錄你在 VS Code 的工作時間、與 Git commits/PRs 關聯，並匯出符合公司格式的專業 Excel 工時表。

### 核心特色

✨ **自動計時** - 自動追蹤 VS Code 工作時間（排除閒置時段）  
✨ **Git 整合** - 自動將時間與 commits 和 pull requests 關聯  
✨ **Excel 匯出** - 產生符合公司規範的工時報表  
✨ **多工作區支援** - 靈活管理多個專案工作區  
✨ **離線優先** - 完全離線運作，無需雲端依賴  
✨ **自訂規則** - 可配置的分類與匯出規則

---

## 架構設計

這是一個使用 pnpm workspaces 管理的 **monorepo** 專案：

```
timesheet-agent/
├── packages/
│   ├── core/                # 核心邏輯（資料庫、Session、Git）
│   ├── vscode-extension/    # VS Code 擴充套件
│   └── cli/                 # 命令列工具
└── templates/               # Excel 模板與配置檔
```

**技術堆疊**：
- TypeScript + Node.js 18+
- SQLite (better-sqlite3)
- VS Code Extension API
- ExcelJS 報表產生

---

## 快速開始

### 安裝

```bash
# 安裝 pnpm（如果尚未安裝）
npm install -g pnpm

# 安裝專案依賴
pnpm install

# 建置所有套件
pnpm build
```

### VS Code Extension 開發

```bash
# 啟動監聽模式
cd packages/vscode-extension
pnpm dev

# 在 VS Code 中按 F5 啟動 Extension Development Host
```

### CLI 使用

```bash
# 初始化工作區
pnpm --filter @timesheet-agent/cli exec timesheet init

# 查看今日摘要
pnpm --filter @timesheet-agent/cli exec timesheet summarize

# 匯出工時表
pnpm --filter @timesheet-agent/cli exec timesheet export --from 2025-12-01 --to 2025-12-31
```

---

## 核心概念

### 1. 自動追蹤

Extension 監聽以下 VS Code 事件：
- 文字文件變更
- 檔案儲存
- 游標/選取變更
- Terminal 輸入/輸出
- 視窗焦點變化

**閒置偵測**：超過 5 分鐘（可配置）無活動即停止計時。

### 2. Git 整合

- 自動偵測 commits 並建立 Work Items
- 支援 GitHub、GitLab、Bitbucket、Azure DevOps
- 自動產生 commit/PR 連結

### 3. 工時分配

- 主動時間會分配到 commits
- 可透過 `fixup` 指令手動調整
- 支援標籤與備註

### 4. Excel 匯出

輸出欄位：
- 日期
- 工作專案（repository 名稱）
- 工作種類（Commit / PR Merge / Manual）
- 工作內容（自動分類）
- 工作詳細（commit message）
- 實際工作成果連結（GitHub URL）
- 時數

---

## CLI 指令

### 工作區管理

```bash
# 初始化新工作區
timesheet init [path] --name "專案名稱"

# 列出所有工作區
timesheet workspace list

# 啟用/停用工作區
timesheet workspace activate <id>
timesheet workspace deactivate <id>
```

### 查詢與匯出

```bash
# 查看今日摘要
timesheet summarize

# 查看指定日期
timesheet summarize --date 2025-12-15

# 匯出工時表
timesheet export --from 2025-12-01 --to 2025-12-31 --out report.xlsx

# 指定工作區匯出
timesheet export --workspace 1 --from 2025-12-01 --to 2025-12-31
```

### 互動式編輯

```bash
# 修正今日記錄（hours/note/tag）
timesheet fixup

# 修正指定日期
timesheet fixup --date 2025-12-15
```

---

## 配置設定

### VS Code 設定

```json
{
  "timesheetAgent.idleThresholdMinutes": 5,
  "timesheetAgent.checkIntervalSeconds": 30,
  "timesheetAgent.autoExport": false,
  "timesheetAgent.databasePath": ""
}
```

### 工作區配置

在工作區根目錄建立 `.timesheet/config.json`：

```json
{
  "idleThresholdMinutes": 5,
  "classification": {
    "projectNameOverride": "自訂專案名稱",
    "customRules": [
      {
        "pattern": "^fix:",
        "field": "commit_message",
        "category": "錯誤修復",
        "priority": 10
      }
    ]
  },
  "export": {
    "templatePath": "custom-template.xlsx",
    "defaultDateRange": "month"
  }
}
```

---

## 資料庫架構

使用 SQLite（預設位置：`~/.timesheet-agent/timesheet.db`）

**核心資料表**：
- `workspaces` - 工作區定義
- `sessions` - 工作時段記錄
- `work_items` - 可交付成果（commits/PRs）
- `allocations` - 時間分配到成果
- `configurations` - 配置資料

---

## 開發

### 建置與測試

```bash
# 建置所有套件
pnpm build

# 監聽模式
pnpm dev

# 清理建置產物
pnpm clean

# Lint 檢查
pnpm lint
```

### 專案結構

```
packages/
  core/
    src/
      db/           # 資料庫層
      model/        # 型別定義
      tracker/      # Session 與活動追蹤
      git/          # Git 整合
  
  vscode-extension/
    src/
      extension.ts       # Extension 入口
      telemetry/         # 活動記錄
      ui/                # UI 元件
      commands/          # VS Code 指令
  
  cli/
    src/
      index.ts           # CLI 入口
      commands/          # 指令實作
```

詳細開發指南請參閱 [DEVELOPMENT.md](./DEVELOPMENT.md)。

---

## 設計原則

遵循 `.github/copilot-instructions.md` 的指引：

1. **Source of Truth** - VS Code 事件 + Git commits
2. **Deterministic** - 基於規則的分類，最小化 AI 依賴
3. **Auditable** - 所有資料可追溯且可修正
4. **Offline-First** - 無需網路即可運作
5. **Flexible** - 多工作區支援與可自訂規則

---

## 未來規劃

- [ ] 選用的 LLM 自動摘要功能
- [ ] Web 儀表板
- [ ] 團隊協作功能
- [ ] 擴展 Git 平台支援
- [ ] 進階規則引擎

---

## 貢獻指南

歡迎提交 Issues 和 Pull Requests！

貢獻前請先閱讀：
- [.github/copilot-instructions.md](.github/copilot-instructions.md)
- [docs/Requirement.md](docs/Requirement.md)

---

## 授權

MIT License

---

## 相關連結

- [English Documentation](./README.md)
- [開發指南](./DEVELOPMENT.md)
- [版本歷史](./VERSION_HISTORY.md)
- [變更日誌](./CHANGELOG.md)
