import { format } from 'date-fns';
import { createDatabase } from '@timesheet-agent/core';
import chalk from 'chalk';

interface SummarizeOptions {
  date?: string;
  workspace?: string;
}

/**
 * Summarize command implementation
 */
export async function summarizeCommand(options: SummarizeOptions) {
  try {
    const targetDate = options.date || format(new Date(), 'yyyy-MM-dd');

    console.log(chalk.blue(`📅 Summary for ${targetDate}`));
    console.log();

    const db = createDatabase();
    await db.waitForInit();

    // Get total active time
    let sql = `
      SELECT 
        SUM(active_seconds) as total_seconds,
        COUNT(*) as session_count
      FROM sessions
      WHERE date(start_at) = ?
    `;

    const params: any[] = [targetDate];

    if (options.workspace) {
      sql += ' AND workspace_id = ?';
      params.push(parseInt(options.workspace));
    }

    const timeStats = db.queryOne(sql, params) as any;

    const totalHours = (timeStats.total_seconds || 0) / 3600;
    const totalMinutes = Math.floor(((timeStats.total_seconds || 0) % 3600) / 60);

    console.log(chalk.cyan('⏱️  Active Time:'));
    console.log(`   ${totalHours.toFixed(0)}h ${totalMinutes}m (${timeStats.session_count || 0} sessions)`);
    console.log();

    // Get work items
    sql = `
      SELECT 
        wi.type,
        wi.title,
        wi.repo,
        a.hours
      FROM work_items wi
      LEFT JOIN allocations a ON wi.id = a.work_item_id
      WHERE date(wi.occurred_at) = ?
    `;

    params.length = 1;
    if (options.workspace) {
      sql += ' AND wi.workspace_id = ?';
      params.push(parseInt(options.workspace));
    }

    sql += ' ORDER BY wi.occurred_at';

    const workItems = db.query(sql, params) as any[];

    if (workItems.length > 0) {
      console.log(chalk.cyan('📝 Work Items:'));
      workItems.forEach((item: any, index: number) => {
        const hours = item.hours ? `(${item.hours.toFixed(1)}h)` : '(not allocated)';
        console.log(`   ${index + 1}. [${item.type}] ${item.title} ${chalk.gray(hours)}`);
        console.log(`      ${chalk.gray(item.repo)}`);
      });
    } else {
      console.log(chalk.yellow('⚠️  No work items found'));
    }

    console.log();

    // Get unallocated time
    sql = `
      SELECT SUM(active_seconds) as unallocated
      FROM sessions
      WHERE date(start_at) = ? AND is_allocated = 0
    `;

    params.length = 1;
    if (options.workspace) {
      sql += ' AND workspace_id = ?';
      params.push(parseInt(options.workspace));
    }

    const unallocated = db.queryOne(sql, params) as any;
    const unallocatedMinutes = Math.floor((unallocated?.unallocated || 0) / 60);

    if (unallocatedMinutes > 0) {
      console.log(chalk.yellow(`⚠️  Unallocated time: ${unallocatedMinutes} minutes`));
      console.log(chalk.gray('   Tip: Use "timesheet fixup" to allocate this time'));
    }

    db.close();
    db.close();
  } catch (error) {
    console.error(chalk.red('❌ Summarize failed:'), error);
    process.exit(1);
  }
}
