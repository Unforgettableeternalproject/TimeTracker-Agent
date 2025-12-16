import { format } from 'date-fns';
import inquirer from 'inquirer';
import { createDatabase } from '@timesheet-agent/core';
import chalk from 'chalk';

interface FixupOptions {
  date?: string;
  workspace?: string;
}

/**
 * Fixup command implementation - interactive editing of allocations
 */
export async function fixupCommand(options: FixupOptions) {
  try {
    const targetDate = options.date || format(new Date(), 'yyyy-MM-dd');

    console.log(chalk.blue(`🔧 Fixing up entries for ${targetDate}`));
    console.log();

    const db = createDatabase();

    // Get allocations for the date
    let sql = `
      SELECT 
        a.id,
        a.work_item_id,
        a.hours,
        a.note,
        a.tag,
        wi.title,
        wi.type,
        wi.repo
      FROM allocations a
      JOIN work_items wi ON a.work_item_id = wi.id
      WHERE a.date = ?
    `;

    const params: any[] = [targetDate];

    if (options.workspace) {
      sql += ' AND wi.workspace_id = ?';
      params.push(parseInt(options.workspace));
    }

    const allocations = db.query(sql, params) as any[];

    if (allocations.length === 0) {
      console.log(chalk.yellow('⚠️  No allocations found for this date'));
      db.close();
      return;
    }

    // Interactive editing
    for (const allocation of allocations) {
      console.log(chalk.cyan(`\n📌 ${allocation.title}`));
      console.log(chalk.gray(`   Repo: ${allocation.repo}`));
      console.log(chalk.gray(`   Type: ${allocation.type}`));
      console.log(chalk.gray(`   Current hours: ${allocation.hours}`));
      if (allocation.note) {
        console.log(chalk.gray(`   Note: ${allocation.note}`));
      }
      if (allocation.tag) {
        console.log(chalk.gray(`   Tag: ${allocation.tag}`));
      }

      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'edit',
          message: 'Edit this entry?',
          default: false,
        },
      ]);

      if (answers.edit) {
        const edits = await inquirer.prompt([
          {
            type: 'number',
            name: 'hours',
            message: 'Hours:',
            default: allocation.hours,
          },
          {
            type: 'input',
            name: 'note',
            message: 'Note:',
            default: allocation.note || '',
          },
          {
            type: 'input',
            name: 'tag',
            message: 'Tag:',
            default: allocation.tag || '',
          },
        ]);

        // Update allocation
        db.execute(
          `UPDATE allocations 
           SET hours = ?, note = ?, tag = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [edits.hours, edits.note || null, edits.tag || null, allocation.id]
        );

        console.log(chalk.green('✅ Updated'));
      }
    }

    console.log(chalk.green('\n✅ Fixup complete'));

    db.close();
  } catch (error) {
    console.error(chalk.red('❌ Fixup failed:'), error);
    process.exit(1);
  }
}
