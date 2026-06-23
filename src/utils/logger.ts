const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

type Level = keyof typeof LEVELS;

function getLevel(): Level {
  const env = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'warn' : 'info');
  if (env in LEVELS) return env as Level;
  return 'info';
}

function labelize(level: Level): string {
  switch (level) {
    case 'debug': return `${COLORS.gray}DEBUG${COLORS.reset}`;
    case 'info':  return `${COLORS.cyan}INFO ${COLORS.reset}`;
    case 'warn':  return `${COLORS.yellow}WARN ${COLORS.reset}`;
    case 'error': return `${COLORS.red}ERROR${COLORS.reset}`;
  }
}

function timestamp(): string {
  const now = new Date().toISOString().slice(11, 23);
  return `${COLORS.dim}${now}${COLORS.reset}`;
}

function log(level: Level, message: string, ...args: unknown[]) {
  if (LEVELS[level] < LEVELS[getLevel()]) return;
  const line = `${timestamp()} ${labelize(level)} ${message}`;
  if (level === 'error') {
    console.error(line, ...args);
  } else {
    console.log(line, ...args);
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
  info:  (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  warn:  (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
};
