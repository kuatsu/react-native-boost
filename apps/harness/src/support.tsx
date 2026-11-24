import type { ReactElement } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { expect, render } from 'react-native-harness';
import { screen } from '@react-native-harness/ui';

export type Tree = ReactElement<{ children: ReactElement }>;

export const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const wrappers: unknown[] = [ActivityIndicator, Image, Text, View];

export async function expectOptimizedMount(tree: Tree) {
  // A wrapper here means Boost did not optimize the element, so the test would check nothing.
  expect(wrappers).not.toContain(tree.props.children.type);
  await render(tree);
  await screen.findByTestId('target');
}
