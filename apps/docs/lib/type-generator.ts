import 'server-only';
import { createFileSystemGeneratorCache, createGenerator, type Generator } from 'fumadocs-typescript';

export const typeGenerator: Generator = createGenerator({
  cache: createFileSystemGeneratorCache('.next/fumadocs-typescript'),
});
