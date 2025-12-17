# GitHub Workflows Setup Guide

## Overview

This repository uses GitHub Actions for:
- **Auto Version Tagging**: Automatically creates tags when `project.yaml` version changes
- **Release**: Packages the VS Code extension and creates GitHub Releases

## Important: Token Configuration

### The Problem

GitHub Actions has a security restriction: when a workflow uses `GITHUB_TOKEN` to push tags, it **will NOT trigger** other workflows. This means:
- `auto-version-tag.yml` creates a tag using `GITHUB_TOKEN`
- `release.yml` never gets triggered by that tag push ❌

### The Solution: Personal Access Token (PAT)

You need to create a **Personal Access Token** with repository access and configure it as a repository secret.

## Setup Instructions

### 1. Create a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Or use this direct link: https://github.com/settings/tokens

2. Click **Generate new token (classic)**

3. Configure the token:
   - **Note**: `TimeTracker-Agent Workflow Token`
   - **Expiration**: Choose your preference (90 days recommended)
   - **Scopes**: Select the following:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)

4. Click **Generate token**

5. **IMPORTANT**: Copy the token immediately (you won't be able to see it again)

### 2. Add Token to Repository Secrets

1. Go to your repository: `https://github.com/Unforgettableeternalproject/TimeTracker-Agent`

2. Navigate to: Settings → Secrets and variables → Actions

3. Click **New repository secret**

4. Configure the secret:
   - **Name**: `PAT_TOKEN`
   - **Value**: Paste your token from step 1
   - Click **Add secret**

### 3. Verify Setup

After adding the PAT:

1. Commit and push the updated `auto-version-tag.yml` workflow

2. Update version in `project.yaml`:
   ```yaml
   system_version: v0.3.0
   ```

3. Push to `main` branch

4. Check GitHub Actions:
   - `Auto Version Tag` workflow should run and create tag ✅
   - `Release` workflow should be triggered by the tag ✅
   - Release should include `.vsix` file ✅

## Workflow Flow

```
┌─────────────────────────────────────┐
│ Update project.yaml on main branch │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ auto-version-tag.yml triggered      │
│ - Detects version change            │
│ - Creates annotated tag             │
│ - Pushes tag using PAT_TOKEN        │
└──────────────┬──────────────────────┘
               │ (PAT allows trigger)
               ▼
┌─────────────────────────────────────┐
│ release.yml triggered by tag push   │
│ - Install dependencies              │
│ - Build packages                    │
│ - Package .vsix extension           │
│ - Create GitHub Release             │
│ - Upload .vsix as asset             │
└─────────────────────────────────────┘
```

## Without PAT Configuration

If you don't configure `PAT_TOKEN`:
- Workflow will fall back to `GITHUB_TOKEN`
- Tags will be created successfully
- **BUT**: release workflow will NOT be triggered
- You'll need to create releases manually

## Troubleshooting

### Release workflow not triggering?

**Check**: Is `PAT_TOKEN` configured?
```bash
# This command requires admin access
gh secret list
```

**Verify**: Does the workflow use PAT?
```yaml
# In .github/workflows/auto-version-tag.yml
token: ${{ secrets.PAT_TOKEN || secrets.GITHUB_TOKEN }}
```

### Token expired?

If your PAT expires:
1. Generate a new token (follow step 1 above)
2. Update the `PAT_TOKEN` secret with the new value
3. No need to modify workflow files

### Still not working?

1. Check Actions tab for error messages
2. Verify PAT has correct permissions (`repo` + `workflow`)
3. Ensure workflow is on main branch (not just develop)
4. Check if tag already exists (duplicate tags won't trigger)

## Security Notes

- Never commit tokens to repository
- Use repository secrets for token storage
- Tokens are only accessible to workflow runs
- Consider using fine-grained tokens for better security
- Set reasonable expiration dates (e.g., 90 days)
- Rotate tokens periodically

## Reference

- [GitHub Actions: Triggering workflows](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow)
- [GitHub Actions: Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
