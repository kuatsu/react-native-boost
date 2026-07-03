import type { ComponentType } from 'react';
import type { ImageProps } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reactNativeImage = (() => null) as ComponentType<ImageProps>;
const nativeHost = (() => null) as ComponentType<ImageProps>;

type LoadNativeComponent = () => { default?: ComponentType<ImageProps> };

async function importNativeImage({
  os,
  loadNativeComponent,
}: {
  os: string;
  loadNativeComponent?: LoadNativeComponent;
}) {
  vi.resetModules();
  vi.doMock('react-native', () => ({
    Image: reactNativeImage,
    Platform: { OS: os },
  }));
  vi.doMock('react-native/Libraries/Image/ImageViewNativeComponent', () => {
    if (loadNativeComponent) return loadNativeComponent();
    return { default: nativeHost };
  });

  return import('./native-image');
}

afterEach(() => {
  vi.doUnmock('react-native');
  vi.doUnmock('react-native/Libraries/Image/ImageViewNativeComponent');
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('NativeImage', () => {
  it('resolves to the internal native host when loading succeeds on a non-web platform', async () => {
    const { resolveNativeImageComponent } = await importNativeImage({ os: 'android' });
    const NativeImage = resolveNativeImageComponent(
      {
        Image: reactNativeImage,
        Platform: { OS: 'android' },
      },
      () => ({ default: nativeHost })
    );

    expect(NativeImage).toBe(nativeHost);
  });

  it('falls back to React Native Image when the internal host cannot be loaded', async () => {
    const { NativeImage } = await importNativeImage({
      os: 'android',
      loadNativeComponent: vi.fn(() => {
        throw new Error('missing internal host');
      }),
    });

    expect(NativeImage).toBe(reactNativeImage);
  });

  it('uses React Native Image on web without loading the internal host', async () => {
    const loadNativeComponent = vi.fn(() => ({ default: nativeHost }));
    const { NativeImage } = await importNativeImage({ os: 'web', loadNativeComponent });

    expect(NativeImage).toBe(reactNativeImage);
    expect(loadNativeComponent).not.toHaveBeenCalled();
  });
});
