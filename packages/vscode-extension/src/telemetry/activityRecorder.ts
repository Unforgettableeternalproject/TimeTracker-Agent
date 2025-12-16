import * as vscode from 'vscode';
import { DatabaseService, ActivityEvent, ActivityEventType } from '@timesheet-agent/core';
import { ActivityAggregator } from '@timesheet-agent/core';

/**
 * Activity recorder for capturing VS Code events
 */
export class ActivityRecorder {
  private disposables: vscode.Disposable[] = [];
  private aggregator: ActivityAggregator;
  private workspaceId: number;

  constructor(
    private db: DatabaseService,
    workspaceId: number,
    private folder: vscode.WorkspaceFolder,
    idleThreshold: number
  ) {
    this.workspaceId = workspaceId;
    this.aggregator = new ActivityAggregator(idleThreshold);
    this.setupListeners();
  }

  /**
   * Setup VS Code event listeners
   */
  private setupListeners(): void {
    // Text document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.isInWorkspace(e.document.uri)) {
          this.recordActivity('text_change');
        }
      })
    );

    // File saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (this.isInWorkspace(document.uri)) {
          this.recordActivity('file_save');
        }
      })
    );

    // Selection changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (this.isInWorkspace(e.textEditor.document.uri)) {
          this.recordActivity('selection_change');
        }
      })
    );

    // Window state changes
    this.disposables.push(
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          this.recordActivity('window_focus');
        } else {
          this.recordActivity('window_blur');
        }
      })
    );

    // Terminal data written (represents terminal activity)
    this.disposables.push(
      vscode.window.onDidWriteTerminalData(() => {
        this.recordActivity('terminal_input');
      })
    );
  }

  /**
   * Check if URI belongs to this workspace
   */
  private isInWorkspace(uri: vscode.Uri): boolean {
    return uri.fsPath.startsWith(this.folder.uri.fsPath);
  }

  /**
   * Record an activity event
   */
  private recordActivity(eventType: ActivityEventType): void {
    const event: ActivityEvent = {
      workspace_id: this.workspaceId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
    };

    this.aggregator.recordActivity(event);

    // Optionally log to database (for debugging)
    // this.db.execute(
    //   'INSERT INTO activity_logs (workspace_id, event_type, timestamp) VALUES (?, ?, ?)',
    //   [event.workspace_id, event.event_type, event.timestamp]
    // );
  }

  /**
   * Get accumulated active seconds
   */
  getAccumulatedSeconds(): number {
    return this.aggregator.getAccumulatedSeconds();
  }

  /**
   * Check if currently idle
   */
  isIdle(): boolean {
    return this.aggregator.checkIdle();
  }

  /**
   * Check if currently active
   */
  isActive(): boolean {
    return this.aggregator.isActive();
  }

  /**
   * End session and get total time
   */
  endSession(): number {
    return this.aggregator.endSession();
  }

  /**
   * Dispose of all listeners
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
