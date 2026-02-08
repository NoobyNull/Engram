# Pre-Built Native Binaries

This directory contains pre-compiled native modules to speed up installation.

## Current Platforms

- **linux-x64-137** (Node 24.x) - Most common for Codespaces and cloud environments

## When to Rebuild

Only rebuild binaries when:

1. **Updating native dependencies** (better-sqlite3, sqlite-vec, fastembed versions change)
2. **Supporting new platforms** (different OS, architecture, or Node version)
3. **Binaries don't exist** for your current platform

## How to Rebuild

```bash
npm run build:binaries
```

This will:
- Install plugin dependencies
- Compile native modules for your current platform
- Bundle them in `plugin/prebuilt-binaries/${platform}-${arch}-${nodeABI}/`

## Normal Development

For regular development and releases:
- **DO NOT** rebuild binaries unless dependencies changed
- Existing binaries are reused automatically
- Git tracks the binaries so they persist across branches

## Adding New Platforms

To support additional platforms (e.g., macOS, Windows):

1. Run `npm run build:binaries` on the target platform
2. Commit the new `plugin/prebuilt-binaries/${platformKey}/` directory
3. Push to GitHub

The setup script will automatically detect and use the correct platform binaries.
