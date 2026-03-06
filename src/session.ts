import { existsSync, mkdirSync, symlinkSync } from "fs";
import { join, resolve, normalize } from "path";
import {
  git,
  gitSafe,
  getRepoRoot,
  getDefaultBranch,
  getCurrentBranch,
  getHeadSha,
  createBranch,
  deleteBranch,
  addWorktree,
  removeWorktree,
  listWorktrees,
  pruneWorktrees,
  add,
  commit as gitCommit,
  resetSoft,
  hasUncommittedChanges,
  getChangedFiles,
  status,
  diff,
  diffFiles,
  merge as gitMerge,
  pushWithUpstream,
  branchExists,
} from "./git.ts";
import {
  createManifest,
  loadManifest,
  saveManifest,
  deleteManifest,
  listManifests,
  loadAllManifests,
  addChangeset,
  removeLastChangeset,
  updatePendingFiles,
  getAllChangedFiles,
  type SessionManifest,
  type Changeset,
} from "./manifest.ts";
import { loadConfig, type LanesConfig } from "./config.ts";
import { validateSessionName, validateCommitMessage, validateFilePaths } from "./utils/validation.ts";
import * as log from "./utils/logger.ts";

const WORKTREES_DIR = ".lanes/worktrees";

export interface SessionInfo {
  name: string;
  branch: string;
  worktreePath: string;
  changesets: Changeset[];
  pendingFiles: string[];
  createdAt: string;
}

// ── Session Resolution ──

/**
 * Resolve which session is currently active.
 * Priority: explicit flag > worktree detection > single session > PPID affinity.
 */
export function resolveSession(
  explicitName?: string,
  cwd?: string,
): SessionManifest | null {
  const repoRoot = getRepoRoot(cwd);

  // 1. Explicit name from --session flag
  if (explicitName) {
    return loadManifest(explicitName, repoRoot);
  }

  // 2. Detect from current worktree path
  const currentPath = normalize(resolve(cwd ?? process.cwd()));
  const manifests = loadAllManifests(repoRoot);

  for (const m of manifests) {
    if (normalize(resolve(m.worktreePath)) === currentPath) {
      return m;
    }
  }

  // 3. If only one session exists, use it
  if (manifests.length === 1) {
    return manifests[0]!;
  }

  // 4. PPID-based client affinity
  const ppid = String(process.ppid);
  for (const m of manifests) {
    if (m.clientId === ppid) {
      return m;
    }
  }

  return null;
}

// ── Session Lifecycle ──

/**
 * Start a new isolated session.
 * Creates a branch, worktree, symlinks for shared dirs, and a manifest.
 */
export function startSession(
  name: string,
  cwd?: string,
): SessionInfo {
  const repoRoot = getRepoRoot(cwd);
  const config = loadConfig(repoRoot);

  // Validate session name
  const validation = validateSessionName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check if session already exists
  const existing = loadManifest(name, repoRoot);
  if (existing) {
    throw new Error(`Session '${name}' already exists`);
  }

  // Check main branch policy
  const currentBranch = getCurrentBranch(repoRoot);
  const defaultBranch = getDefaultBranch(repoRoot);
  if (currentBranch === defaultBranch && config.main_branch_policy === "block") {
    // Allowed - we're creating a new branch from main
  }

  const branchName = `${config.branch_prefix}${name}`;
  const worktreePath = resolve(repoRoot, WORKTREES_DIR, name);

  // Rollback state tracking
  let branchCreated = false;
  let worktreeCreated = false;

  try {
    // Create the branch from current HEAD
    createBranch(branchName, "HEAD", repoRoot);
    branchCreated = true;

    // Create the worktree
    mkdirSync(join(repoRoot, WORKTREES_DIR), { recursive: true });
    addWorktree(worktreePath, branchName, repoRoot);
    worktreeCreated = true;

    // Set up symlinks for shared directories
    for (const sharedDir of config.shared_dirs) {
      const targetPath = join(repoRoot, sharedDir);
      const linkPath = join(worktreePath, sharedDir);

      if (existsSync(targetPath) && !existsSync(linkPath)) {
        mkdirSync(join(linkPath, ".."), { recursive: true });
        symlinkSync(targetPath, linkPath);
      }
    }

    // Create the manifest
    const clientId = String(process.ppid);
    const manifest = createManifest(name, branchName, worktreePath, clientId, repoRoot);

    log.success(`Session '${name}' started`);
    log.info(`Branch: ${branchName}`);
    log.info(`Worktree: ${worktreePath}`);

    return manifestToInfo(manifest);
  } catch (err) {
    // Rollback on failure
    if (worktreeCreated) {
      try { removeWorktree(worktreePath, true, repoRoot); } catch { /* best effort */ }
    }
    if (branchCreated) {
      try { deleteBranch(branchName, true, repoRoot); } catch { /* best effort */ }
    }
    throw err;
  }
}

/**
 * End a session: commit pending changes and clean up.
 */
