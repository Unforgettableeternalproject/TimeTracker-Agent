import * as vscode from 'vscode';
import {
  DatabaseService,
  WorkspaceManager,
  SessionService,
  AllocationService,
  GitService,
  GitCommit,
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
  private allocationService: AllocationService;
  private gitService: GitService;
  private db: DatabaseService;
  private checkInterval: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(db: DatabaseService, private idleThreshold: number) {
    this.db = db;
    this.workspaceManager = new WorkspaceManager(db);
    this.sessionService = new SessionService(db);
    this.allocationService = new AllocationService(db);
    this.gitService = new GitService();
  }

  /**
   * Start tracking all workspace folders
   */
  async start(): Promise<void> {
    // Track existing workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        await this.addWorkspace(folder);
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
  private async addWorkspace(folder: vscode.WorkspaceFolder): Promise<void> {
    const folderPath = folder.uri.fsPath;

    if (this.trackers.has(folderPath)) {
      return; // Already tracking
    }

    try {
      console.log(`[TimeTracker] Starting to track workspace: ${folder.name} at ${folderPath}`);
      
      // Get or create workspace in database
      console.log(`[TimeTracker] Creating/getting workspace in database...`);
      const workspace = this.workspaceManager.getOrCreateWorkspace(folderPath, folder.name);
      console.log(`[TimeTracker] Workspace created/retrieved: ID=${workspace.id}`);

      // Get git info
      console.log(`[TimeTracker] Getting Git info...`);
      const repoRoot = this.gitService.getRepoRoot(folderPath);
      console.log(`[TimeTracker] Git repo root: ${repoRoot || 'Not a git repository'}`);
      
      let repo = folder.name;
      let branch: string | null = null;
      
      if (repoRoot) {
        // Try to get remote URL for repo name
        const remoteUrl = this.gitService.getRemoteUrl(repoRoot);
        if (remoteUrl) {
          repo = this.gitService.parseRepoName(remoteUrl);
        }
        
        // Get branch (will return default branch name if no commits yet)
        branch = this.gitService.getCurrentBranch(repoRoot);
      }
      
      console.log(`[TimeTracker] Repo: ${repo}, Branch: ${branch || 'N/A'}`);

      // Create session (using folder open time as start)
      console.log(`[TimeTracker] Creating session...`);
      const session = this.sessionService.createSession({
        workspace_id: workspace.id,
        repo,
        branch: branch || undefined,
        start_at: new Date().toISOString(),
      });
      console.log(`[TimeTracker] Session created: ID=${session.id}`);

      // Create activity recorder
      console.log(`[TimeTracker] Creating activity recorder...`);
      const recorder = new ActivityRecorder(workspace.id, folder, this.idleThreshold);

      // Setup Git commit watcher
      if (repoRoot) {
        console.log(`[TimeTracker] Setting up Git watcher...`);
        this.setupGitWatcher(folderPath, workspace.id, repoRoot);
      }

      this.trackers.set(folderPath, {
        workspace,
        session,
        recorder,
        folder,
        repo,
        branch: branch || undefined,
      });

      console.log(`[TimeTracker] ✓ Successfully started tracking workspace: ${folder.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      
      console.error(`[TimeTracker] ✗ Failed to track workspace ${folder.name}:`, errorMessage);
      console.error(`[TimeTracker] Error stack:`, errorStack);
      console.error(`[TimeTracker] Full error object:`, error);
      
      vscode.window.showErrorMessage(
        `TimeTracker: Failed to track workspace "${folder.name}": ${errorMessage}`
      );
    }
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
   * Setup Git commit watcher for a workspace
   */
  private setupGitWatcher(_folderPath: string, workspaceId: number, repoRoot: string): void {
    // First, check if there are any existing commits that we haven't processed yet
    const recentCommits = this.gitService.getRecentCommits(repoRoot, '7 days ago', 50);

    console.log(`[TimeTracker] Found ${recentCommits.length} recent commits in repo`);

    // Process any commits we haven't seen yet (check by commit_sha to avoid duplicates)
    for (const commit of recentCommits.reverse()) {
      const exists = this.db.queryOne(
        `SELECT id FROM work_items WHERE commit_sha = ? AND workspace_id = ?`,
        [commit.sha, workspaceId]
      );

      if (!exists) {
        console.log(`[TimeTracker] Processing existing commit: ${commit.sha.substring(0, 7)}`);
        this.handleNewCommit(workspaceId, commit).catch(err =>
          console.error('[TimeTracker] Error processing existing commit:', err)
        );
      } else {
        console.log(`[TimeTracker] Skipping already processed commit: ${commit.sha.substring(0, 7)}`);
      }
    }

    // Watch for new commits using git log
    const disposable = this.gitService.watchCommits(repoRoot, async (commit) => {
      // Double check we haven't already processed this commit
      const exists = this.db.queryOne(
        `SELECT id FROM work_items WHERE commit_sha = ? AND workspace_id = ?`,
        [commit.sha, workspaceId]
      );
      
      if (!exists) {
        await this.handleNewCommit(workspaceId, commit);
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * Handle new Git commit
   */
  private async handleNewCommit(
    workspaceId: number,
    commit: GitCommit
  ): Promise<void> {
    try {
      console.log(`[TimeTracker] New commit detected: ${commit.sha.substring(0, 7)} - ${commit.message}`);

      // Get tracker state for building GitHub URL
      const trackerState = Array.from(this.trackers.values()).find(t => t.workspace.id === workspaceId);
      const repoRoot = trackerState ? this.gitService.getRepoRoot(trackerState.folder.uri.fsPath) : null;
      
      const remoteUrl = repoRoot ? this.gitService.getRemoteUrl(repoRoot) : null;
      const repoName = remoteUrl 
        ? this.gitService.parseRepoName(remoteUrl) 
        : trackerState?.folder.name || 'unknown';
        
      const githubUrl = remoteUrl && remoteUrl.includes('github.com')
        ? `https://github.com/${repoName}/commit/${commit.sha}`
        : null;

      // Create work item for this commit
      const result = this.db.execute(
        `INSERT INTO work_items (workspace_id, repo, type, title, detail, occurred_at, url, commit_sha)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workspaceId,
          repoName,
          'commit',
          commit.message.split('\n')[0].substring(0, 200), // First line as title
          commit.message, // Full message as detail
          commit.date,
          githubUrl,
          commit.sha
        ]
      );

      const workItemId = result.lastInsertRowid;
      console.log(`[TimeTracker] Work item created: ID=${workItemId}`);

      // Get the created work item
      const workItem = this.db.queryOne(
        'SELECT * FROM work_items WHERE id = ?',
        [workItemId]
      );

      if (!workItem) {
        console.error('[TimeTracker] Failed to retrieve created work item');
        return;
      }

      // Automatically allocate unallocated sessions to this work item
      const allocations = this.allocationService.allocateSessionsToWorkItem(workItem);
      
      if (allocations.length > 0) {
        const totalHours = allocations.reduce((sum, a) => sum + a.hours, 0);
        console.log(
          `[TimeTracker] ✓ Allocated ${totalHours.toFixed(2)}h from ${allocations.length} date(s) to commit ${commit.sha.substring(0, 7)}`
        );
      } else {
        console.log(`[TimeTracker] No unallocated sessions to allocate to this commit`);
      }
    } catch (error) {
      console.error('[TimeTracker] Error handling commit:', error);
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
