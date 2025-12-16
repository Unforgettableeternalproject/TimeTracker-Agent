import { DatabaseService } from '../db/db';
import {
  Workspace,
  WorkspaceCreateInput,
  Session,
  SessionCreateInput,
  SessionUpdateInput,
} from '../model/types';

/**
 * Session service for managing work sessions
 */
export class SessionService {
  constructor(private db: DatabaseService) {}

  /**
   * Create a new session
   */
  createSession(input: SessionCreateInput): Session {
    const result = this.db.execute(
      `INSERT INTO sessions (workspace_id, repo, branch, start_at)
       VALUES (?, ?, ?, ?)`,
      [input.workspace_id, input.repo, input.branch || null, input.start_at]
    );

    const session = this.db.queryOne<Session>(
      'SELECT * FROM sessions WHERE id = ?',
      [result.lastInsertRowid]
    );

    if (!session) {
      throw new Error('Failed to create session');
    }

    return this.normalizeSession(session);
  }

  /**
   * Get current active session for a workspace
   */
  getCurrentSession(workspace_id: number): Session | undefined {
    const session = this.db.queryOne<Session>(
      `SELECT * FROM sessions 
       WHERE workspace_id = ? AND end_at IS NULL 
       ORDER BY start_at DESC LIMIT 1`,
      [workspace_id]
    );

    return session ? this.normalizeSession(session) : undefined;
  }

  /**
   * Update a session
   */
  updateSession(id: number, input: SessionUpdateInput): Session {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.end_at !== undefined) {
      updates.push('end_at = ?');
      params.push(input.end_at);
    }

    if (input.active_seconds !== undefined) {
      updates.push('active_seconds = ?');
      params.push(input.active_seconds);
    }

    if (input.is_allocated !== undefined) {
      updates.push('is_allocated = ?');
      params.push(input.is_allocated ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);

    this.db.execute(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const session = this.db.queryOne<Session>(
      'SELECT * FROM sessions WHERE id = ?',
      [id]
    );

    if (!session) {
      throw new Error('Session not found');
    }

    return this.normalizeSession(session);
  }

  /**
   * End current session for a workspace
   */
  endCurrentSession(workspace_id: number, end_at: string, active_seconds: number): Session | null {
    const current = this.getCurrentSession(workspace_id);
    if (!current) {
      return null;
    }

    return this.updateSession(current.id, { end_at, active_seconds });
  }

  /**
   * Get sessions by date range
   */
  getSessionsByDateRange(
    workspace_id: number,
    from: string,
    to: string
  ): Session[] {
    const sessions = this.db.query<Session>(
      `SELECT * FROM sessions 
       WHERE workspace_id = ? 
       AND date(start_at) >= date(?) 
       AND date(start_at) <= date(?)
       ORDER BY start_at`,
      [workspace_id, from, to]
    );

    return sessions.map((s) => this.normalizeSession(s));
  }

  /**
   * Get unallocated sessions
   */
  getUnallocatedSessions(workspace_id: number): Session[] {
    const sessions = this.db.query<Session>(
      `SELECT * FROM sessions 
       WHERE workspace_id = ? AND is_allocated = 0 AND end_at IS NOT NULL
       ORDER BY start_at`,
      [workspace_id]
    );

    return sessions.map((s) => this.normalizeSession(s));
  }

  /**
   * Mark sessions as allocated
   */
  markSessionsAsAllocated(session_ids: number[]): void {
    if (session_ids.length === 0) return;

    const placeholders = session_ids.map(() => '?').join(',');
    this.db.execute(
      `UPDATE sessions SET is_allocated = 1 WHERE id IN (${placeholders})`,
      session_ids
    );
  }

  /**
   * Get total active time for a date range
   */
  getTotalActiveTime(workspace_id: number, from: string, to: string): number {
    const result = this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(active_seconds), 0) as total
       FROM sessions 
       WHERE workspace_id = ? 
       AND date(start_at) >= date(?) 
       AND date(start_at) <= date(?)`,
      [workspace_id, from, to]
    );

    return result?.total || 0;
  }

  /**
   * Delete old sessions (cleanup)
   */
  deleteOldSessions(before: string): number {
    const result = this.db.execute(
      'DELETE FROM sessions WHERE date(start_at) < date(?)',
      [before]
    );

    return result.changes;
  }

  /**
   * Normalize session data (convert integers to booleans)
   */
  private normalizeSession(session: any): Session {
    return {
      ...session,
      is_allocated: Boolean(session.is_allocated),
    };
  }
}