export function endSession(
  sessionName?: string,
  commitMessage?: string,
  cwd?: string,
): void {
  const repoRoot = getRepoRoot(cwd);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error(sessionName ? `Session '${sessionName}' not found` : "No active session found");
  }

  const worktreePath = manifest.worktreePath;

  // Commit any pending changes
  if (hasUncommittedChanges(worktreePath)) {
    const message = commitMessage ?? `WIP: session ${manifest.name} final commit`;
    try {
      add(["."], worktreePath);
      gitCommit(message, worktreePath);
      log.info(`Committed pending changes: ${message}`);
    } catch {
      log.warn("Could not commit pending changes");
    }
  }

  // Clean up
  cleanupSession(manifest, repoRoot);
  log.success(`Session '${manifest.name}' ended`);
}

/**
 * Abort a session: discard all changes and clean up.
 */
export function abortSession(
  sessionName?: string,
  cwd?: string,
): void {
  const repoRoot = getRepoRoot(cwd);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error(sessionName ? `Session '${sessionName}' not found` : "No active session found");
  }

  // Force remove worktree (discards changes)
  try {
    removeWorktree(manifest.worktreePath, true, repoRoot);
  } catch {
    // Worktree may already be gone
  }

  // Delete branch
  try {
    deleteBranch(manifest.branch, true, repoRoot);
  } catch {
    // Branch may already be gone
  }

  // Delete manifest
  deleteManifest(manifest.name, repoRoot);

  log.success(`Session '${manifest.name}' aborted`);
}

// ── Track & Commit ──

/**
 * Track files for the next commit in the current session.
 */
export function trackFiles(
  files: string[],
  sessionName?: string,
  cwd?: string,
): void {
  const repoRoot = getRepoRoot(cwd);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  const validation = validateFilePaths(files);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Stage files in the worktree
  add(files, manifest.worktreePath);

  // Update pending files in manifest
  updatePendingFiles(manifest.name, files, repoRoot);

  log.success(`Tracking ${files.length} file(s)`);
}

/**
 * Commit tracked changes in the current session.
 */
export function sessionCommit(
  message: string,
  sessionName?: string,
  cwd?: string,
): Changeset {
  const repoRoot = getRepoRoot(cwd);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  const msgValidation = validateCommitMessage(message);
  if (!msgValidation.valid) {
    throw new Error(msgValidation.error);
  }

  const worktreePath = manifest.worktreePath;

  // Stage all changes if nothing is staged
  const stagedOutput = gitSafe(["diff", "--cached", "--name-only"], worktreePath);
  if (!stagedOutput.stdout) {
    add(["."], worktreePath);
  }

  // Get the files that will be committed
  const filesOutput = gitSafe(["diff", "--cached", "--name-only"], worktreePath);
  const files = filesOutput.stdout ? filesOutput.stdout.split("\n") : [];

  if (files.length === 0) {
    throw new Error("No changes to commit");
  }

  // Create the commit
  gitCommit(message, worktreePath);
  const sha = getHeadSha(worktreePath);

  // Record the changeset in the manifest
  const changeset: Changeset = {
    id: `cs-${Date.now()}`,
    sha,
    message,
    files,
    timestamp: new Date().toISOString(),
  };

  addChangeset(manifest.name, changeset, repoRoot);

  log.success(`Committed: ${message}`);
  log.info(`SHA: ${sha.slice(0, 8)} | ${files.length} file(s)`);

  return changeset;
}

/**
 * Undo the last commit in the session (soft reset).
 */
export function undoLastCommit(
  sessionName?: string,
  cwd?: string,
): Changeset | null {
  const repoRoot = getRepoRoot(cwd);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  if (manifest.changesets.length === 0) {
    throw new Error("No commits to undo");
  }

  // Soft reset in the worktree
  resetSoft("HEAD~1", manifest.worktreePath);

  // Remove changeset from manifest
  const removed = removeLastChangeset(manifest.name, repoRoot);

  if (removed) {
    log.success(`Undone: ${removed.message}`);
  }

  return removed;
}

/**
 * Squash all commits in a session into one.
 */
export function squashSession(
  message: string,
  sessionName?: string,
  cwd?: string,
): void {
  const repoRoot = getRepoRoot(cwd);
  const config = loadConfig(repoRoot);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  const msgValidation = validateCommitMessage(message);
  if (!msgValidation.valid) {
    throw new Error(msgValidation.error);
  }

  if (manifest.changesets.length < 2) {
    throw new Error("Need at least 2 commits to squash");
  }

  const worktreePath = manifest.worktreePath;
  const defaultBranch = getDefaultBranch(repoRoot);

  // Find the merge base
  const mergeBase = git(["merge-base", defaultBranch, "HEAD"], worktreePath);

  // Soft reset to merge base, keeping all changes staged
  resetSoft(mergeBase, worktreePath);

  // Create new squashed commit
  add(["."], worktreePath);
  gitCommit(message, worktreePath);
  const sha = getHeadSha(worktreePath);

  // Collect all files from all changesets
  const allFiles = getAllChangedFiles(manifest);

  // Replace all changesets with one
  const reloaded = loadManifest(manifest.name, repoRoot);
  if (reloaded) {
    reloaded.changesets = [{
      id: `cs-${Date.now()}`,
      sha,
      message,
      files: allFiles,
      timestamp: new Date().toISOString(),
    }];
    reloaded.pendingFiles = [];
    saveManifest(reloaded, repoRoot);
  }

  log.success(`Squashed ${manifest.changesets.length} commits into one`);
}

