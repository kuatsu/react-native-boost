import {
  HubFile,
  OptimizationLogPayload,
  PluginLogger,
  SkippedOptimizationLogPayload,
  WarningLogPayload,
} from '../types';

const LOG_PREFIX = '[react-native-boost]';

const ANSI_RESET = '\u001B[0m';
const ANSI_GREEN = '\u001B[32m';
const ANSI_YELLOW = '\u001B[33m';
const ANSI_MAGENTA = '\u001B[35m';
const ANSI_RED = '\u001B[31m';

export const noopLogger: PluginLogger = {
  optimized() {},
  skipped() {},
  forced() {},
  warning() {},
};

export const createLogger = ({ verbose, silent }: { verbose: boolean; silent: boolean }): PluginLogger => {
  if (silent) return noopLogger;

  return {
    optimized(payload) {
      writeLog('optimized', `Optimized ${payload.component} in ${formatPathLocation(payload.path)}`);
    },
    skipped(payload) {
      if (!verbose) return;
      writeLog('skipped', `Skipped ${payload.component} in ${formatPathLocation(payload.path)} (${payload.reason})`);
    },
    forced(payload) {
      writeLog(
        'forced',
        `Force-optimized ${payload.component} in ${formatPathLocation(payload.path)} (skipped bailout: ${payload.reason})`
      );
    },
    warning(payload) {
      const context = formatWarningContext(payload);
      const message = context.length > 0 ? `${context}: ${payload.message}` : payload.message;
      writeLog('warning', message);
    },
  };
};

function formatWarningContext(payload: WarningLogPayload): string {
  const location = formatPathLocation(payload.path);

  if (payload.component && location.length > 0) {
    return `${payload.component} in ${location}`;
  }

  if (payload.component) {
    return payload.component;
  }

  return location;
}

type LogLevel = 'optimized' | 'skipped' | 'forced' | 'warning';

function writeLog(level: LogLevel, message: string): void {
  const levelTag = formatLevel(level);
  console.log(`${LOG_PREFIX} ${levelTag} ${message}`);
}

function formatLevel(level: LogLevel): string {
  if (level === 'optimized') {
    return colorize('[optimized]', ANSI_GREEN);
  }

  if (level === 'skipped') {
    return colorize('[skipped]', ANSI_YELLOW);
  }

  if (level === 'forced') {
    return colorize('[forced]', ANSI_RED);
  }

  return colorize('[warning]', ANSI_MAGENTA);
}

function colorize(value: string, colorCode: string): string {
  if (!shouldUseColor()) return value;
  return `${colorCode}${value}${ANSI_RESET}`;
}

function shouldUseColor(): boolean {
  if (process.env.NO_COLOR != null) return false;

  if (process.env.FORCE_COLOR === '0') return false;
  if (process.env.FORCE_COLOR != null) return true;

  if (process.env.CLICOLOR === '0') return false;
  if (process.env.CLICOLOR_FORCE != null && process.env.CLICOLOR_FORCE !== '0') return true;

  if (process.stdout?.isTTY === true || process.stderr?.isTTY === true) {
    return true;
  }

  const colorTerm = process.env.COLORTERM;
  if (colorTerm != null && colorTerm !== '') {
    return true;
  }

  const term = process.env.TERM;
  return term != null && term !== '' && term.toLowerCase() !== 'dumb';
}

function formatPathLocation(
  payloadPath: OptimizationLogPayload['path'] | SkippedOptimizationLogPayload['path'] | undefined
): string {
  if (!payloadPath) return 'unknown file:unknown line';

  const hub = payloadPath.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;
  const filename = file?.opts?.filename ?? 'unknown file';
  const lineNumber = payloadPath.node.loc?.start.line ?? 'unknown line';

  return `${filename}:${lineNumber}`;
}
