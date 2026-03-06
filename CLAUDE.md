# git-lanes

Parallel AI agent isolation for Git repositories. Built with Bun + TypeScript, zero runtime dependencies.

## Build & Test

```bash
bun install          # Install dev dependencies
bun run build        # Build to dist/
bun test             # Run all tests
bun run lint         # Type check
```

Test suites:
```bash
bun test test/unit          # Unit tests
bun test test/integration   # Integration tests
bun test test/security      # Security tests
bun test test/e2e           # CLI end-to-end tests
bun test test/stress        # Concurrency stress tests
```

## Source Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point, command dispatch, argument parsing |
| `src/config.ts` | `.lanes.json` configuration loader with defaults |
| `src/session.ts` | Session lifecycle: start, end, abort, track, commit, undo, squash, merge |
| `src/manifest.ts` | Session manifest (JSON) management with atomic writes and locking |
| `src/git.ts` | Git command wrappers using `Bun.spawnSync()` with array args |
| `src/conflicts.ts` | Cross-session conflict detection with resolution suggestions |
| `src/test-runner.ts` | Test execution in isolated worktrees with auto-detection |
| `src/hooks/install.ts` | Hook installation for Claude Code, Cursor, Aider |
| `src/forge/github.ts` | PR/MR creation for GitHub, GitLab, Bitbucket |
| `src/utils/validation.ts` | Input validation (session names, paths, messages) |
| `src/utils/lock.ts` | File locking via mkdir atomicity with stale detection |
| `src/utils/logger.ts` | Colored console logging |

## Coding Rules

1. **Always use `spawnSync` with argument arrays** — never string interpolation (prevents injection)
2. **Use `getGitCommonDir()` / `getRepoRoot()`** — never hardcode `.git` paths
3. **Use `saveManifest()`** — ensures atomic writes with file locking
4. **Session name regex**: `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`
5. **Zero runtime dependencies** — only Bun/Node built-in modules
6. **Always load config** via `loadConfig(repoRoot)`
7. **Use Bun APIs**: `Bun.file()`, `Bun.write()`, `Bun.spawn()` over Node equivalents

## Key Concepts

- **Session**: Isolated workspace = Git branch + worktree + manifest
- **Manifest**: JSON metadata in `.git/lanes-manifests/` tracking changesets and pending files
- **Changeset**: A recorded commit within a session (SHA, message, files, timestamp)
- **Session resolution**: Priority chain: explicit flag > worktree > single > PPID
- **Conflict**: File overlap between two active sessions
- **Forge**: Platform for PR creation (GitHub, GitLab, Bitbucket)
