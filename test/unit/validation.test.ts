import { test, expect, describe } from "bun:test";
import {
  validateSessionName,
  validateCommitMessage,
  validateFilePaths,
  sanitizeForDisplay,
} from "../../src/utils/validation.ts";

describe("validateSessionName", () => {
  test("accepts valid names", () => {
    expect(validateSessionName("feature-a").valid).toBe(true);
    expect(validateSessionName("fix.bug").valid).toBe(true);
    expect(validateSessionName("task_123").valid).toBe(true);
    expect(validateSessionName("a").valid).toBe(true);
    expect(validateSessionName("MyFeature").valid).toBe(true);
  });

  test("rejects empty names", () => {
    expect(validateSessionName("").valid).toBe(false);
    expect(validateSessionName("   ").valid).toBe(false);
  });

  test("rejects names exceeding max length", () => {
    const longName = "a".repeat(101);
    expect(validateSessionName(longName).valid).toBe(false);
  });

  test("rejects path traversal", () => {
    expect(validateSessionName("../etc/passwd").valid).toBe(false);
    expect(validateSessionName("foo..bar").valid).toBe(false);
  });

  test("rejects path separators", () => {
    expect(validateSessionName("foo/bar").valid).toBe(false);
    expect(validateSessionName("foo\\bar").valid).toBe(false);
  });

  test("rejects dangerous characters", () => {
    expect(validateSessionName("foo;bar").valid).toBe(false);
    expect(validateSessionName("foo&bar").valid).toBe(false);
    expect(validateSessionName("foo|bar").valid).toBe(false);
    expect(validateSessionName("foo`bar").valid).toBe(false);
    expect(validateSessionName("foo$bar").valid).toBe(false);
    expect(validateSessionName("foo(bar)").valid).toBe(false);
    expect(validateSessionName("foo{bar}").valid).toBe(false);
  });

  test("rejects names starting with non-alphanumeric", () => {
    expect(validateSessionName("-foo").valid).toBe(false);
    expect(validateSessionName(".foo").valid).toBe(false);
    expect(validateSessionName("_foo").valid).toBe(false);
  });
});

describe("validateCommitMessage", () => {
  test("accepts valid messages", () => {
    expect(validateCommitMessage("fix: login bug").valid).toBe(true);
    expect(validateCommitMessage("a").valid).toBe(true);
  });

  test("rejects empty messages", () => {
    expect(validateCommitMessage("").valid).toBe(false);
    expect(validateCommitMessage("   ").valid).toBe(false);
  });

  test("rejects messages exceeding max length", () => {
    const longMsg = "a".repeat(501);
    expect(validateCommitMessage(longMsg).valid).toBe(false);
  });
});

describe("validateFilePaths", () => {
  test("accepts valid paths", () => {
    expect(validateFilePaths(["src/foo.ts", "test/bar.ts"]).valid).toBe(true);
  });

  test("rejects path traversal", () => {
    expect(validateFilePaths(["../secret.txt"]).valid).toBe(false);
    expect(validateFilePaths(["foo/../../etc/passwd"]).valid).toBe(false);
  });

  test("rejects absolute paths", () => {
    expect(validateFilePaths(["/etc/passwd"]).valid).toBe(false);
  });

  test("rejects dangerous characters", () => {
    expect(validateFilePaths(["foo;rm -rf /"]).valid).toBe(false);
  });
});

describe("sanitizeForDisplay", () => {
  test("strips control characters", () => {
    expect(sanitizeForDisplay("hello\x00world")).toBe("helloworld");
    expect(sanitizeForDisplay("foo\x1bbar")).toBe("foobar");
  });

  test("preserves normal text", () => {
    expect(sanitizeForDisplay("hello world")).toBe("hello world");
  });
});
