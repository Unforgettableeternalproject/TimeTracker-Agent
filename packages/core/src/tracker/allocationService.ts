import { DatabaseService } from '../db/db';
import { Allocation, WorkItem, Session } from '../model/types';

/**
 * Allocation service for automatically allocating session time to work items
 */
export class AllocationService {
  constructor(private db: DatabaseService) {}

  /**
   * Automatically allocate unallocated sessions to a work item
   * This is the core allocation logic that runs when a commit is detected
   */
  allocateSessionsToWorkItem(
    workItem: WorkItem,
    sessionIds?: number[]
  ): Allocation[] {
    // Get sessions to allocate
    let sessions: Session[];
    
    if (sessionIds && sessionIds.length > 0) {
      // Allocate specific sessions
      sessions = this.db.query<Session>(
        `SELECT * FROM sessions WHERE id IN (${sessionIds.map(() => '?').join(',')}) AND is_allocated = 0`,
        sessionIds
      );
    } else {
      // Allocate all unallocated sessions for this workspace since the last work item
      sessions = this.getUnallocatedSessionsSinceLastWorkItem(workItem.workspace_id);
    }

    if (sessions.length === 0) {
      return [];
    }

    // Group sessions by date and calculate total hours
    const dateGroups = this.groupSessionsByDate(sessions);
    const allocations: Allocation[] = [];

    for (const [date, dateSessions] of Object.entries(dateGroups)) {
      const totalSeconds = dateSessions.reduce((sum, s) => sum + s.active_seconds, 0);
      const hours = Math.round((totalSeconds / 3600) * 100) / 100; // Round to 2 decimal places

      if (hours > 0) {
        // Create allocation
        const result = this.db.execute(
          `INSERT INTO allocations (work_item_id, date, hours)
           VALUES (?, ?, ?)`,
          [workItem.id, date, hours]
        );

        const allocation = this.db.queryOne<Allocation>(
          'SELECT * FROM allocations WHERE id = ?',
          [result.lastInsertRowid]
        );

        if (allocation) {
          allocations.push(allocation);
        }
      }

      // Mark sessions as allocated
      const sessionIdList = dateSessions.map(s => s.id);
      if (sessionIdList.length > 0) {
        this.db.execute(
          `UPDATE sessions SET is_allocated = 1 WHERE id IN (${sessionIdList.map(() => '?').join(',')})`,
          sessionIdList
        );
      }
    }

    return allocations;
  }

  /**
   * Get unallocated sessions since the last work item in this workspace
   */
  private getUnallocatedSessionsSinceLastWorkItem(workspaceId: number): Session[] {
    // Find the last work item's timestamp
    const lastWorkItem = this.db.queryOne<WorkItem>(
      `SELECT * FROM work_items 
       WHERE workspace_id = ? 
       ORDER BY occurred_at DESC 
       LIMIT 1`,
      [workspaceId]
    );

    let sql = `
      SELECT * FROM sessions
      WHERE workspace_id = ? 
        AND is_allocated = 0 
        AND end_at IS NOT NULL
        AND active_seconds > 0
    `;
    const params: any[] = [workspaceId];

    if (lastWorkItem) {
      // Only get sessions after the last work item
      sql += ' AND start_at >= ?';
      params.push(lastWorkItem.occurred_at);
    }

    sql += ' ORDER BY start_at';

    return this.db.query<Session>(sql, params);
  }

  /**
   * Group sessions by date (YYYY-MM-DD)
   */
  private groupSessionsByDate(sessions: Session[]): Record<string, Session[]> {
    const groups: Record<string, Session[]> = {};

    for (const session of sessions) {
      const date = session.start_at.split('T')[0]; // Extract YYYY-MM-DD
      
      if (!groups[date]) {
        groups[date] = [];
      }
      
      groups[date].push(session);
    }

    return groups;
  }

  /**
   * Update allocation note
   */
  updateAllocationNote(allocationId: number, note: string): void {
    this.db.execute(
      `UPDATE allocations 
       SET note = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [note, allocationId]
    );
  }

  /**
   * Update allocation tag
   */
  updateAllocationTag(allocationId: number, tag: string): void {
    this.db.execute(
      `UPDATE allocations 
       SET tag = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [tag, allocationId]
    );
  }

  /**
   * Update allocation hours
   */
  updateAllocationHours(allocationId: number, hours: number): void {
    this.db.execute(
      `UPDATE allocations 
       SET hours = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [hours, allocationId]
    );
  }

  /**
   * Get allocations for a work item
   */
  getAllocationsForWorkItem(workItemId: number): Allocation[] {
    return this.db.query<Allocation>(
      'SELECT * FROM allocations WHERE work_item_id = ? ORDER BY date',
      [workItemId]
    );
  }

  /**
   * Get the most recent allocation (useful for note/tag commands)
   */
  getMostRecentAllocation(workspaceId: number): Allocation | undefined {
    const result = this.db.queryOne<Allocation>(
      `SELECT a.* FROM allocations a
       JOIN work_items wi ON a.work_item_id = wi.id
       WHERE wi.workspace_id = ?
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [workspaceId]
    );

    return result || undefined;
  }

  /**
   * Get total unallocated seconds for a workspace
   */
  getUnallocatedSeconds(workspaceId: number): number {
    const result = this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(active_seconds), 0) as total
       FROM sessions
       WHERE workspace_id = ? AND is_allocated = 0 AND end_at IS NOT NULL`,
      [workspaceId]
    );

    return result?.total || 0;
  }
}
