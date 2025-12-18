import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from '@timesheet-agent/core';

interface TimesheetRow {
  date: string;
  project: string;
  type: string;
  content: string;
  detail: string;
  url: string;
  hours: number;
}

/**
 * Export service for generating Excel timesheets
 */
export class ExportService {
  constructor(private db: DatabaseService) {}

  /**
   * Export timesheet data to Excel file
   */
  async exportToExcel(
    fromDate: string,
    toDate: string,
    outputPath: string,
    workspaceId?: number
  ): Promise<void> {
    // Query data
    const rows = this.queryTimesheetData(fromDate, toDate, workspaceId);

    if (rows.length === 0) {
      throw new Error('No data found for the specified period');
    }

    // Generate Excel
    await this.generateExcel(rows, outputPath);
  }

  /**
   * Query timesheet data from database
   */
  private queryTimesheetData(
    from: string,
    to: string,
    workspaceId?: number
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
      params.push(workspaceId);
    }

    sql += ' ORDER BY a.date, wi.occurred_at';

    const results = this.db.query(sql, params);

    return results.map((row: any) => ({
      date: row.date,
      project: row.project,
      type: this.mapWorkItemType(row.type),
      content: row.content,
      detail: row.detail || '',
      url: row.url || '',
      hours: row.hours,
    }));
  }

  /**
   * Map work item type to display text
   */
  private mapWorkItemType(type: string): string {
    const typeMap: Record<string, string> = {
      commit: 'Commit',
      pr_merge: 'PR Merge',
      manual: '手動輸入',
    };
    return typeMap[type] || type;
  }

  /**
   * Generate Excel file
   */
  private async generateExcel(
    rows: TimesheetRow[],
    outputPath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('工作時數');

    // Set up columns
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

    // Add data rows
    rows.forEach((row) => {
      const excelRow = worksheet.addRow({
        date: row.date,
        project: row.project,
        type: row.type,
        content: row.content,
        detail: row.detail,
        url: row.url,
        hours: row.hours,
      });

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

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save workbook
    await workbook.xlsx.writeFile(outputPath);
  }
}
