import { test, expect, describe } from "bun:test";
import { withTempRepo } from "../helpers/temp-repo.ts";
import {
  git,
  getRepoRoot,
  getCurrentBranch,
  getHeadSha,
  isInsideGitRepo,
  isInsideWorktree,
  createBranch,
  deleteBranch,
  branchExists,
  listBranches,
  status,
  hasUncommittedChanges,
  GitError,
} from "../../src/git.ts";
import { writeFileSync } from "fs";
import { join } from "path";

describe("git module", () => {
  test("getRepoRoot returns repo root", async () => {
    await withTempRepo((repoPath) => {
      const root = getRepoRoot(repoPath);
      const { realpathSync } = require("fs");
      expect(realpathSync(root)).toBe(realpathSync(repoPath));
    });
  });

  test("getCurrentBranch returns branch name", async () => {
    await withTempRepo((repoPath) => {
      const branch = getCurrentBranch(repoPath);
      expect(["main", "master"]).toContain(branch);
    });
  });

  test("getHeadSha returns valid SHA", async () => {
    await withTempRepo((repoPath) => {
      const sha = getHeadSha(repoPath);
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  test("isInsideGitRepo returns true for git repos", async () => {
    await withTempRepo((repoPath) => {
      expect(isInsideGitRepo(repoPath)).toBe(true);
    });
  });

  test("isInsideWorktree returns true inside worktree", async () => {
    await withTempRepo((repoPath) => {
      expect(isInsideWorktree(repoPath)).toBe(true);
    });
  });

  test("branch operations work correctly", async () => {
    await withTempRepo((repoPath) => {
      // Create branch
      createBranch("test-branch", undefined, repoPath);
      expect(branchExists("test-branch", repoPath)).toBe(true);

      // List branches
      const branches = listBranches(undefined, repoPath);
      expect(branches).toContain("test-branch");

      // Delete branch
      deleteBranch("test-branch", false, repoPath);
      expect(branchExists("test-branch", repoPath)).toBe(false);
    });
  });

  test("status detects uncommitted changes", async () => {
    await withTempRepo((repoPath) => {
      expect(hasUncommittedChanges(repoPath)).toBe(false);

      writeFileSync(join(repoPath, "new-file.txt"), "hello");
      expect(hasUncommittedChanges(repoPath)).toBe(true);

      const statusOutput = status(repoPath);
      expect(statusOutput).toContain("new-file.txt");
    });
  });

  test("GitError contains command info", async () => {
    await withTempRepo((repoPath) => {
      try {
        git(["checkout", "nonexistent-branch-xyz"], repoPath);
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(GitError);
        const gitErr = err as GitError;
        expect(gitErr.command).toContain("checkout");
        expect(gitErr.exitCode).not.toBe(0);
      }
    });
  });
});
