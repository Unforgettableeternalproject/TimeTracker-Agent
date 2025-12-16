
---

# Copilot Instructions – Timesheet Agent

## Project Purpose

This project is an **automatic work time tracking agent** for developers.

Its goal is to:

* Automatically track **active working time** while using **VS Code (Insiders / Codespaces)**
* Exclude idle time based on defined activity rules
* Associate working time with **Git commits / PRs**
* Export records into an **Excel timesheet** that matches a predefined company format

This is **not** a generic time tracker.
All implementations must follow the design constraints below.

---

## Core Design Principles

### 1. Source of Truth

* Working time is derived from **VS Code activity events**
* Deliverables are derived from **Git commits / PR merges**
* Excel output is derived from **aggregated allocations**, not raw events

Do **not** invent alternative tracking mechanisms unless explicitly asked.

---

### 2. What Counts as “Active Work”

The system considers the user active when **any** of the following occurs:

* Text document change
* File save
* Cursor/selection change
* Terminal input/output
* VS Code window gains focus

If **no activity** occurs for more than `IDLE_THRESHOLD_MINUTES`
→ the session is considered idle and time must **not** be accumulated.

Do not track per-second logs.
Aggregate time into **active chunks**.

---

### 3. Data Model (Conceptual)

Copilot must respect this separation:

* **Session**

  * Represents continuous active work time
  * Knows nothing about commits or reporting

* **WorkItem**

  * Represents a deliverable (commit / PR merge / manual entry)
  * Contains title, detail, timestamp, and URL

* **Allocation**

  * Represents how session time is assigned to work items
  * This is what becomes rows in the Excel sheet

Do **not** collapse these into a single model.

---

### 4. Git Integration Rules

* Prefer local git data (`git log`) over GitHub API
* A commit defines a **boundary** for time allocation
* Active time accumulated since the previous work item
  is assigned to the current commit

Do not require network access to function.

---

### 5. Excel Output Rules

The exported Excel must match the following columns exactly:

1. 日期
2. 工作專案
3. 工作種類
4. 工作內容
5. 工作詳細
6. 實際工作成果連結 (GitHub)
7. 時數

* Excel formatting should come from a **template file**
* The program only fills data rows
* Time values are written in **hours (float)**

Do not redesign the output format.

---

### 6. Classification Strategy

Automatic classification should follow **deterministic rules first**:

* Repository name → 工作專案
* Commit type (`feat`, `fix`, `docs`, `refactor`, `chore`) → 工作內容
* Full commit message → 工作詳細

LLM-based summarization is **optional and secondary**.

---

### 7. VS Code Extension Scope

The extension is responsible for:

* Listening to VS Code activity events
* Detecting idle vs active state
* Writing session data to local storage
* Providing minimal commands (add note, tag, export)

The extension **must not**:

* Perform Excel generation
* Perform heavy aggregation logic
* Call external services by default

---

### 8. Coding Expectations

When generating code, Copilot should:

* Prefer clarity over cleverness
* Avoid premature optimization
* Keep logic deterministic and auditable
* Write code that can be explained to a non-AI reviewer

If requirements are unclear, **do not guess**.
Ask for clarification or leave TODO comments.

---

## Non-Goals (Do Not Implement Unless Explicitly Requested)

* Full project management system
* Issue tracker replacement
* AI-only automatic work description generation
* Cloud-only dependency
* OS-level keyboard/mouse tracking (unless asked)

---

## Summary

This project prioritizes:

* Accuracy over automation
* Auditability over intelligence
* Practical reporting over fancy analytics

Copilot should act as a **disciplined assistant**, not a product designer.

---