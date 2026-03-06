import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { withTempRepo, createTempRepo, removeTempRepo } from "../helpers/temp-repo.ts";
import {
  createManifest,
  loadManifest,
  saveManifest,
  deleteManifest,
  listManifests,
  addChangeset,
  removeLastChangeset,
  updatePendingFiles,
  getAllChangedFiles,
  type SessionManifest,
  type Changeset,
} from "../../src/manifest.ts";

describe("manifest module", () => {
  let repoPath: string;

  beforeEach(() => {
    repoPath = createTempRepo("manifest-test");
  });

  afterEach(() => {
    removeTempRepo(repoPath);
  });

  test("createManifest creates and saves manifest", () => {
    const manifest = createManifest("test-session", "lanes/test-session", "/tmp/worktree", "123", repoPath);
    expect(manifest.name).toBe("test-session");
    expect(manifest.branch).toBe("lanes/test-session");
    expect(manifest.changesets).toEqual([]);
    expect(manifest.pendingFiles).toEqual([]);
    expect(manifest.clientId).toBe("123");
  });

  test("loadManifest returns saved manifest", () => {
    createManifest("test-session", "lanes/test-session", "/tmp/worktree", undefined, repoPath);
    const loaded = loadManifest("test-session", repoPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("test-session");
  });

  test("loadManifest returns null for nonexistent", () => {
    const loaded = loadManifest("nonexistent", repoPath);
    expect(loaded).toBeNull();
  });

  test("deleteManifest removes manifest", () => {
    createManifest("to-delete", "lanes/to-delete", "/tmp/worktree", undefined, repoPath);
    expect(loadManifest("to-delete", repoPath)).not.toBeNull();

    deleteManifest("to-delete", repoPath);
    expect(loadManifest("to-delete", repoPath)).toBeNull();
  });

  test("listManifests returns all session names", () => {
    createManifest("list-a", "lanes/list-a", "/tmp/a", undefined, repoPath);
    createManifest("list-b", "lanes/list-b", "/tmp/b", undefined, repoPath);

    const names = listManifests(repoPath);
    expect(names).toContain("list-a");
    expect(names).toContain("list-b");
    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  test("addChangeset appends to changesets", () => {
    createManifest("test", "lanes/test", "/tmp/worktree", undefined, repoPath);

    const changeset: Changeset = {
      id: "cs-1",
      sha: "abc123",
      message: "test commit",
      files: ["src/foo.ts"],
      timestamp: new Date().toISOString(),
    };

    addChangeset("test", changeset, repoPath);

    const loaded = loadManifest("test", repoPath)!;
    expect(loaded.changesets.length).toBe(1);
    expect(loaded.changesets[0]!.sha).toBe("abc123");
  });

  test("removeLastChangeset pops and restores files as pending", () => {
    createManifest("test", "lanes/test", "/tmp/worktree", undefined, repoPath);

    addChangeset("test", {
      id: "cs-1",
      sha: "abc123",
      message: "first",
      files: ["src/a.ts"],
      timestamp: new Date().toISOString(),
    }, repoPath);

    addChangeset("test", {
      id: "cs-2",
      sha: "def456",
      message: "second",
      files: ["src/b.ts"],
      timestamp: new Date().toISOString(),
    }, repoPath);

    const removed = removeLastChangeset("test", repoPath);
    expect(removed).not.toBeNull();
    expect(removed!.sha).toBe("def456");

    const loaded = loadManifest("test", repoPath)!;
    expect(loaded.changesets.length).toBe(1);
    expect(loaded.pendingFiles).toContain("src/b.ts");
  });

  test("updatePendingFiles adds unique files", () => {
    createManifest("test", "lanes/test", "/tmp/worktree", undefined, repoPath);

    updatePendingFiles("test", ["a.ts", "b.ts"], repoPath);
    updatePendingFiles("test", ["b.ts", "c.ts"], repoPath);

    const loaded = loadManifest("test", repoPath)!;
    expect(loaded.pendingFiles).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  test("getAllChangedFiles collects from changesets and pending", () => {
    const manifest: SessionManifest = {
      version: 1,
      name: "test",
      branch: "lanes/test",
      worktreePath: "/tmp",
      changesets: [
        { id: "1", sha: "a", message: "m", files: ["a.ts", "b.ts"], timestamp: "" },
        { id: "2", sha: "b", message: "m", files: ["b.ts", "c.ts"], timestamp: "" },
      ],
      pendingFiles: ["c.ts", "d.ts"],
      createdAt: "",
    };

    const files = getAllChangedFiles(manifest);
    expect(files.sort()).toEqual(["a.ts", "b.ts", "c.ts", "d.ts"]);
  });
});
