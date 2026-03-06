import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "bun";

/**
 * Create a temporary git repository for testing.
 * Returns the path to the repo root.
 */
export function createTempRepo(name = "test-repo"): string {
  const dir = join(tmpdir(), `git-lanes-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });

  // Initialize git repo
  spawnSync(["git", "init"], { cwd: dir });
  spawnSync(["git", "config", "user.email", "test@git-lanes.dev"], { cwd: dir });
  spawnSync(["git", "config", "user.name", "Test User"], { cwd: dir });

  // Create initial commit
  writeFileSync(join(dir, "README.md"), "# Test Repo\n");
  spawnSync(["git", "add", "."], { cwd: dir });
  spawnSync(["git", "commit", "-m", "initial commit"], { cwd: dir });

  return dir;
}

/**
 * Remove a temporary repo.
 */
export function removeTempRepo(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}

/**
 * Run a function with a temporary git repo that is cleaned up after.
 */
export async function withTempRepo<T>(
  fn: (repoPath: string) => T | Promise<T>,
  name = "test-repo",
): Promise<T> {
  const repoPath = createTempRepo(name);
  try {
    return await fn(repoPath);
  } finally {
    removeTempRepo(repoPath);
  }
}

/**
 * Add a file and commit it in a repo.
 */
export function addFileAndCommit(
  repoPath: string,
  filePath: string,
  content: string,
  message: string,
): void {
  const fullPath = join(repoPath, filePath);
  const dir = join(fullPath, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
  spawnSync(["git", "add", filePath], { cwd: repoPath });
  spawnSync(["git", "commit", "-m", message], { cwd: repoPath });
}
