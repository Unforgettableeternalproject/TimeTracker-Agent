import { DatabaseService } from '../db/db';
import { Workspace, WorkspaceCreateInput } from '../model/types';

/**
 * Workspace manager for handling multiple workspaces
 */
export class WorkspaceManager {
  constructor(private db: DatabaseService) {}

  /**
   * Create a new workspace
   */
  createWorkspace(input: WorkspaceCreateInput): Workspace {
    const result = this.db.execute(
      `INSERT INTO workspaces (workspace_path, workspace_name, is_active)
       VALUES (?, ?, ?)`,
      [input.workspace_path, input.workspace_name, input.is_active !== false ? 1 : 0]
    );

    const workspace = this.db.queryOne<Workspace>(
      'SELECT * FROM workspaces WHERE id = ?',
      [result.lastInsertRowid]
    );

    if (!workspace) {
      throw new Error('Failed to create workspace');
    }

    return this.normalizeWorkspace(workspace);
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(id: number): Workspace | undefined {
    const workspace = this.db.queryOne<Workspace>(
      'SELECT * FROM workspaces WHERE id = ?',
      [id]
    );

    return workspace ? this.normalizeWorkspace(workspace) : undefined;
  }

  /**
   * Get workspace by path
   */
  getWorkspaceByPath(path: string): Workspace | undefined {
    const workspace = this.db.queryOne<Workspace>(
      'SELECT * FROM workspaces WHERE workspace_path = ?',
      [path]
    );

    return workspace ? this.normalizeWorkspace(workspace) : undefined;
  }

  /**
   * Get or create workspace
   */
  getOrCreateWorkspace(path: string, name: string): Workspace {
    const existing = this.getWorkspaceByPath(path);
    if (existing) {
      return existing;
    }

    return this.createWorkspace({ workspace_path: path, workspace_name: name });
  }

  /**
   * Get all workspaces
   */
  getAllWorkspaces(): Workspace[] {
    const workspaces = this.db.query<Workspace>(
      'SELECT * FROM workspaces ORDER BY created_at DESC'
    );

    return workspaces.map((w) => this.normalizeWorkspace(w));
  }

  /**
   * Get active workspaces
   */
  getActiveWorkspaces(): Workspace[] {
    const workspaces = this.db.query<Workspace>(
      'SELECT * FROM workspaces WHERE is_active = 1 ORDER BY created_at DESC'
    );

    return workspaces.map((w) => this.normalizeWorkspace(w));
  }

  /**
   * Update workspace
   */
  updateWorkspace(
    id: number,
    updates: { workspace_name?: string; is_active?: boolean }
  ): Workspace {
    const fields: string[] = ['updated_at = datetime("now")'];
    const params: unknown[] = [];

    if (updates.workspace_name !== undefined) {
      fields.push('workspace_name = ?');
      params.push(updates.workspace_name);
    }

    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }

    params.push(id);

    this.db.execute(
      `UPDATE workspaces SET ${fields.join(', ')} WHERE id = ?`,
      params as any[]
    );

    const workspace = this.getWorkspace(id);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return workspace;
  }

  /**
   * Delete workspace and all related data
   */
  deleteWorkspace(id: number): void {
    this.db.execute('DELETE FROM workspaces WHERE id = ?', [id]);
  }

  /**
   * Set workspace as active/inactive
   */
  setWorkspaceActive(id: number, is_active: boolean): Workspace {
    return this.updateWorkspace(id, { is_active });
  }

  /**
   * Normalize workspace data (convert integers to booleans)
   */
  private normalizeWorkspace(workspace: any): Workspace {
    return {
      ...workspace,
      is_active: Boolean(workspace.is_active),
    };
  }
}
