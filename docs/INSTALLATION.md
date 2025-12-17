# Release Installation Guide

## Automatic Installation

When a new release is published, download the `.vsix` file from the [Releases](https://github.com/Unforgettableeternalproject/TimeTracker-Agent/releases) page and install it:

```bash
# Using VS Code CLI
code --install-extension timetracker-agent-extension.vsix

# Or in VS Code Insiders
code-insiders --install-extension timetracker-agent-extension.vsix
```

## Manual Installation via VS Code UI

1. Download `timetracker-agent-extension.vsix` from the latest release
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
4. Click the `...` menu at the top right
5. Select "Install from VSIX..."
6. Choose the downloaded `.vsix` file

## Building from Source

If you want to build and install from source:

```bash
# Clone the repository
git clone https://github.com/Unforgettableeternalproject/TimeTracker-Agent.git
cd TimeTracker-Agent

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Package the extension
cd packages/vscode-extension
pnpm exec vsce package

# Install the generated .vsix file
code --install-extension timetracker-agent-extension-0.1.0.vsix
```

## Upgrading

To upgrade to a newer version:

1. Download the new `.vsix` file
2. Install it using the same method above
3. VS Code will automatically replace the old version

## Uninstalling

```bash
code --uninstall-extension timesheet-agent.timetracker-agent-extension
```

Or use the Extensions view in VS Code to uninstall.
