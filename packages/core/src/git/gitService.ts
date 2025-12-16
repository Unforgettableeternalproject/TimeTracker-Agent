import * as child_process from 'child_process';
import * as path from 'path';

/**
 * Git service for interacting with git repositories
 */
export class GitService {
  constructor() {}

  /**
   * Get git repository root path
   */
  getRepoRoot(workingDir: string): string | null {
    try {
      const result = child_process.execSync('git rev-parse --show-toplevel', {
        cwd: workingDir,
        encoding: 'utf-8',
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(repoPath: string): string | null {
    try {
      const result = child_process.execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
        encoding: 'utf-8',
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get repository remote URL
   */
  getRemoteUrl(repoPath: string, remoteName: string = 'origin'): string | null {
    try {
      const result = child_process.execSync(`git remote get-url ${remoteName}`, {
        cwd: repoPath,
        encoding: 'utf-8',
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Parse repository name from remote URL
   */
  parseRepoName(remoteUrl: string): string {
    // Handle various Git URL formats
    // SSH: git@github.com:user/repo.git
    // HTTPS: https://github.com/user/repo.git
    const patterns = [
      /github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/,
      /gitlab\.com[:/]([^/]+\/[^/]+?)(\.git)?$/,
      /bitbucket\.org[:/]([^/]+\/[^/]+?)(\.git)?$/,
      /dev\.azure\.com[:/]([^/]+\/[^/]+?)(\.git)?$/,
      /[:/]([^/]+\/[^/]+?)(\.git)?$/,
    ];

    for (const pattern of patterns) {
      const match = remoteUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return path.basename(remoteUrl, '.git');
  }

  /**
   * Get recent commits
   */
  getRecentCommits(repoPath: string, since?: string, limit: number = 100): GitCommit[] {
    try {
      let command = `git log --pretty=format:"%H|%an|%ai|%s" --name-only -n ${limit}`;
      if (since) {
        command += ` --since="${since}"`;
      }

      const result = child_process.execSync(command, {
        cwd: repoPath,
        encoding: 'utf-8',
      });

      return this.parseGitLog(result);
    } catch {
      return [];
    }
  }

  /**
   * Get commits since a specific SHA
   */
  getCommitsSince(repoPath: string, sinceCommit: string): GitCommit[] {
    try {
      const command = `git log --pretty=format:"%H|%an|%ai|%s" --name-only ${sinceCommit}..HEAD`;

      const result = child_process.execSync(command, {
        cwd: repoPath,
        encoding: 'utf-8',
      });

      return this.parseGitLog(result);
    } catch {
      return [];
    }
  }

  /**
   * Check if current HEAD is a merge commit
   */
  isMergeCommit(repoPath: string, sha: string = 'HEAD'): boolean {
    try {
      const result = child_process.execSync(`git rev-parse ${sha}^2`, {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Parse git log output
   */
  private parseGitLog(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const blocks = output.split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length === 0) continue;

      const [sha, author, date, ...messageParts] = lines[0].split('|');
      const message = messageParts.join('|');

      const files: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          files.push(line);
        }
      }

      commits.push({
        sha,
        author,
        date,
        message,
        files_changed: files,
      });
    }

    return commits;
  }

  /**
   * Watch for new commits (polling-based)
   */
  async watchCommits(
    repoPath: string,
    callback: (commit: GitCommit) => void,
    intervalMs: number = 10000
  ): Promise<() => void> {
    let lastCommit: string | null = null;

    // Get initial HEAD
    try {
      lastCommit = child_process
        .execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' })
        .trim();
    } catch {
      // Ignore
    }

    const interval = setInterval(() => {
      try {
        const currentHead = child_process
          .execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' })
          .trim();

        if (lastCommit && currentHead !== lastCommit) {
          // New commit detected
          const newCommits = this.getCommitsSince(repoPath, lastCommit);
          newCommits.reverse().forEach((commit) => callback(commit));
        }

        lastCommit = currentHead;
      } catch {
        // Ignore errors
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }
}

interface GitCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
  files_changed: string[];
}
