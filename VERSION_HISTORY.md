# Version History

*Last updated: 2024-12-16*

This file contains the version history and release notes for TimeTracker Agent.

---

## v0.1.0 (2024-12-16)
**Type**: Initial Release

### Changes
- Initial project structure with monorepo setup
- Core package with database, session tracking, and Git integration
- VS Code extension with activity recording and multi-workspace support
- CLI tools for export, summarize, and workspace management
- Support for GitHub, GitLab, Bitbucket, and Azure DevOps
- Excel export with customizable templates
- Automatic idle detection and time aggregation

### Components
- **Core Package** (v0.1.0)
  - SQLite database with multi-workspace support
  - Session and WorkItem management
  - Git service with multi-platform provider support
  - Activity aggregator with idle policy
  
- **VS Code Extension** (v0.1.0)
  - Activity recorder for VS Code events
  - Workspace tracker for multi-folder support
  - Status bar integration
  - Commands: addNote, setTag, exportToday, switchWorkspace, showSummary
  
- **CLI Package** (v0.1.0)
  - init - Initialize new workspace
  - export - Export timesheet to Excel
  - summarize - View time summary
  - fixup - Interactive entry editing
  - workspace - Workspace management

---
