import * as vscode from 'vscode';
import {
  DatabaseService,
  WorkspaceManager,
  SessionService,
  GitService,
  Workspace,
  Session,
} from '@timesheet-agent/core';
import { ActivityRecorder } from './activityRecorder';

/**
 * Tracks multiple VS Code workspace folders
 */
export class WorkspaceTracker {
  private trackers = new Map<string, TrackerState>();
  private workspaceManager: WorkspaceManager;
  private sessionService: SessionService;
  private gitService: GitService;
  private checkInterval: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(private db: DatabaseService, private idleThreshold: number) {
    this.workspaceManager = new WorkspaceManager(db);
    this.sessionService = new SessionService(db);
    this.gitService = new GitService(db);
  }

  /**
   * Start tracking all workspace folders
   */
  start(): void {
    // Track existing workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        this.addWorkspace(folder);
      }
    }

    // Listen for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((e) => {
        e.added.forEach((folder) => this.addWorkspace(folder));
        e.removed.forEach((folder) => this.removeWorkspace(folder));
      })
    );

    // Start idle check interval
    this.checkInterval = setInterval(() => {
      this.checkIdleState();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop tracking
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // End all sessions
    for (const [, state] of this.trackers) {
      this.endSession(state);
      state.recorder.dispose();
    }

    this.trackers.clear();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * Add a workspace folder for tracking
   */
  private addWorkspace(folder: vscode.WorkspaceFolder): void {
    const folderPath = folder.uri.fsPath;

    if (this.trackers.has(folderPath)) {
      return; // Already tracking
    }

    // Get or create workspace in database
    const workspace = this.workspaceManager.getOrCreateWorkspace(folderPath, folder.name);

    // Get git info
    const repoRoot = this.gitService.getRepoRoot(folderPath);
    const repo = repoRoot
      ? this.gitService.parseRepoName(
          this.gitService.getRemoteUrl(repoRoot) || folderPath
        )
      : folder.name;
    const branch = repoRoot ? this.gitService.getCurrentBranch(repoRoot) : null;

    // Create session
    const session = this.sessionService.createSession({
      workspace_id: workspace.id,
      repo,
      branch: branch || undefined,
      start_at: new Date().toISOString(),
    });

    // Create activity recorder
    const recorder = new ActivityRecorder(this.db, workspace.id, folder, this.idleThreshold);

    this.trackers.set(folderPath, {
      workspace,
      session,
      recorder,
      folder,
      repo,
      branch: branch || undefined,
    });

    console.log(`Started tracking workspace: ${folder.name}`);
  }

  /**
   * Remove a workspace folder from tracking
   */
  private removeWorkspace(folder: vscode.WorkspaceFolder): void {
    const folderPath = folder.uri.fsPath;
    const state = this.trackers.get(folderPath);

    if (state) {
      this.endSession(state);
      state.recorder.dispose();
      this.trackers.delete(folderPath);
      console.log(`Stopped tracking workspace: ${folder.name}`);
    }
  }

  /**
   * Check idle state for all trackers
   */
  private checkIdleState(): void {
    for (const [, state] of this.trackers) {
      if (state.recorder.isIdle() && state.session) {
        // End current session due to idle
        this.endSession(state);

        // Create a new session ready for next activity
        const newSession = this.sessionService.createSession({
          workspace_id: state.workspace.id,
          repo: state.repo,
          branch: state.branch,
          start_at: new Date().toISOString(),
        });

        state.session = newSession;
      } else if (state.recorder.isActive() && state.session) {
        // Update active seconds
        const activeSeconds = state.recorder.getAccumulatedSeconds();
        if (activeSeconds > 0) {
          this.sessionService.updateSession(state.session.id, {
            active_seconds: activeSeconds,
          });
        }
      }
    }
  }

  /**
   * End a session
   */
  private endSession(state: TrackerState): void {
    if (state.session) {
      const activeSeconds = state.recorder.endSession();
      this.sessionService.updateSession(state.session.id, {
        end_at: new Date().toISOString(),
        active_seconds: activeSeconds,
      });
    }
  }

  /**
   * Get summary of current tracking state
   */
  getSummary(): TrackingSummary {
    let totalActiveSeconds = 0;
    const workspaces: string[] = [];

    for (const [, state] of this.trackers) {
      totalActiveSeconds += state.recorder.getAccumulatedSeconds();
      workspaces.push(state.workspace.workspace_name);
    }

    return {
      activeSeconds: totalActiveSeconds,
      workspaceCount: this.trackers.size,
      workspaces,
    };
  }

  /**
   * Get tracker for a specific workspace
   */
  getTracker(folderPath: string): TrackerState | undefined {
    return this.trackers.get(folderPath);
  }
}

interface TrackerState {
  workspace: Workspace;
  session: Session;
  recorder: ActivityRecorder;
  folder: vscode.WorkspaceFolder;
  repo: string;
  branch?: string;
}

interface TrackingSummary {
  activeSeconds: number;
  workspaceCount: number;
  workspaces: string[];
}
