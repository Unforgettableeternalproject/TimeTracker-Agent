import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { format } from 'date-fns';
import { createDatabase, TimesheetRow } from '@timesheet-agent/core';
import chalk from 'chalk';

interface ExportOptions {
  from?: string;
  to?: string;
  workspace?: string;
  out?: string;
  template?: string;
}

/**
 * Export command implementation
 */
export async function exportCommand(options: ExportOptions) {
  try {
    console.log(chalk.blue('📊 Exporting timesheet...'));

    // Parse dates
    const fromDate = options.from || format(new Date(), 'yyyy-MM-dd');
    const toDate = options.to || format(new Date(), 'yyyy-MM-dd');

    console.log(chalk.gray(`Date range: ${fromDate} to ${toDate}`));

    // Initialize database
    const db = createDatabase();

    // Query data
    const rows = queryTimesheetData(db, fromDate, toDate, options.workspace);

    if (rows.length === 0) {
      console.log(chalk.yellow('⚠️  No data found for the specified period'));
      return;
    }

    console.log(chalk.gray(`Found ${rows.length} entries`));

    // Determine output path
    const outputPath =
      options.out ||
      path.join(
        process.cwd(),
        `工作時數_${fromDate}_${toDate}.xlsx`
      );

    // Export to Excel
    await exportToExcel(rows, outputPath, options.template);

    console.log(chalk.green(`✅ Exported to: ${outputPath}`));

    db.close();
  } catch (error) {
    console.error(chalk.red('❌ Export failed:'), error);
    process.exit(1);
  }
}

/**
 * Query timesheet data from database
 */
function queryTimesheetData(
  db: any,
  from: string,
  to: string,
  workspaceId?: string
): TimesheetRow[] {
  let sql = `
    SELECT 
      a.date,
      wi.repo as project,
      wi.type,
      wi.title as content,
      wi.detail,
      wi.url,
      a.hours
    FROM allocations a
    JOIN work_items wi ON a.work_item_id = wi.id
    WHERE a.date >= ? AND a.date <= ?
  `;

  const params: any[] = [from, to];

  if (workspaceId) {
    sql += ' AND wi.workspace_id = ?';
    params.push(parseInt(workspaceId));
  }

  sql += ' ORDER BY a.date, wi.occurred_at';

  const results = db.query(sql, params);

  return results.map((row: any) => ({
    date: row.date,
    project: row.project,
    type: mapWorkItemType(row.type),
    content: row.content,
    detail: row.detail || '',
    url: row.url || '',
    hours: row.hours,
  }));
}

/**
 * Map work item type to Chinese display text
 */
function mapWorkItemType(type: string): string {
  const typeMap: Record<string, string> = {
    commit: 'Commit',
    pr_merge: 'PR Merge',
    manual: '手動輸入',
  };
  return typeMap[type] || type;
}

/**
 * Export data to Excel file
 */
async function exportToExcel(
  rows: TimesheetRow[],
  outputPath: string,
  templatePath?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // Load template if provided
  if (templatePath && fs.existsSync(templatePath)) {
    await workbook.xlsx.readFile(templatePath);
  }

  // Get or create worksheet
  let worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    worksheet = workbook.addWorksheet('工作時數');
  }

  // Set up headers if not in template
  if (!worksheet.getRow(1).hasValues) {
    worksheet.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '工作專案', key: 'project', width: 20 },
      { header: '工作種類', key: 'type', width: 15 },
      { header: '工作內容', key: 'content', width: 30 },
      { header: '工作詳細', key: 'detail', width: 40 },
      { header: '實際工作成果連結 (GitHub)', key: 'url', width: 50 },
      { header: '時數', key: 'hours', width: 10 },
    ];

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
  }

  // Find starting row (skip header)
  let startRow = 2;
  while (worksheet.getRow(startRow).hasValues) {
    startRow++;
  }

  // Add data rows
  rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(startRow + index);
    excelRow.values = [
      row.date,
      row.project,
      row.type,
      row.content,
      row.detail,
      row.url,
      row.hours,
    ];

    // Add hyperlink if URL exists
    if (row.url) {
      const urlCell = excelRow.getCell(6);
      urlCell.value = {
        text: row.url,
        hyperlink: row.url,
      };
      urlCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }
  });

  // Save workbook
  await workbook.xlsx.writeFile(outputPath);
}
