# Testing GitHub Actions Locally with Act

## Prerequisites

Install [act](https://github.com/nektos/act):
```bash
# Windows (with scoop)
scoop install act

# Or with chocolatey
choco install act-cli
```

## Test Release Workflow

### Dry Run (list jobs)
```bash
act -l
```

### Test Release Workflow (simulating v0.1.0 tag push)
```bash
# Basic test
act -W .github/workflows/release.yml -j build-and-release --verbose

# With specific tag
act push -W .github/workflows/release.yml --eventpath test-event.json

# Skip docker pull (faster)
act -W .github/workflows/release.yml -j build-and-release --pull=false
```

### Create Test Event File

Create `test-event.json` to simulate a tag push:
```json
{
  "ref": "refs/tags/v0.1.0",
  "repository": {
    "name": "TimeTracker-Agent",
    "owner": {
      "name": "Unforgettableeternalproject"
    }
  }
}
```

Then run:
```bash
act push -W .github/workflows/release.yml --eventpath test-event.json
```

## Test Auto-Version-Tag Workflow

```bash
# Test version check job
act push -W .github/workflows/auto-version-tag.yml -j check_and_tag
```

## Common Issues

### Issue: "command not found: pnpm"
**Solution**: Use `-P ubuntu-latest=catthehacker/ubuntu:act-latest` for better compatibility:
```bash
act -W .github/workflows/release.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

### Issue: Workflow fails at package step
**Solution**: Ensure all dependencies are installed locally first:
```bash
pnpm install
pnpm build
```

### Issue: Permission denied
**Solution**: Run act with elevated privileges or fix file permissions

## Tips

1. **Use `--dryrun` flag** to see what would be executed without running it
2. **Use `--verbose`** for detailed output
3. **Use `-s GITHUB_TOKEN=fake`** to bypass token requirements for testing
4. **Check `.env.act`** for environment variables

## Quick Test Commands

```bash
# Full test (slow first time due to docker image pull)
act push -W .github/workflows/release.yml --eventpath test-event.json --verbose

# Fast test (skip docker pull, use cached image)
act push -W .github/workflows/release.yml --eventpath test-event.json --pull=false

# Test specific job only
act -W .github/workflows/release.yml -j build-and-release --dryrun
```
