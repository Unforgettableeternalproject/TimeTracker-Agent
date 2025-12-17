# 開發指南

## 環境設置

### 必要條件

- Node.js 18+
- pnpm 8+
- VS Code / VS Code Insiders
- Git

### 安裝步驟

1. Clone 專案

```bash
git clone <repo-url>
cd TimeTracker-Agent
```

2. 安裝依賴

```bash
pnpm install
```

3. 建置所有套件

```bash
pnpm build
```

---

## 開發工作流程

### Core Package 開發

```bash
cd packages/core
pnpm dev  # 監聽模式
```

核心功能測試：

```bash
# 建立測試資料庫
node -e "const {createDatabase} = require('./dist'); const db = createDatabase('./test.db'); console.log('DB created');"
```

### Extension 開發

1. 啟動 watch 模式

```bash
cd packages/vscode-extension
pnpm dev
```

2. 在 VS Code 中按 F5 啟動 Extension Development Host

3. 測試功能：
   - 打開一個專案資料夾
   - 查看右下角 Status Bar 是否顯示計時
   - 執行指令：`Ctrl+Shift+P` → `Timesheet: Show Summary`

### CLI 開發

```bash
cd packages/cli
pnpm dev

# 測試指令（使用 ts-node 或建置後執行）
pnpm build
node dist/index.js summarize
```

---

## 資料庫操作

### 查看資料庫

```bash
# 安裝 sqlite3 CLI（如果尚未安裝）
# Windows: scoop install sqlite
# Mac: brew install sqlite

# 開啟資料庫
sqlite3 ~/.timesheet-agent/timesheet.db

# 查詢指令
.tables
SELECT * FROM workspaces;
SELECT * FROM sessions ORDER BY start_at DESC LIMIT 10;
SELECT * FROM work_items ORDER BY occurred_at DESC LIMIT 10;
```

### 重置資料庫

```bash
rm ~/.timesheet-agent/timesheet.db
# 下次執行會自動重建
```

---

## 測試策略

### 手動測試清單

**Extension 測試**：
- [ ] 打開 workspace，檢查是否開始追蹤
- [ ] 編輯檔案，確認 Status Bar 時間增加
- [ ] 閒置 5 分鐘，確認停止計時
- [ ] 恢復活動，確認繼續計時
- [ ] Commit 程式碼，檢查資料庫是否建立 work_item

**CLI 測試**：
- [ ] `timesheet init` 建立新工作區
- [ ] `timesheet workspace list` 列出工作區
- [ ] `timesheet summarize` 查看摘要
- [ ] `timesheet export` 匯出 Excel
- [ ] `timesheet fixup` 互動式編輯

---

## 偵錯技巧

### Extension 偵錯

在 `extension.ts` 中加入：

```typescript
console.log('Debug:', data);
```

查看 Debug Console（Extension Development Host 視窗）

### Database 偵錯

```typescript
// 啟用 SQL 日誌
db.getDatabase().on('trace', (sql) => {
  console.log('[SQL]', sql);
});
```

### Git 偵錯

```bash
# 測試 git 指令
cd /path/to/workspace
git log --pretty=format:"%H|%an|%ai|%s" --name-only -n 5
```

---

## 常見問題

### Q: Extension 沒有自動啟動？

A: 檢查 `package.json` 中的 `activationEvents`，確保為 `onStartupFinished`

### Q: Status Bar 沒有顯示？

A: 確認 `StatusBarManager` 有呼叫 `.show()`

### Q: 時間沒有累積？

A: 檢查 `ActivityAggregator` 是否正確接收事件，可以在 `recordActivity` 中加 log

### Q: Git 指令失敗？

A: 確認工作區是 Git repository，執行 `git status` 測試

### Q: Excel 匯出失敗？

A: 檢查 template 路徑是否正確，ExcelJS 是否正確安裝

---

## 程式碼風格

遵循 ESLint 和 Prettier 設定：

```bash
# Lint 檢查
pnpm lint

# 格式化
pnpm format
```

---

## 發布流程

### Extension 打包

```bash
cd packages/vscode-extension
pnpm vscode:prepublish
pnpm exec vsce package
# 產生 .vsix 檔案
```

### CLI 發布

```bash
cd packages/cli
pnpm build
npm publish  # 如果要發布到 npm
```

---

## 貢獻指南

1. Fork 專案
2. 建立 feature branch (`git checkout -b feature/amazing-feature`)
3. Commit 變更 (`git commit -m 'feat: add amazing feature'`)
4. Push 到 branch (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

---

## 架構決策記錄

### 為什麼用 SQLite (sql.js)？

- 輕量、不需額外服務
- 本地優先，離線可用
- 方便備份（單一檔案）
- **sql.js 優勢**：
  - WebAssembly 實作，無需原生模組編譯
  - 完美支援 VS Code Extension（無 Electron 版本相容問題）
  - 跨平台，任何環境都能運行
  - 犧牲少許性能換取易用性與穩定性

### 為什麼用 Monorepo？

- 共用 types 和 core logic
- 統一版本管理
- 簡化跨套件開發

### 為什麼不用 WebSocket 即時同步？

- MVP 不需要
- 增加複雜度
- 後續可選擇性加入
