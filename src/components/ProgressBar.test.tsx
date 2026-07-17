import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { OrialColors } from '../utils/colors';

async function renderProgressBar(pct: number, color: string = OrialColors.violet) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<ProgressBar pct={pct} color={color} />);
  });
  return tree;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity));
}

function getFillView(tree: ReactTestRenderer) {
  const views = tree.root.findAllByType(View);
  // The fill view is the nested one (track is the outer container).
  return views[views.length - 1];
}

describe('ProgressBar', () => {
  it('renders without crashing', async () => {
    const tree = await renderProgressBar(50);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('sets fill width to the given pct', async () => {
    const tree = await renderProgressBar(42);
    const fill = getFillView(tree);
    expect(flattenStyle(fill.props.style).width).toBe('42%');
  });

  it('sets fill background color to the given color', async () => {
    const tree = await renderProgressBar(42, OrialColors.cyan);
    const fill = getFillView(tree);
    expect(flattenStyle(fill.props.style).backgroundColor).toBe(OrialColors.cyan);
  });

  it('clamps pct above 100 to 100%', async () => {
    const tree = await renderProgressBar(140);
    const fill = getFillView(tree);
    expect(flattenStyle(fill.props.style).width).toBe('100%');
  });

  it('clamps negative pct to 0%', async () => {
    const tree = await renderProgressBar(-10);
    const fill = getFillView(tree);
    expect(flattenStyle(fill.props.style).width).toBe('0%');
  });
});
