import * as path from 'path';
import * as fs from 'fs';
import { createDatabase, WorkspaceManager } from '@timesheet-agent/core';
import chalk from 'chalk';

interface InitOptions {
  name?: string;
}

/**
 * Init command - initialize tracking for a workspace
 */
export function initCommand(workspacePath: string = '.', options: InitOptions) {
  try {
    const absolutePath = path.resolve(workspacePath);

    if (!fs.existsSync(absolutePath)) {
      console.error(chalk.red(`❌ Path does not exist: ${absolutePath}`));
      process.exit(1);
    }

    const workspaceName = options.name || path.basename(absolutePath);

    console.log(chalk.blue('🚀 Initializing workspace...'));
    console.log(chalk.gray(`   Path: ${absolutePath}`));
    console.log(chalk.gray(`   Name: ${workspaceName}`));

    const db = createDatabase();
    const workspaceManager = new WorkspaceManager(db);

    // Check if workspace already exists
    const existing = workspaceManager.getWorkspaceByPath(absolutePath);

    if (existing) {
      console.log(chalk.yellow(`⚠️  Workspace already exists (ID: ${existing.id})`));
      console.log(chalk.gray(`   Name: ${existing.workspace_name}`));
      console.log(chalk.gray(`   Active: ${existing.is_active ? 'Yes' : 'No'}`));
    } else {
      const workspace = workspaceManager.createWorkspace({
        workspace_path: absolutePath,
        workspace_name: workspaceName,
        is_active: true,
      });

      console.log(chalk.green(`✅ Workspace created (ID: ${workspace.id})`));
    }

    // Create .timesheet directory for workspace-specific config
    const configDir = path.join(absolutePath, '.timesheet');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });

      // Create default config
      const defaultConfig = {
        idleThresholdMinutes: 5,
        classification: {
          customRules: [],
        },
        export: {
          defaultDateRange: 'month',
        },
      };

      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify(defaultConfig, null, 2)
      );

      console.log(chalk.green('✅ Created .timesheet/config.json'));
    }

    db.close();

    console.log();
    console.log(chalk.green('✨ Workspace is ready for tracking!'));
    console.log();
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('1. Open this workspace in VS Code with Timesheet Agent extension'));
    console.log(chalk.gray('2. Start working - tracking happens automatically'));
    console.log(chalk.gray('3. Use "timesheet summarize" to see your tracked time'));
  } catch (error) {
    console.error(chalk.red('❌ Init failed:'), error);
    process.exit(1);
  }
}
