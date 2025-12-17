import * as vscode from 'vscode';
import { WorkspaceTracker } from './telemetry/workspaceTracker';
import { StatusBarManager } from './ui/statusBar';
import { 
  createDatabase, 
  WorkspaceManager, 
  SessionService,
  GitService,
  Session
} from '@timesheet-agent/core';

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

  // Initialize services
  const workspaceManager = new WorkspaceManager(db);
  const sessionService = new SessionService(db);

  // Initialize workspace tracker
  workspaceTracker = new WorkspaceTracker(db, idleThreshold);
  await workspaceTracker.start();

  // Initialize status bar
  statusBar = new StatusBarManager(workspaceTracker);
  statusBar.show();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.addWorkItem', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Work item title',
        placeHolder: 'e.g., Fixed authentication bug',
      });

      if (!title) return;

      const detail = await vscode.window.showInputBox({
        prompt: 'Work item details (optional)',
        placeHolder: 'Additional information...',
      });

      const hoursStr = await vscode.window.showInputBox({
        prompt: 'Hours spent (optional, will use unallocated time if not specified)',
        placeHolder: 'e.g., 2.5',
        validateInput: (value) => {
          if (value && isNaN(parseFloat(value))) {
            return 'Please enter a valid number';
          }
          return null;
        },
      });

      try {
        // Get current workspace
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        const workspace = workspaceManager.getOrCreateWorkspace(
          workspaceFolder.uri.fsPath,
          workspaceFolder.name
        );

        // Get repo name
        const gitService = new GitService();
        const repoRoot = gitService.getRepoRoot(workspaceFolder.uri.fsPath);
        const remoteUrl = repoRoot ? gitService.getRemoteUrl(repoRoot) : null;
        const repoName = remoteUrl 
          ? gitService.parseRepoName(remoteUrl) 
          : workspaceFolder.name;

        // Create work item
        const now = new Date().toISOString();
        const workItem = db.execute(
          `INSERT INTO work_items (workspace_id, repo, type, title, detail, occurred_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [workspace.id, repoName, 'manual', title, detail || title, now] as any[]
        );

        // Allocate time
        let hours = hoursStr ? parseFloat(hoursStr) : 0;
        
        if (!hoursStr) {
          // Use unallocated sessions
          const unallocatedSessions = sessionService.getUnallocatedSessions(workspace.id);
          const totalSeconds = unallocatedSessions.reduce(
            (sum: number, session: Session) => sum + (session.active_seconds || 0),
            0
          );
          hours = totalSeconds / 3600;

          // Mark sessions as allocated
          for (const session of unallocatedSessions) {
            sessionService.updateSession(session.id, { is_allocated: true });
          }
        }

        if (hours > 0) {
          const date = now.split('T')[0];
          db.execute(
            `INSERT INTO allocations (work_item_id, date, hours, created_at)
             VALUES (?, ?, ?, datetime('now'))`,
            [workItem.lastInsertRowid, date, hours] as any[]
          );
        }

        vscode.window.showInformationMessage(
          `✅ Work item added: ${title} (${hours.toFixed(2)}h)`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to add work item: ${error}`);
      }
    })
  );

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
