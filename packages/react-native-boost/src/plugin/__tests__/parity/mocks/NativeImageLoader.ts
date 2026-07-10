const NativeImageLoader = {
  getSize: () => Promise.resolve([0, 0]),
  getSizeWithHeaders: () => Promise.resolve([0, 0]),
  prefetchImage: () => Promise.resolve(true),
  prefetchImageWithMetadata: () => Promise.resolve(true),
  queryCache: () => Promise.resolve({}),
};

export default NativeImageLoader;
