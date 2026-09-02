import type { ComponentType } from 'react';
import type { ImageProps } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reactNativeImage = (() => null) as ComponentType<ImageProps>;

async function importNativeImage(os: string) {
  vi.resetModules();
  const loadImage = vi.fn(() => reactNativeImage);
  vi.doMock('react-native', () => ({
    get Image() {
      return loadImage();
    },
    Platform: { OS: os },
  }));

  return { ...(await import('../components/native-image')), loadImage };
}

afterEach(() => {
  vi.doUnmock('react-native');
  vi.resetModules();
});

describe('NativeImage', () => {
  it('loads React Native Image to register and use the native host', async () => {
    const { NativeImage, loadImage } = await importNativeImage('android');

    expect(loadImage).toHaveBeenCalledOnce();
    expect(NativeImage).toBe('RCTImageView');
  });

  it('uses React Native Image on web', async () => {
    const { NativeImage, loadImage } = await importNativeImage('web');

    expect(loadImage).toHaveBeenCalledOnce();
    expect(NativeImage).toBe(reactNativeImage);
  });
});
