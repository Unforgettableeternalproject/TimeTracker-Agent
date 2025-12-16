#!/usr/bin/env node

import { Command } from 'commander';
import { exportCommand } from './commands/export';
import { summarizeCommand } from './commands/summarize';
import { fixupCommand } from './commands/fixup';
import { initCommand } from './commands/init';
import { workspaceCommand } from './commands/workspace';

const program = new Command();

program
  .name('timesheet')
  .description('Timesheet Agent - Automatic work time tracking for developers')
  .version('0.1.0');

// Export command
program
  .command('export')
  .description('Export timesheet to Excel')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--workspace <id>', 'Workspace ID (optional)')
  .option('--out <path>', 'Output file path')
  .option('--template <path>', 'Custom template path')
  .action(exportCommand);

// Summarize command
program
  .command('summarize')
  .description('Show summary of tracked time')
  .option('--date <date>', 'Date to summarize (YYYY-MM-DD, default: today)')
  .option('--workspace <id>', 'Workspace ID (optional)')
  .action(summarizeCommand);

// Fixup command
program
  .command('fixup')
  .description('Interactively fix/update timesheet entries')
  .option('--date <date>', 'Date to fix up (YYYY-MM-DD, default: today)')
  .option('--workspace <id>', 'Workspace ID (optional)')
  .action(fixupCommand);

// Init command
program
  .command('init')
  .description('Initialize timesheet tracking for a workspace')
  .argument('[path]', 'Workspace path (default: current directory)')
  .option('--name <name>', 'Workspace name')
  .action(initCommand);

// Workspace management
const workspaceCmd = program
  .command('workspace')
  .description('Manage workspaces');

workspaceCmd
  .command('list')
  .description('List all workspaces')
  .action(() => workspaceCommand('list'));

workspaceCmd
  .command('activate <id>')
  .description('Activate a workspace')
  .action((id) => workspaceCommand('activate', id));

workspaceCmd
  .command('deactivate <id>')
  .description('Deactivate a workspace')
  .action((id) => workspaceCommand('deactivate', id));

workspaceCmd
  .command('delete <id>')
  .description('Delete a workspace and all its data')
  .action((id) => workspaceCommand('delete', id));

program.parse();
