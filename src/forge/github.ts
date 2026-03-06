import { spawnSync } from "bun";
import { getDefaultBranch, getRepoRoot } from "../git.ts";

export type ForgeType = "github" | "gitlab" | "bitbucket";

/**
 * Create a pull request on the specified forge platform.
 */
export function createPullRequest(
  branch: string,
  title: string,
  body?: string,
  forge: ForgeType = "github",
  cwd?: string,
): string {
  const repoRoot = getRepoRoot(cwd);
  const defaultBranch = getDefaultBranch(repoRoot);

  switch (forge) {
    case "github":
      return createGitHubPR(branch, defaultBranch, title, body, repoRoot);
    case "gitlab":
      return createGitLabMR(branch, defaultBranch, title, body, repoRoot);
    case "bitbucket":
      return createBitbucketPR(branch, defaultBranch, title, body, repoRoot);
    default:
      throw new Error(`Unsupported forge: ${forge}`);
  }
}

function createGitHubPR(
  branch: string,
  baseBranch: string,
  title: string,
  body: string | undefined,
  cwd: string,
): string {
  const args = ["pr", "create", "--head", branch, "--base", baseBranch, "--title", title];
  if (body) args.push("--body", body);

  const result = spawnSync(["gh", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    throw new Error(`GitHub CLI failed: ${stderr}. Make sure 'gh' is installed and authenticated.`);
  }

  return result.stdout.toString().trim();
}

function createGitLabMR(
  branch: string,
  baseBranch: string,
  title: string,
  body: string | undefined,
  cwd: string,
): string {
  const args = [
    "mr", "create",
    "--source-branch", branch,
    "--target-branch", baseBranch,
    "--title", title,
  ];
  if (body) args.push("--description", body);

  const result = spawnSync(["glab", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    throw new Error(`GitLab CLI failed: ${stderr}. Make sure 'glab' is installed and authenticated.`);
  }

  return result.stdout.toString().trim();
}

function createBitbucketPR(
  branch: string,
  baseBranch: string,
  title: string,
  body: string | undefined,
  cwd: string,
): string {
  // Try 'bb' CLI first
  const args = ["bb", "pr", "create", "--source", branch, "--dest", baseBranch, "--title", title];
  if (body) {
    args.push("--body", body);
  }
  const result = spawnSync(args, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(
      "Bitbucket PR creation failed. Install a Bitbucket CLI tool or create the PR manually.",
    );
  }

  return result.stdout.toString().trim();
}
