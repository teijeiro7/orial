import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';
import { StatTile } from './StatTile';
import { OrialColors } from '../utils/colors';

describe('StatTile', () => {
  it('renders without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <StatTile icon={<Text>i</Text>} value="8,204" label="Steps" color={OrialColors.categoryFitness} />
      );
    });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders the value and an uppercased label', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <StatTile icon={<Text>i</Text>} value="8,204" label="Steps" color={OrialColors.categoryFitness} />
      );
    });
    const texts = tree.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContain('8,204');
    expect(texts).toContain('STEPS');
  });

  it('tints the icon pill background with ~18% opacity of the accent color', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <StatTile icon={<Text>i</Text>} value="8,204" label="Steps" color={OrialColors.categoryFitness} />
      );
    });
    const views = tree.root.findAllByType(View);
    const pill = views.find((node) => {
      const flat = Object.assign({}, ...[node.props.style].flat(Infinity));
      return flat.width === 36 && flat.height === 36;
    });
    expect(pill).toBeDefined();
    const flatPillStyle = Object.assign({}, ...[pill!.props.style].flat(Infinity));
    expect(flatPillStyle.backgroundColor).toBe(`${OrialColors.categoryFitness}2E`);
  });
});
