import { NodePath, types as t } from '@babel/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logger';

const originalEnv = {
  NO_COLOR: process.env.NO_COLOR,
  FORCE_COLOR: process.env.FORCE_COLOR,
  CLICOLOR: process.env.CLICOLOR,
  CLICOLOR_FORCE: process.env.CLICOLOR_FORCE,
  COLORTERM: process.env.COLORTERM,
  TERM: process.env.TERM,
};

describe('logger', () => {
  afterEach(() => {
    restoreEnvVar('NO_COLOR', originalEnv.NO_COLOR);
    restoreEnvVar('FORCE_COLOR', originalEnv.FORCE_COLOR);
    restoreEnvVar('CLICOLOR', originalEnv.CLICOLOR);
    restoreEnvVar('CLICOLOR_FORCE', originalEnv.CLICOLOR_FORCE);
    restoreEnvVar('COLORTERM', originalEnv.COLORTERM);
    restoreEnvVar('TERM', originalEnv.TERM);
    vi.restoreAllMocks();
  });

  it('logs optimized components by default', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({
      verbose: false,
      silent: false,
    });

    const path = createMockPath('/app/screens/LoginScreen.tsx', 42);

    logger.optimized({
      component: 'Text',
      path,
    });

    logger.skipped({
      component: 'Text',
      path,
      reason: 'contains non-string children',
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(stripAnsi(String(consoleSpy.mock.calls[0][0]))).toContain(
      'Optimized Text in /app/screens/LoginScreen.tsx:42'
    );
  });

  it('logs skipped components and reasons when verbose is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({
      verbose: true,
      silent: false,
    });

    const path = createMockPath('/app/screens/Settings.tsx', 10);

    logger.skipped({
      component: 'View',
      path,
      reason: 'has unresolved ancestor and dangerous optimization is disabled',
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(stripAnsi(String(consoleSpy.mock.calls[0][0]))).toContain(
      'Skipped View in /app/screens/Settings.tsx:10 (has unresolved ancestor and dangerous optimization is disabled)'
    );
  });

  it('disables all logs when silent is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({
      verbose: true,
      silent: true,
    });

    const path = createMockPath('/app/screens/Profile.tsx', 7);

    logger.optimized({
      component: 'Text',
      path,
    });
    logger.skipped({
      component: 'View',
      path,
      reason: 'line is marked with @boost-ignore',
    });
    logger.warning({
      component: 'Text',
      path,
      message: 'numberOfLines is invalid',
    });

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('colorizes log levels when TERM supports colors even without TTY', () => {
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    delete process.env.CLICOLOR;
    delete process.env.CLICOLOR_FORCE;
    delete process.env.COLORTERM;
    process.env.TERM = 'xterm-256color';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({
      verbose: false,
      silent: false,
    });

    const path = createMockPath('/app/screens/Color.tsx', 1);

    logger.optimized({
      component: 'Text',
      path,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('\u001B[32m[optimized]\u001B[0m');
  });

  it('does not colorize when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    process.env.TERM = 'xterm-256color';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({
      verbose: false,
      silent: false,
    });

    const path = createMockPath('/app/screens/NoColor.tsx', 1);

    logger.optimized({
      component: 'Text',
      path,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).not.toContain('\u001B[32m[optimized]\u001B[0m');
  });
});

function createMockPath(filename: string, lineNumber: number): NodePath<t.JSXOpeningElement> {
  return {
    hub: {
      file: {
        opts: {
          filename,
        },
      },
    },
    node: {
      loc: {
        start: {
          line: lineNumber,
        },
      },
    },
  } as unknown as NodePath<t.JSXOpeningElement>;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function restoreEnvVar(
  key: 'NO_COLOR' | 'FORCE_COLOR' | 'CLICOLOR' | 'CLICOLOR_FORCE' | 'COLORTERM' | 'TERM',
  value: string | undefined
): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
