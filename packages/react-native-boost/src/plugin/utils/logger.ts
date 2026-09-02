import { styleText } from 'node:util';
import {
  HubFile,
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
  const location = payload.path ? formatPathLocation(payload.path) : '';

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
