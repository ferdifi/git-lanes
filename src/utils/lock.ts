import { existsSync, mkdirSync, unlinkSync, writeFileSync, readFileSync } from "fs";
import { dirname } from "path";

const LOCK_STALE_MS = 30_000; // 30 seconds

export class LockError extends Error {
  constructor(
    message: string,
    public readonly lockPath: string,
  ) {
    super(message);
    this.name = "LockError";
  }
}

interface LockInfo {
  pid: number;
  timestamp: number;
  hostname: string;
}

/**
 * Acquire a file-based lock using mkdir atomicity.
 * Creates a lock directory (atomic on most filesystems) with a metadata file inside.
 */
export function acquireLock(
  filePath: string,
  retries = 10,
  retryDelayMs = 100,
): () => void {
  const lockPath = `${filePath}.lock`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // mkdir is atomic on POSIX filesystems
      mkdirSync(lockPath, { recursive: false });

      // Write lock metadata
      const lockInfo: LockInfo = {
        pid: process.pid,
        timestamp: Date.now(),
        hostname: require("os").hostname(),
      };
      writeFileSync(`${lockPath}/info.json`, JSON.stringify(lockInfo));

      // Return release function
      return () => releaseLock(lockPath);
    } catch (err: unknown) {
      if (isErrnoException(err) && err.code === "EEXIST") {
        // Lock exists - check if it's stale
        if (isLockStale(lockPath)) {
          forceReleaseLock(lockPath);
          continue;
        }

        // Wait and retry
        if (attempt < retries - 1) {
          Bun.sleepSync(retryDelayMs);
          continue;
        }

        throw new LockError(
          `Failed to acquire lock after ${retries} attempts: ${filePath}`,
          lockPath,
        );
      }
      throw err;
    }
  }

  throw new LockError(`Failed to acquire lock: ${filePath}`, lockPath);
}

/**
 * Release a previously acquired lock.
 */
function releaseLock(lockPath: string): void {
  try {
    const infoPath = `${lockPath}/info.json`;
    if (existsSync(infoPath)) {
      unlinkSync(infoPath);
    }
    require("fs").rmdirSync(lockPath);
  } catch {
    // Best effort cleanup
  }
}

/**
 * Force-release a stale lock.
 */
function forceReleaseLock(lockPath: string): void {
  try {
    const infoPath = `${lockPath}/info.json`;
    if (existsSync(infoPath)) {
      unlinkSync(infoPath);
    }
    require("fs").rmdirSync(lockPath);
  } catch {
    // If we can't remove it, someone else may have acquired it
  }
}

/**
 * Check if an existing lock is stale (process dead or too old).
 */
function isLockStale(lockPath: string): boolean {
  const infoPath = `${lockPath}/info.json`;

  try {
    if (!existsSync(infoPath)) {
      // Lock dir exists but no info file - consider stale
      return true;
    }

    const raw = readFileSync(infoPath, "utf-8");
    const info: LockInfo = JSON.parse(raw);

    // Check if the process is still alive
    if (!isProcessAlive(info.pid)) {
      return true;
    }

    // Check if the lock is too old
    if (Date.now() - info.timestamp > LOCK_STALE_MS) {
      return true;
    }

    return false;
  } catch {
    // Can't read lock info - consider stale
    return true;
  }
}

/**
 * Check if a process with the given PID is still running.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a function while holding a file lock.
 * Ensures the lock is released even if the function throws.
 */
export function withLock<T>(filePath: string, fn: () => T): T {
  const release = acquireLock(filePath);
  try {
    return fn();
  } finally {
    release();
  }
}

/**
 * Execute an async function while holding a file lock.
 */
export async function withLockAsync<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const release = acquireLock(filePath);
  try {
    return await fn();
  } finally {
    release();
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
