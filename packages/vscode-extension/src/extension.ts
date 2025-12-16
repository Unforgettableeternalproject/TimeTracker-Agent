import * as vscode from 'vscode';
import { WorkspaceTracker } from './telemetry/workspaceTracker';
import { StatusBarManager } from './ui/statusBar';
import { createDatabase } from '@timesheet-agent/core';

let workspaceTracker: WorkspaceTracker | undefined;
let statusBar: StatusBarManager | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Timesheet Agent is now active');

  // Get configuration
  const config = vscode.workspace.getConfiguration('timesheetAgent');
  const dbPath = config.get<string>('databasePath') || undefined;
  const idleThreshold = config.get<number>('idleThresholdMinutes') || 5;

  // Initialize database
  const db = createDatabase(dbPath);
  
  // Wait for database to be initialized
  await db.waitForInit();
  console.log('Database initialized');

  // Initialize workspace tracker
  workspaceTracker = new WorkspaceTracker(db, idleThreshold);
  await workspaceTracker.start();

  // Initialize status bar
  statusBar = new StatusBarManager(workspaceTracker);
  statusBar.show();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.addNote', async () => {
      const note = await vscode.window.showInputBox({
        prompt: 'Enter a note for current work',
        placeHolder: 'Working on feature X...',
      });

      if (note) {
        // TODO: Save note to current work item
        vscode.window.showInformationMessage(`Note saved: ${note}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.setTag', async () => {
      const tag = await vscode.window.showInputBox({
        prompt: 'Enter a tag for current work',
        placeHolder: 'frontend, backend, bugfix...',
      });

      if (tag) {
        // TODO: Save tag to current work item
        vscode.window.showInformationMessage(`Tag saved: ${tag}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.exportToday', async () => {
      // TODO: Export today's timesheet
      vscode.window.showInformationMessage('Export functionality coming soon!');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.switchWorkspace', async () => {
      // TODO: Show workspace picker
      vscode.window.showInformationMessage('Switch workspace functionality coming soon!');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.showSummary', async () => {
      if (workspaceTracker) {
        const summary = workspaceTracker.getSummary();
        vscode.window.showInformationMessage(
          `Active time today: ${Math.floor(summary.activeSeconds / 60)} minutes`
        );
      }
    })
  );

  // Configuration change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('timesheetAgent')) {
        vscode.window.showInformationMessage(
          'Timesheet Agent configuration changed. Please reload VS Code for changes to take effect.'
        );
      }
    })
  );

  context.subscriptions.push({
    dispose: () => {
      workspaceTracker?.stop();
      statusBar?.dispose();
      db.close();
    },
  });
}

/**
 * Extension deactivation
 */
export function deactivate() {
  workspaceTracker?.stop();
  statusBar?.dispose();
}
