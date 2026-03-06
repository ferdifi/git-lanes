import { test, expect, describe } from "bun:test";
import { runCLI } from "../helpers/capture.ts";
import { createTempRepo, removeTempRepo } from "../helpers/temp-repo.ts";

describe("CLI commands", () => {
  test("help command exits 0", () => {
    const result = runCLI(["help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("git-lanes");
    expect(result.stdout).toContain("USAGE");
  });

  test("version command exits 0", () => {
    const result = runCLI(["version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("git-lanes");
  });

  test("--help flag works", () => {
    const result = runCLI(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("SESSION COMMANDS");
  });

  test("--version flag works", () => {
    const result = runCLI(["--version"]);
    expect(result.exitCode).toBe(0);
  });

  test("unknown command exits 1", () => {
    const result = runCLI(["nonexistent-command"], createTempRepo());
    expect(result.exitCode).toBe(1);
  });

  test("list with no sessions works", () => {
    const repoPath = createTempRepo();
    const result = runCLI(["list"], repoPath);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("No active sessions");
    removeTempRepo(repoPath);
  });

  test("start without name exits 1", () => {
    const repoPath = createTempRepo();
    const result = runCLI(["start"], repoPath);
    expect(result.exitCode).toBe(1);
    removeTempRepo(repoPath);
  });

  test("commit without message exits 1", () => {
    const repoPath = createTempRepo();
    const result = runCLI(["commit"], repoPath);
    expect(result.exitCode).toBe(1);
    removeTempRepo(repoPath);
  });
});
