import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';
import { SectionLabel } from './SectionLabel';
import { OrialColors } from '../utils/colors';

async function renderSectionLabel(label: string) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<SectionLabel label={label} />);
  });
  return tree;
}

describe('SectionLabel', () => {
  it('renders without crashing', async () => {
    const tree = await renderSectionLabel('Today');
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders the provided label text', async () => {
    const tree = await renderSectionLabel('Habits');
    expect(tree.root.findByType(Text).props.children).toBe('Habits');
  });

  it('renders a 3x12 dot in violetLight', async () => {
    const tree = await renderSectionLabel('Habits');
    const views = tree.root.findAllByType(View);
    const dot = views.find((node) => {
      const style = node.props.style;
      return style && style.width === 3 && style.height === 12;
    });
    expect(dot).toBeDefined();
    expect(dot!.props.style.backgroundColor).toBe(OrialColors.violetLight);
  });
});
