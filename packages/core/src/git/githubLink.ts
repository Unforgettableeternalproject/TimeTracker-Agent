import { GitProvider } from '../model/types';

/**
 * Base Git provider
 */
abstract class BaseGitProvider implements GitProvider {
  abstract name: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';
  abstract detectProvider(remote: string): boolean;
  abstract buildCommitUrl(repo: string, sha: string): string;
  abstract buildPRUrl(repo: string, prNumber: number): string;
}

/**
 * GitHub provider
 */
class GitHubProvider extends BaseGitProvider {
  name: 'github' = 'github';

  detectProvider(remote: string): boolean {
    return remote.includes('github.com');
  }

  buildCommitUrl(repo: string, sha: string): string {
    return `https://github.com/${repo}/commit/${sha}`;
  }

  buildPRUrl(repo: string, prNumber: number): string {
    return `https://github.com/${repo}/pull/${prNumber}`;
  }
}

/**
 * GitLab provider
 */
class GitLabProvider extends BaseGitProvider {
  name: 'gitlab' = 'gitlab';

  detectProvider(remote: string): boolean {
    return remote.includes('gitlab.com');
  }

  buildCommitUrl(repo: string, sha: string): string {
    return `https://gitlab.com/${repo}/-/commit/${sha}`;
  }

  buildPRUrl(repo: string, prNumber: number): string {
    return `https://gitlab.com/${repo}/-/merge_requests/${prNumber}`;
  }
}

/**
 * Bitbucket provider
 */
class BitbucketProvider extends BaseGitProvider {
  name: 'bitbucket' = 'bitbucket';

  detectProvider(remote: string): boolean {
    return remote.includes('bitbucket.org');
  }

  buildCommitUrl(repo: string, sha: string): string {
    return `https://bitbucket.org/${repo}/commits/${sha}`;
  }

  buildPRUrl(repo: string, prNumber: number): string {
    return `https://bitbucket.org/${repo}/pull-requests/${prNumber}`;
  }
}

/**
 * Azure DevOps provider
 */
class AzureDevOpsProvider extends BaseGitProvider {
  name: 'azure-devops' = 'azure-devops';

  detectProvider(remote: string): boolean {
    return remote.includes('dev.azure.com') || remote.includes('visualstudio.com');
  }

  buildCommitUrl(repo: string, sha: string): string {
    // Azure DevOps URL format: https://dev.azure.com/{org}/{project}/_git/{repo}/commit/{sha}
    // This is a simplified version, may need org/project parsing
    return `https://dev.azure.com/${repo}/commit/${sha}`;
  }

  buildPRUrl(repo: string, prNumber: number): string {
    return `https://dev.azure.com/${repo}/pullrequest/${prNumber}`;
  }
}

/**
 * Detect git provider from remote URL
 */
export function detectGitProvider(remoteUrl: string): GitProvider {
  const providers: GitProvider[] = [
    new GitHubProvider(),
    new GitLabProvider(),
    new BitbucketProvider(),
    new AzureDevOpsProvider(),
  ];

  for (const provider of providers) {
    if (provider.detectProvider(remoteUrl)) {
      return provider;
    }
  }

  // Default to GitHub
  return new GitHubProvider();
}

/**
 * Build commit URL
 */
export function buildCommitUrl(remoteUrl: string, repo: string, sha: string): string {
  const provider = detectGitProvider(remoteUrl);
  return provider.buildCommitUrl(repo, sha);
}

/**
 * Build PR/MR URL
 */
export function buildPRUrl(remoteUrl: string, repo: string, prNumber: number): string {
  const provider = detectGitProvider(remoteUrl);
  return provider.buildPRUrl(repo, prNumber);
}
