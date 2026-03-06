import { spawnSync } from "bun";
import { join } from "path";

export class GitError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly stderr: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * Execute a git command synchronously and return stdout as a string.
 * Uses spawnSync with an array of arguments to prevent command injection.
 */
export function git(args: string[], cwd?: string): string {
  const result = spawnSync(["git", ...args], {
    cwd: cwd ?? process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();

  if (result.exitCode !== 0) {
    throw new GitError(
      `git ${args[0]} failed: ${stderr || stdout}`,
      `git ${args.join(" ")}`,
      stderr,
      result.exitCode,
    );
  }

  return stdout;
}

/**
 * Execute a git command and return whether it succeeded (no throw).
 */
export function gitSafe(args: string[], cwd?: string): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(["git", ...args], {
    cwd: cwd ?? process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

// ── Repository Info ──

export function getRepoRoot(cwd?: string): string {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

export function getGitCommonDir(cwd?: string): string {
  return git(["rev-parse", "--git-common-dir"], cwd);
}

export function getGitDir(cwd?: string): string {
  return git(["rev-parse", "--git-dir"], cwd);
}

export function isInsideWorktree(cwd?: string): boolean {
  const result = gitSafe(["rev-parse", "--is-inside-work-tree"], cwd);
  return result.ok && result.stdout === "true";
}

export function isInsideGitRepo(cwd?: string): boolean {
  return gitSafe(["rev-parse", "--git-dir"], cwd).ok;
}

export function getDefaultBranch(cwd?: string): string {
  // Try remote HEAD first
  const result = gitSafe(["symbolic-ref", "refs/remotes/origin/HEAD", "--short"], cwd);
  if (result.ok) {
    return result.stdout.replace("origin/", "");
  }

  // Fallback: check common branch names
  for (const name of ["main", "master"]) {
    if (gitSafe(["rev-parse", "--verify", name], cwd).ok) {
      return name;
    }
  }

  return "main";
}

export function getCurrentBranch(cwd?: string): string {
  return git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

export function getHeadSha(cwd?: string): string {
  return git(["rev-parse", "HEAD"], cwd);
}

export function getShortSha(sha: string, cwd?: string): string {
  return git(["rev-parse", "--short", sha], cwd);
}

// ── Branch Operations ──

export function createBranch(name: string, startPoint?: string, cwd?: string): void {
  const args = ["branch", name];
  if (startPoint) args.push(startPoint);
  git(args, cwd);
}

export function deleteBranch(name: string, force = false, cwd?: string): void {
  git(["branch", force ? "-D" : "-d", name], cwd);
}

export function deleteRemoteBranch(name: string, remote = "origin", cwd?: string): void {
  git(["push", remote, "--delete", name], cwd);
}

export function branchExists(name: string, cwd?: string): boolean {
  return gitSafe(["rev-parse", "--verify", name], cwd).ok;
}

export function listBranches(pattern?: string, cwd?: string): string[] {
  const args = ["branch", "--list", "--format=%(refname:short)"];
  if (pattern) args.push(pattern);
  const output = git(args, cwd);
  return output ? output.split("\n") : [];
}

// ── Worktree Operations ──

export function addWorktree(path: string, branch: string, cwd?: string): void {
  git(["worktree", "add", path, branch], cwd);
}

export function addWorktreeDetached(path: string, commitish: string, cwd?: string): void {
  git(["worktree", "add", "--detach", path, commitish], cwd);
}

export function removeWorktree(path: string, force = false, cwd?: string): void {
  const args = ["worktree", "remove", path];
  if (force) args.push("--force");
  git(args, cwd);
}

export function listWorktrees(cwd?: string): Array<{ path: string; head: string; branch: string }> {
  const output = git(["worktree", "list", "--porcelain"], cwd);
  if (!output) return [];

  const worktrees: Array<{ path: string; head: string; branch: string }> = [];
  let current: { path: string; head: string; branch: string } = { path: "", head: "", branch: "" };

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice(9), head: "", branch: "" };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "") {
      if (current.path) worktrees.push({ ...current });
      current = { path: "", head: "", branch: "" };
    }
  }

  // Push last entry if no trailing newline
  if (current.path) worktrees.push(current);

  return worktrees;
}

export function pruneWorktrees(cwd?: string): void {
  git(["worktree", "prune"], cwd);
}

// ── Staging & Commit ──

export function add(files: string[], cwd?: string): void {
  git(["add", "--", ...files], cwd);
}

export function commit(message: string, cwd?: string): string {
  return git(["commit", "-m", message], cwd);
}

export function commitAll(message: string, cwd?: string): string {
  return git(["commit", "-a", "-m", message], cwd);
}

export function getLastCommitSha(cwd?: string): string {
  return git(["rev-parse", "HEAD"], cwd);
}

export function getLastCommitMessage(cwd?: string): string {
  return git(["log", "-1", "--format=%s"], cwd);
}

// ── Diff & Status ──

export function status(cwd?: string): string {
  return git(["status", "--porcelain"], cwd);
}

export function statusLong(cwd?: string): string {
  return git(["status"], cwd);
}

export function diff(staged = false, cwd?: string): string {
  const args = ["diff"];
  if (staged) args.push("--cached");
  return git(args, cwd);
}

export function diffFiles(base: string, head = "HEAD", cwd?: string): string[] {
  const output = git(["diff", "--name-only", base, head], cwd);
  return output ? output.split("\n") : [];
}

export function diffStat(base: string, head = "HEAD", cwd?: string): string {
  return git(["diff", "--stat", base, head], cwd);
}

export function hasUncommittedChanges(cwd?: string): boolean {
  const result = status(cwd);
  return result.length > 0;
}

export function getChangedFiles(cwd?: string): string[] {
  const output = status(cwd);
  if (!output) return [];
  return output.split("\n").map((line) => line.slice(3));
}

export function getStagedFiles(cwd?: string): string[] {
  const output = git(["diff", "--cached", "--name-only"], cwd);
  return output ? output.split("\n") : [];
}

// ── Reset & Stash ──

export function resetSoft(ref = "HEAD~1", cwd?: string): void {
  git(["reset", "--soft", ref], cwd);
}

export function resetMixed(ref = "HEAD~1", cwd?: string): void {
  git(["reset", "--mixed", ref], cwd);
}

export function stash(message?: string, cwd?: string): void {
  const args = ["stash", "push"];
  if (message) args.push("-m", message);
  git(args, cwd);
}

export function stashPop(cwd?: string): void {
  git(["stash", "pop"], cwd);
}

// ── Merge ──

export function merge(branch: string, message?: string, cwd?: string): void {
  const args = ["merge", branch];
  if (message) args.push("-m", message);
  git(args, cwd);
}

export function mergeNoCommit(branch: string, cwd?: string): void {
  git(["merge", "--no-commit", "--no-ff", branch], cwd);
}

export function abortMerge(cwd?: string): void {
  git(["merge", "--abort"], cwd);
}

export function isMerging(cwd?: string): boolean {
  const gitDir = getGitDir(cwd);
  const mergePath = join(gitDir, "MERGE_HEAD");
  return Bun.file(mergePath).size > 0;
}

// ── Push ──

export function push(remote = "origin", branch?: string, cwd?: string): void {
  const args = ["push", remote];
  if (branch) args.push(branch);
  git(args, cwd);
}

export function pushWithUpstream(remote = "origin", branch?: string, cwd?: string): void {
  const args = ["push", "-u", remote];
  if (branch) args.push(branch);
  git(args, cwd);
}

// ── Log ──

export function log(
  count = 10,
  format = "%h %s",
  cwd?: string,
): string[] {
  const output = git(["log", `-${count}`, `--format=${format}`], cwd);
  return output ? output.split("\n") : [];
}

export function logBetween(
  from: string,
  to = "HEAD",
  format = "%h %s",
  cwd?: string,
): string[] {
  const output = git(["log", `${from}..${to}`, `--format=${format}`], cwd);
  return output ? output.split("\n") : [];
}

export function commitCount(from: string, to = "HEAD", cwd?: string): number {
  const output = git(["rev-list", "--count", `${from}..${to}`], cwd);
  return parseInt(output, 10);
}

// ── Symlink Helpers ──

export function createSymlink(target: string, linkPath: string): void {
  const { mkdirSync, symlinkSync } = require("fs");
  const { dirname } = require("path");
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath);
}
