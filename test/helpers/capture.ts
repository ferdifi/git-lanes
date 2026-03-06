import { spawnSync } from "bun";
import { join } from "path";

const CLI_PATH = join(import.meta.dir, "../../src/cli.ts");

export interface CapturedOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the git-lanes CLI and capture its output.
 */
export function runCLI(args: string[], cwd?: string): CapturedOutput {
  const result = spawnSync(["bun", "run", CLI_PATH, ...args], {
    cwd: cwd ?? process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}
