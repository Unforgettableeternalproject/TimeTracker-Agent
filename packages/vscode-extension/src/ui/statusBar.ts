import * as vscode from 'vscode';
import { WorkspaceTracker } from '../telemetry/workspaceTracker';

/**
 * Status bar manager for showing tracking status
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private updateInterval: NodeJS.Timeout | undefined;

  constructor(private tracker: WorkspaceTracker) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'timesheet-agent.showSummary';
    this.setupUpdateInterval();
  }

  /**
   * Setup periodic status update
   */
  private setupUpdateInterval(): void {
    this.updateInterval = setInterval(() => {
      this.update();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update status bar display
   */
  update(): void {
    const summary = this.tracker.getSummary();
    const minutes = Math.floor(summary.activeSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    let timeText: string;
    if (hours > 0) {
      timeText = `${hours}h ${remainingMinutes}m`;
    } else {
      timeText = `${minutes}m`;
    }

    this.statusBarItem.text = `$(clock) ${timeText}`;

    const workspaceText =
      summary.workspaceCount === 1
        ? summary.workspaces[0]
        : `${summary.workspaceCount} workspaces`;

    this.statusBarItem.tooltip = `Active work time: ${timeText}\nTracking: ${workspaceText}`;
  }

  /**
   * Show status bar item
   */
  show(): void {
    this.update();
    this.statusBarItem.show();
  }

  /**
   * Hide status bar item
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Dispose of status bar item
   */
  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.statusBarItem.dispose();
  }
}
