import { createDatabase, WorkspaceManager } from '@timesheet-agent/core';
import chalk from 'chalk';

/**
 * Workspace management commands
 */
export function workspaceCommand(action: string, id?: string) {
  try {
    const db = createDatabase();
    const workspaceManager = new WorkspaceManager(db);

    switch (action) {
      case 'list':
        listWorkspaces(workspaceManager);
        break;

      case 'activate':
        if (!id) {
          console.error(chalk.red('❌ Workspace ID required'));
          process.exit(1);
        }
        activateWorkspace(workspaceManager, parseInt(id));
        break;

      case 'deactivate':
        if (!id) {
          console.error(chalk.red('❌ Workspace ID required'));
          process.exit(1);
        }
        deactivateWorkspace(workspaceManager, parseInt(id));
        break;

      case 'delete':
        if (!id) {
          console.error(chalk.red('❌ Workspace ID required'));
          process.exit(1);
        }
        deleteWorkspace(workspaceManager, parseInt(id));
        break;

      default:
        console.error(chalk.red(`❌ Unknown action: ${action}`));
        process.exit(1);
    }

    db.close();
  } catch (error) {
    console.error(chalk.red('❌ Workspace command failed:'), error);
    process.exit(1);
  }
}

function listWorkspaces(workspaceManager: WorkspaceManager) {
  const workspaces = workspaceManager.getAllWorkspaces();

  if (workspaces.length === 0) {
    console.log(chalk.yellow('⚠️  No workspaces found'));
    console.log(chalk.gray('   Use "timesheet init" to create a workspace'));
    return;
  }

  console.log(chalk.blue('📁 Workspaces:'));
  console.log();

  workspaces.forEach((ws) => {
    const status = ws.is_active ? chalk.green('●') : chalk.gray('○');
    console.log(`${status} ${chalk.cyan(`[${ws.id}]`)} ${ws.workspace_name}`);
    console.log(`   ${chalk.gray(ws.workspace_path)}`);
    console.log(`   ${chalk.gray(`Created: ${ws.created_at}`)}`);
    console.log();
  });
}

function activateWorkspace(workspaceManager: WorkspaceManager, id: number) {
  const workspace = workspaceManager.getWorkspace(id);

  if (!workspace) {
    console.error(chalk.red(`❌ Workspace not found: ${id}`));
    process.exit(1);
  }

  if (workspace.is_active) {
    console.log(chalk.yellow(`⚠️  Workspace is already active: ${workspace.workspace_name}`));
    return;
  }

  workspaceManager.setWorkspaceActive(id, true);
  console.log(chalk.green(`✅ Activated workspace: ${workspace.workspace_name}`));
}

function deactivateWorkspace(workspaceManager: WorkspaceManager, id: number) {
  const workspace = workspaceManager.getWorkspace(id);

  if (!workspace) {
    console.error(chalk.red(`❌ Workspace not found: ${id}`));
    process.exit(1);
  }

  if (!workspace.is_active) {
    console.log(chalk.yellow(`⚠️  Workspace is already inactive: ${workspace.workspace_name}`));
    return;
  }

  workspaceManager.setWorkspaceActive(id, false);
  console.log(chalk.green(`✅ Deactivated workspace: ${workspace.workspace_name}`));
}

function deleteWorkspace(workspaceManager: WorkspaceManager, id: number) {
  const workspace = workspaceManager.getWorkspace(id);

  if (!workspace) {
    console.error(chalk.red(`❌ Workspace not found: ${id}`));
    process.exit(1);
  }

  console.log(chalk.yellow(`⚠️  This will delete all data for: ${workspace.workspace_name}`));
  console.log(chalk.yellow('   This action cannot be undone!'));
  console.log();
  console.log(chalk.gray('   To confirm, run: timesheet workspace delete <id> --confirm'));

  // In a real implementation, you'd want a --confirm flag
  // For now, just showing the warning
}
