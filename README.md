# Timesheet Agent

### This project provides multilanguage README files
[![en](https://img.shields.io/badge/lang-en-red.svg)](./README.md) [![zh-TW](https://img.shields.io/badge/lang-zh--tw-yellow.svg)](./README.zh-TW.md)

> Automatic work time tracking assistant for developers

## Overview

**Timesheet Agent** is an intelligent time tracking system designed specifically for developers. It automatically tracks your active work time in VS Code, associates it with Git commits/PRs, and exports professional Excel timesheets matching your company's format.

### Key Features

✨ **Automatic Time Tracking** - Tracks active time in VS Code (excludes idle periods)  
✨ **Git Integration** - Automatically links time to commits and pull requests  
✨ **Excel Export** - Generates company-compliant timesheet reports  
✨ **Multi-Workspace Support** - Flexibly manage multiple project workspaces  
✨ **Offline-First** - Works entirely offline, no cloud dependency  
✨ **Customizable Rules** - Configurable classification and export rules

---

## 🏗️ 專案架構

這是一個 **Monorepo** 專案，使用 pnpm workspace 管理：

```
timesheet-agent/
├── packages/
│   ├── core/                # 核心邏輯（DB、Session、Git）
│   ├── vscode-extension/    # VS Code 擴充套件
│   └── cli/                 # 命令列工具
└── templates/               # Excel 模板與配置範本
```

---

## Architecture

This is a **monorepo** project managed with pnpm workspaces:

```
timesheet-agent/
├── packages/
│   ├── core/                # Core logic (DB, Session, Git)
│   ├── vscode-extension/    # VS Code extension
│   └── cli/                 # Command-line tools
└── templates/               # Excel templates and configs
```

**Technology Stack**:
- TypeScript + Node.js 18+
- SQLite (better-sqlite3)
- VS Code Extension API
- ExcelJS for report generation

---

## Quick Start

### Installation

```bash
# Install pnpm (if not already installed)
npm install -g pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### VS Code Extension Development

```bash
# Start watch mode
cd packages/vscode-extension
pnpm dev

# Press F5 in VS Code to launch Extension Development Host
```

### CLI Usage

```bash
# Initialize a workspace
pnpm --filter @timesheet-agent/cli exec timesheet init

# View today's summary
pnpm --filter @timesheet-agent/cli exec timesheet summarize

# Export timesheet
pnpm --filter @timesheet-agent/cli exec timesheet export --from 2025-12-01 --to 2025-12-31
```

---Core Concepts

### 1. Automatic Tracking

The extension monitors these VS Code events:
- Text document changes
- File saves
- Cursor/selection changes
- Terminal input/output
- Window focus changes

**Idle Detection**: Time stops counting after 5 minutes (configurable) of inactivity.

### 2. Git Integration

- Automatically detects commits and creates Work Items
- Supports GitHub, GitLab, Bitbucket, Azure DevOps
- Auto-generates commit/PR URLs

### 3. Time Allocation

- Active time is allocated to commits
- Manual adjustment available via `fixup` command
- Support for tags and notes

### 4. Excel Export

Output columns:
- Date
- Project (repository name)
- Type (Commit / PR Merge / Manual)
- Content (auto-classified)
- Details (commit message)
- Link (GitHub URL)
- Hours正指定日期
timesheet fixup --date 2025-12-15
```

---

## ⚙️ 配置

### VS Code Extension 設定

在 VCLI Commands

### Workspace Management

```bash
# Initialize new workspace
timesheet init [path] --name "Project Name"

# List all workspaces
timesheet workspace list

# Activate/deactivate workspace
timesheet workspace activate <id>
timesheet workspace deactivate <id>
```

### Query & Export

```bash
# View today's summary
timesheet summarize

# View specific date
timesheet summarize --date 2025-12-15

# Export timesheet
timesheet export --from 2025-12-01 --to 2025-12-31 --out report.xlsx

# Export specific workspace
timesheet export --workspace 1 --from 2025-12-01 --to 2025-12-31
```

### Interactive Editing

```bash
# Fix today's entries (hours/note/tag)
timesheet fixup

# Fix specific date
timesheet fixup --date 2025-12-15
## 🗄️ 資料庫架構

使用 SQLite 儲存資料（預設位置：`~/.timesheet-agent/timesheet.db`）

**核Configuration

### VS Code Settings

Configure in VS Code settings:
- `timesheetAgent.idleThresholdMinutes` - Idle threshold (default: 5)
- `timesheetAgent.checkIntervalSeconds` - Check interval (default: 30)
- `timesheetAgent.autoExport` - Auto-export (default: false)
- `timesheetAgent.databasePath` - Custom database path

### Workspace Configuration

Create `.timesheet/config.json` in workspace root for custom rules and settings.

---

## Database Schema

Uses SQLite (default: `~/.timesheet-agent/timesheet.db`)

**Core tables**:
- `workspaces` - Workspace definitions
- `sessions` - Work time periods
- `work_items` - Deliverables (commits/PRs)
- `allocations` - Time allocation to work items
- `configurations` - Configuration data

---

## Development

### Build & Test

```bash
# Build all packages
pnpm build

# Watch mode
pnpm dev

# Clean build artifacts
pnpm clean

# Lint
pnpm lint
```

### Project Structure

```
packages/
  core/
    src/
      db/           # Database layer
      model/        # Type definitions
      tracker/      # Session & activity tracking
      git/          # Git integration
  
  vscode-extension/
    src/
      extension.ts       # Extension entry
      telemetry/         # Activity recording
      ui/                # UI components
      commands/          # VS Code commands
  
  cli/
    src/
      index.ts           # CLI entry
      commands/          # Command implementations
```

For detailed development guide, see [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## Design Principles

Following guidelines from `.github/copilot-instructions.md`:

1. **Source of Truth** - VS Code events + Git commits
2. **Deterministic** - Rule-based classification, minimal AI dependency
3. **Auditable** - All data traceable and correctable
4. **Offline-First** - No network dependency required
5. **Flexible** - Multi-workspace support with customizable rules

---

## Roadmap

- [ ] Optional LLM-based auto-summarization
- [ ] Web dashboard
- [ ] Team collaboration features
- [ ] Extended Git platform support
- [ ] Advanced rule engine

---

## Contributing

Issues and Pull Requests are welcome!

Before contributing, please read:
- [.github/copilot-instructions.md](.github/copilot-instructions.md)
- [docs/Requirement.md](docs/Requirement.md)

---

## License

MIT License

---

## Links

- [繁體中文文檔](./README.zh-TW.md)
- [Development Guide](./DEVELOPMENT.md)
- [Version History](./VERSION_HISTORY.md)
- [Changelog](./CHANGELOG