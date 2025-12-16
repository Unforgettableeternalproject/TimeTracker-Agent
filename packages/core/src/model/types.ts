/**
 * Core type definitions for timesheet tracking
 */

// ============================================================================
// Workspace Types
// ============================================================================

export interface Workspace {
  id: number;
  workspace_path: string;
  workspace_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceCreateInput {
  workspace_path: string;
  workspace_name: string;
  is_active?: boolean;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: number;
  workspace_id: number;
  repo: string;
  branch: string | null;
  start_at: string;
  end_at: string | null;
  active_seconds: number;
  is_allocated: boolean;
  created_at: string;
}

export interface SessionCreateInput {
  workspace_id: number;
  repo: string;
  branch?: string;
  start_at: string;
}

export interface SessionUpdateInput {
  end_at?: string;
  active_seconds?: number;
  is_allocated?: boolean;
}

// ============================================================================
// Work Item Types
// ============================================================================

export type WorkItemType = 'commit' | 'pr_merge' | 'manual';

export interface WorkItem {
  id: number;
  workspace_id: number;
  repo: string;
  type: WorkItemType;
  title: string;
  detail: string | null;
  occurred_at: string;
  url: string | null;
  commit_sha: string | null;
  pr_number: number | null;
  created_at: string;
}

export interface WorkItemCreateInput {
  workspace_id: number;
  repo: string;
  type: WorkItemType;
  title: string;
  detail?: string;
  occurred_at: string;
  url?: string;
  commit_sha?: string;
  pr_number?: number;
}

// ============================================================================
// Allocation Types
// ============================================================================

export interface Allocation {
  id: number;
  work_item_id: number;
  date: string;
  hours: number;
  note: string | null;
  tag: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllocationCreateInput {
  work_item_id: number;
  date: string;
  hours: number;
  note?: string;
  tag?: string;
}

export interface AllocationUpdateInput {
  hours?: number;
  note?: string;
  tag?: string;
}

// ============================================================================
// Timesheet Export Types
// ============================================================================

export interface TimesheetRow {
  date: string;              // 日期
  project: string;           // 工作專案
  type: string;              // 工作種類
  content: string;           // 工作內容
  detail: string;            // 工作詳細
  url: string;               // 實際工作成果連結
  hours: number;             // 時數
}

export interface TimesheetExportOptions {
  from: string;              // YYYY-MM-DD
  to: string;                // YYYY-MM-DD
  workspace_id?: number;     // Optional: filter by workspace
  template_path?: string;    // Optional: custom template
  output_path?: string;      // Optional: output file path
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface Configuration {
  id: number;
  workspace_id: number | null;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigData {
  idleThresholdMinutes: number;
  classification: {
    projectNameOverride?: string;
    customRules: ClassificationRule[];
  };
  export: {
    templatePath?: string;
    defaultDateRange: 'day' | 'week' | 'month';
  };
  git: {
    provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops' | 'auto';
    remoteOverride?: string;
  };
}

export interface ClassificationRule {
  pattern: string;           // Regex or glob pattern
  field: 'path' | 'commit_message' | 'branch';
  category: string;          // 工作內容 category
  priority: number;          // Higher = more priority
}

// ============================================================================
// Activity Types
// ============================================================================

export type ActivityEventType =
  | 'text_change'
  | 'file_save'
  | 'selection_change'
  | 'terminal_input'
  | 'window_focus'
  | 'window_blur';

export interface ActivityEvent {
  workspace_id: number;
  event_type: ActivityEventType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityLog {
  id: number;
  workspace_id: number;
  event_type: string;
  data: string | null;
  timestamp: string;
}

// ============================================================================
// Git Types
// ============================================================================

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  files_changed: string[];
}

export interface GitProvider {
  name: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';
  detectProvider(remote: string): boolean;
  buildCommitUrl(repo: string, sha: string): string;
  buildPRUrl(repo: string, prNumber: number): string;
}

// ============================================================================
// Aggregation Types
// ============================================================================

export interface SessionSummary {
  workspace_id: number;
  workspace_name: string;
  date: string;
  total_active_seconds: number;
  session_count: number;
  allocated_seconds: number;
  unallocated_seconds: number;
}

export interface WorkItemWithAllocation extends WorkItem {
  allocation?: Allocation;
}

// ============================================================================
// Database Types
// ============================================================================

export interface DatabaseOptions {
  path: string;
  readonly?: boolean;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
}
