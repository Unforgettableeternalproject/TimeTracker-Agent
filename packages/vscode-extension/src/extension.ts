import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceTracker } from './telemetry/workspaceTracker';
import { StatusBarManager } from './ui/statusBar';
import { ExportService } from './services/exportService';
import { 
  createDatabase, 
  WorkspaceManager, 
  SessionService,
  AllocationService,
  GitService,
  Session
} from '@timesheet-agent/core';

let workspaceTracker: WorkspaceTracker | undefined;
let statusBar: StatusBarManager | undefined;
let exportService: ExportService | undefined;

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

  // Initialize export service
  exportService = new ExportService(db);

  // Initialize allocation service
  const allocationService = new AllocationService(db);

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
        try {
          // Get current workspace
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
          }

          const workspace = workspaceManager.getWorkspaceByPath(workspaceFolder.uri.fsPath);
          if (!workspace) {
            vscode.window.showErrorMessage('Current workspace not found');
            return;
          }

          // Get most recent allocation
          const allocation = allocationService.getMostRecentAllocation(workspace.id);
          if (!allocation) {
            vscode.window.showErrorMessage('No recent work item to add note to');
            return;
          }

          // Update allocation with note
          allocationService.updateAllocationNote(allocation.id, note);
          vscode.window.showInformationMessage(`✅ Note saved!`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to save note: ${errorMessage}`);
        }
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
        try {
          // Get current workspace
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
          }

          const workspace = workspaceManager.getWorkspaceByPath(workspaceFolder.uri.fsPath);
          if (!workspace) {
            vscode.window.showErrorMessage('Current workspace not found');
            return;
          }

          // Get most recent allocation
          const allocation = allocationService.getMostRecentAllocation(workspace.id);
          if (!allocation) {
            vscode.window.showErrorMessage('No recent work item to add tag to');
            return;
          }

          // Update allocation with tag
          allocationService.updateAllocationTag(allocation.id, tag);
          vscode.window.showInformationMessage(`✅ Tag saved: ${tag}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to save tag: ${errorMessage}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.exportToday', async () => {
      try {
        // Get current workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        // Get current workspace from database
        const workspace = workspaceManager.getWorkspaceByPath(workspaceFolder.uri.fsPath);
        if (!workspace) {
          vscode.window.showErrorMessage('Current workspace not found in database');
          return;
        }

        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        // Determine output path
        const fileName = `工作時數_${workspace.workspace_name}_${today}.xlsx`;
        const outputPath = path.join(workspaceFolder.uri.fsPath, fileName);

        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting timesheet...',
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 30, message: 'Querying data...' });

            // Export to Excel
            if (!exportService) {
              throw new Error('Export service not initialized');
            }

            // Pass workspace ID to filter data
            await exportService.exportToExcel(today, today, outputPath, workspace.id);

            progress.report({ increment: 70, message: 'Writing file...' });
          }
        );

        // Show success message with option to open file
        const action = await vscode.window.showInformationMessage(
          `✅ Exported to: ${fileName}`,
          'Open File',
          'Show in Folder'
        );

        if (action === 'Open File') {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(outputPath)
          );
          await vscode.window.showTextDocument(doc);
        } else if (action === 'Show in Folder') {
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Export failed: ${errorMessage}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('timesheet-agent.switchWorkspace', async () => {
      try {
        // Get all workspaces
        const workspaces = workspaceManager.getAllWorkspaces();
        
        if (workspaces.length === 0) {
          vscode.window.showInformationMessage('No workspaces found. Open a folder to start tracking.');
          return;
        }

        // Get current workspace
        const currentFolder = vscode.workspace.workspaceFolders?.[0];
        const currentWorkspace = currentFolder 
          ? workspaceManager.getWorkspaceByPath(currentFolder.uri.fsPath)
          : undefined;

        // Create quick pick items
        const items = workspaces.map((ws) => ({
          label: ws.workspace_name,
          description: ws.workspace_path,
          detail: ws.id === currentWorkspace?.id ? '(Current workspace)' : undefined,
          workspace: ws,
        }));

        // Show picker
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a workspace to open',
          matchOnDescription: true,
        });

        if (selected) {
          // Open the selected workspace
          const uri = vscode.Uri.file(selected.workspace.workspace_path);
          await vscode.commands.executeCommand('vscode.openFolder', uri, false);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to switch workspace: ${errorMessage}`);
      }
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
