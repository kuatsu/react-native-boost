import type { ComponentType } from 'react';
import type { ActivityIndicatorProps } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reactNativeActivityIndicator = (() => null) as ComponentType<ActivityIndicatorProps>;

async function importNativeActivityIndicator(os: string) {
  vi.resetModules();
  const loadActivityIndicator = vi.fn(() => reactNativeActivityIndicator);
  vi.doMock('react-native', () => ({
    get ActivityIndicator() {
      return loadActivityIndicator();
    },
    Platform: { OS: os },
  }));

  return { ...(await import('../components/native-activity-indicator')), loadActivityIndicator };
}

afterEach(() => {
  vi.doUnmock('react-native');
  vi.resetModules();
});

describe('NativeActivityIndicator', () => {
  it.each([
    ['ios', 'RCTActivityIndicatorView'],
    ['android', 'AndroidProgressBar'],
  ])('loads React Native ActivityIndicator to register and use the %s host', async (os, host) => {
    const { NativeActivityIndicator, loadActivityIndicator } = await importNativeActivityIndicator(os);

    expect(loadActivityIndicator).toHaveBeenCalledOnce();
    expect(NativeActivityIndicator).toBe(host);
  });

  it('uses React Native ActivityIndicator on other platforms', async () => {
    const { NativeActivityIndicator, loadActivityIndicator } = await importNativeActivityIndicator('web');

    expect(loadActivityIndicator).toHaveBeenCalledOnce();
    expect(NativeActivityIndicator).toBe(reactNativeActivityIndicator);
  });
});
