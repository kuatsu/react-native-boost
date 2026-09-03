import { NodePath, types as t } from '@babel/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs optimized components at the default info level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    const path = createMockPath('/app/screens/LoginScreen.tsx', 42);

    logger.optimized({ component: 'Text', path });
    logger.skipped({ component: 'Text', path, reason: 'contains non-primitive children' });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('Optimized Text in /app/screens/LoginScreen.tsx:42');
  });

  it('logs skipped components and reasons at the debug level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('debug');
    const path = createMockPath('/app/screens/Settings.tsx', 10);

    logger.skipped({
      component: 'View',
      path,
      reason: 'has unresolved ancestor that may render Text',
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain(
      'Skipped View in /app/screens/Settings.tsx:10 (has unresolved ancestor that may render Text)'
    );
  });

  it('logs only warnings and forced optimizations at the warn level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('warn');
    const path = createMockPath('/app/screens/Profile.tsx', 7);

    logger.optimized({ component: 'Text', path });
    logger.skipped({ component: 'View', path, reason: 'line is marked with @boost-ignore' });
    logger.warning({ component: 'Text', path, message: 'numberOfLines is invalid' });
    logger.forced({ component: 'View', path, reason: 'contains unsupported props' });

    expect(consoleSpy.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining('numberOfLines is invalid'),
      expect.stringContaining('Force-optimized View'),
    ]);
  });

  it('disables all logs at the silent level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('silent');
    const path = createMockPath('/app/screens/Profile.tsx', 7);

    logger.optimized({ component: 'Text', path });
    logger.skipped({ component: 'View', path, reason: 'line is marked with @boost-ignore' });
    logger.warning({ component: 'Text', path, message: 'numberOfLines is invalid' });

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

function createMockPath(filename: string, lineNumber: number): NodePath<t.JSXOpeningElement> {
  return {
    hub: { file: { opts: { filename } } },
    node: { loc: { start: { line: lineNumber } } },
  } as unknown as NodePath<t.JSXOpeningElement>;
}
