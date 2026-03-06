import { test, expect, describe } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig, getDefaultConfig } from "../../src/config.ts";

function createTempDir(): string {
  const dir = join(tmpdir(), `git-lanes-config-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadConfig", () => {
  test("returns defaults when no config file exists", () => {
    const dir = createTempDir();
    const config = loadConfig(dir);
    expect(config.shared_dirs).toEqual([]);
    expect(config.main_branch_policy).toBe("block");
    expect(config.force_cleanup).toBe("prompt");
    expect(config.adopt_changes).toBe("always");
    expect(config.branch_prefix).toBe("lanes/");
    rmSync(dir, { recursive: true });
  });

  test("loads valid config file", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, ".lanes.json"), JSON.stringify({
      shared_dirs: ["node_modules"],
      main_branch_policy: "allow",
      branch_prefix: "custom/",
    }));
    const config = loadConfig(dir);
    expect(config.shared_dirs).toEqual(["node_modules"]);
    expect(config.main_branch_policy).toBe("allow");
    expect(config.branch_prefix).toBe("custom/");
    // Defaults for unspecified
    expect(config.force_cleanup).toBe("prompt");
    rmSync(dir, { recursive: true });
  });

  test("ignores invalid policy values", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, ".lanes.json"), JSON.stringify({
      main_branch_policy: "invalid",
      force_cleanup: 123,
    }));
    const config = loadConfig(dir);
    expect(config.main_branch_policy).toBe("block");
    expect(config.force_cleanup).toBe("prompt");
    rmSync(dir, { recursive: true });
  });

  test("handles corrupted config gracefully", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, ".lanes.json"), "not json{{{");
    const config = loadConfig(dir);
    expect(config).toEqual(getDefaultConfig());
    rmSync(dir, { recursive: true });
  });

  test("filters non-string shared_dirs entries", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, ".lanes.json"), JSON.stringify({
      shared_dirs: ["valid", 123, null, "also-valid"],
    }));
    const config = loadConfig(dir);
    expect(config.shared_dirs).toEqual(["valid", "also-valid"]);
    rmSync(dir, { recursive: true });
  });
});

describe("getDefaultConfig", () => {
  test("returns a copy of defaults", () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    expect(a).toEqual(b);
    a.shared_dirs.push("test");
    expect(b.shared_dirs).toEqual([]);
  });
});
