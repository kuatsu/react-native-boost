import { NodePath, types as t } from '@babel/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs optimized components by default', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ verbose: false, silent: false });
    const path = createMockPath('/app/screens/LoginScreen.tsx', 42);

    logger.optimized({ component: 'Text', path });
    logger.skipped({ component: 'Text', path, reason: 'contains non-primitive children' });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('Optimized Text in /app/screens/LoginScreen.tsx:42');
  });

  it('logs skipped components and reasons when verbose is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ verbose: true, silent: false });
    const path = createMockPath('/app/screens/Settings.tsx', 10);

    logger.skipped({
      component: 'View',
      path,
      reason: 'has unresolved ancestor and dangerous optimization is disabled',
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain(
      'Skipped View in /app/screens/Settings.tsx:10 (has unresolved ancestor and dangerous optimization is disabled)'
    );
  });

  it('disables all logs when silent is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ verbose: true, silent: true });
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
