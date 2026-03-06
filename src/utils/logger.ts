type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export function debug(message: string): void {
  if (shouldLog("debug")) {
    console.error(`${COLORS.dim}[debug]${COLORS.reset} ${message}`);
  }
}

export function info(message: string): void {
  if (shouldLog("info")) {
    console.error(`${COLORS.cyan}[info]${COLORS.reset} ${message}`);
  }
}

export function warn(message: string): void {
  if (shouldLog("warn")) {
    console.error(`${COLORS.yellow}[warn]${COLORS.reset} ${message}`);
  }
}

export function error(message: string): void {
  if (shouldLog("error")) {
    console.error(`${COLORS.red}[error]${COLORS.reset} ${message}`);
  }
}

export function success(message: string): void {
  console.error(`${COLORS.green}[ok]${COLORS.reset} ${message}`);
}

export function print(message: string): void {
  console.log(message);
}

export function bold(text: string): string {
  return `${COLORS.bold}${text}${COLORS.reset}`;
}

export function dim(text: string): string {
  return `${COLORS.dim}${text}${COLORS.reset}`;
}