/**
 * Merge session branch into the default branch.
 */
export function mergeSession(
  sessionName?: string,
  cwd?: string,
): void {
  const repoRoot = getRepoRoot(cwd);
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  const defaultBranch = getDefaultBranch(repoRoot);

  // Commit any pending changes first
  if (hasUncommittedChanges(manifest.worktreePath)) {
    add(["."], manifest.worktreePath);
    gitCommit(`WIP: session ${manifest.name} auto-commit before merge`, manifest.worktreePath);
  }

  // Switch to default branch in repo root and merge
  git(["checkout", defaultBranch], repoRoot);
  gitMerge(manifest.branch, `Merge session '${manifest.name}'`, repoRoot);

  log.success(`Merged session '${manifest.name}' into ${defaultBranch}`);
}

// ── Session Info ──

/**
 * Get information about the current session.
 */
export function getSessionStatus(
  sessionName?: string,
  cwd?: string,
): { session: SessionInfo; status: string; diff: string } {
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  const sessionStatus = status(manifest.worktreePath);
  const sessionDiff = diff(false, manifest.worktreePath);

  return {
    session: manifestToInfo(manifest),
    status: sessionStatus,
    diff: sessionDiff,
  };
}

/**
 * Get the commit log for a session.
 */
export function getSessionLog(
  sessionName?: string,
  cwd?: string,
): Changeset[] {
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  return manifest.changesets;
}

/**
 * List all active sessions.
 */
export function listSessions(cwd?: string): SessionInfo[] {
  const repoRoot = getRepoRoot(cwd);
  const manifests = loadAllManifests(repoRoot);
  return manifests.map(manifestToInfo);
}

/**
 * Identify which session is currently active.
 */
export function whichSession(cwd?: string): SessionInfo | null {
  const manifest = resolveSession(undefined, cwd);
  return manifest ? manifestToInfo(manifest) : null;
}

// ── Maintenance ──

/**
 * Prune orphaned worktrees, branches, and manifests.
 */
export function pruneSessions(cwd?: string): { removed: string[] } {
  const repoRoot = getRepoRoot(cwd);
  const config = loadConfig(repoRoot);
  const removed: string[] = [];

  // Prune git worktrees
  pruneWorktrees(repoRoot);

  // Check each manifest for orphaned sessions
  const manifests = loadAllManifests(repoRoot);
  for (const manifest of manifests) {
    const worktreeExists = existsSync(manifest.worktreePath);
    const branchExist = branchExists(manifest.branch, repoRoot);

    if (!worktreeExists || !branchExist) {
      // Clean up orphaned session
      if (worktreeExists) {
        try { removeWorktree(manifest.worktreePath, true, repoRoot); } catch { /* skip */ }
      }
      if (branchExist) {
        try { deleteBranch(manifest.branch, true, repoRoot); } catch { /* skip */ }
      }
      deleteManifest(manifest.name, repoRoot);
      removed.push(manifest.name);
    }
  }

  if (removed.length > 0) {
    log.success(`Pruned ${removed.length} orphaned session(s): ${removed.join(", ")}`);
  } else {
    log.info("No orphaned sessions found");
  }

  return { removed };
}

/**
 * Push session branch to remote.
 */
export function pushSession(
  sessionName?: string,
  cwd?: string,
): void {
  const manifest = resolveSession(sessionName, cwd);

  if (!manifest) {
    throw new Error("No active session found");
  }

  pushWithUpstream("origin", manifest.branch, manifest.worktreePath);
  log.success(`Pushed branch '${manifest.branch}' to origin`);
}

// ── Helpers ──

function cleanupSession(manifest: SessionManifest, repoRoot: string): void {
  // Remove worktree
  try {
    removeWorktree(manifest.worktreePath, false, repoRoot);
  } catch {
    try { removeWorktree(manifest.worktreePath, true, repoRoot); } catch { /* skip */ }
  }

  // Delete manifest
  deleteManifest(manifest.name, repoRoot);
}

function manifestToInfo(manifest: SessionManifest): SessionInfo {
  return {
    name: manifest.name,
    branch: manifest.branch,
    worktreePath: manifest.worktreePath,
    changesets: manifest.changesets,
    pendingFiles: manifest.pendingFiles,
    createdAt: manifest.createdAt,
  };
}
