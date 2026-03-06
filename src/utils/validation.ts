/**
 * Regex for valid session names.
 * Allows alphanumeric, dots, hyphens, and underscores.
 * Must start with an alphanumeric character.
 */
const SESSION_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Maximum session name length to prevent filesystem issues.
 */
const MAX_SESSION_NAME_LENGTH = 100;

/**
 * Characters that could be used for command injection.
 */
const DANGEROUS_CHARS = /[;&|`$(){}[\]!#~'"\\<>]/;

/**
 * Validate a session name for safety and format correctness.
 * Prevents path traversal, command injection, and filesystem issues.
 */
export function validateSessionName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Session name cannot be empty" };
  }

  if (name.length > MAX_SESSION_NAME_LENGTH) {
    return { valid: false, error: `Session name cannot exceed ${MAX_SESSION_NAME_LENGTH} characters` };
  }

  if (name.includes("..")) {
    return { valid: false, error: "Session name cannot contain '..' (path traversal)" };
  }

  if (name.includes("/") || name.includes("\\")) {
    return { valid: false, error: "Session name cannot contain path separators" };
  }

  if (DANGEROUS_CHARS.test(name)) {
    return { valid: false, error: "Session name contains invalid characters" };
  }

  if (!SESSION_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: "Session name must start with alphanumeric and contain only alphanumeric, dots, hyphens, or underscores",
    };
  }

  return { valid: true };
}

/**
 * Validate a commit message.
 */
export function validateCommitMessage(message: string): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: "Commit message cannot be empty" };
  }

  if (message.length > 500) {
    return { valid: false, error: "Commit message cannot exceed 500 characters" };
  }

  return { valid: true };
}

/**
 * Validate file paths to prevent path traversal attacks.
 */
export function validateFilePaths(files: string[]): { valid: boolean; error?: string } {
  for (const file of files) {
    if (file.includes("..")) {
      return { valid: false, error: `File path '${file}' contains path traversal` };
    }

    if (file.startsWith("/")) {
      return { valid: false, error: `File path '${file}' must be relative` };
    }

    if (DANGEROUS_CHARS.test(file)) {
      return { valid: false, error: `File path '${file}' contains invalid characters` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize a string for safe display (strip control characters).
 */
export function sanitizeForDisplay(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1f\x7f]/g, "");
}
