import { styleText } from 'node:util';
import {
  HubFile,
  LogLevel,
  OptimizationLogPayload,
  PluginLogger,
  SkippedOptimizationLogPayload,
  WarningLogPayload,
} from '../types';

const LOG_PREFIX = '[react-native-boost]';

export const noopLogger: PluginLogger = {
  optimized() {},
  skipped() {},
  forced() {},
  warning() {},
};

export const createLogger = (logLevel: LogLevel = 'info'): PluginLogger => {
  if (logLevel === 'silent') return noopLogger;

  return {
    optimized(payload) {
      if (logLevel === 'warn') return;
      const note = payload.note ? ` (${payload.note})` : '';
      writeLog('optimized', `Optimized ${payload.target} in ${formatPathLocation(payload.path)}${note}`);
    },
    skipped(payload) {
      if (logLevel !== 'debug') return;
      writeLog('skipped', `Skipped ${payload.target} in ${formatPathLocation(payload.path)} (${payload.reason})`);
    },
    forced(payload) {
      writeLog(
        'forced',
        `Force-optimized ${payload.target} in ${formatPathLocation(payload.path)} (skipped bailout: ${payload.reason})`
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
  const location = payload.path ? formatPathLocation(payload.path) : '';

  if (payload.target && location.length > 0) {
    return `${payload.target} in ${location}`;
  }

  if (payload.target) {
    return payload.target;
  }

  return location;
}

type LogCategory = 'optimized' | 'skipped' | 'forced' | 'warning';

function writeLog(level: LogCategory, message: string): void {
  const levelTag = formatLevel(level);
  console.log(`${LOG_PREFIX} ${levelTag} ${message}`);
}

function formatLevel(level: LogCategory): string {
  if (level === 'optimized') return styleText('green', '[optimized]');
  if (level === 'skipped') return styleText('yellow', '[skipped]');
  if (level === 'forced') return styleText('red', '[forced]');
  return styleText('magenta', '[warning]');
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
