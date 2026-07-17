import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { StatTileGrid } from './StatTileGrid';
import { StatTile } from './StatTile';
import { OrialColors } from '../utils/colors';

const TILES = [
  { icon: <Text>a</Text>, value: '8,204', label: 'Steps', color: OrialColors.categoryFitness },
  { icon: <Text>b</Text>, value: '420', label: 'Calories', color: OrialColors.categoryHealth },
  { icon: <Text>c</Text>, value: '3', label: 'Habits', color: OrialColors.categoryMind },
];

describe('StatTileGrid', () => {
  it('renders without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<StatTileGrid tiles={TILES} />);
    });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders one StatTile per entry in the tiles array', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<StatTileGrid tiles={TILES} />);
    });
    expect(tree.root.findAllByType(StatTile)).toHaveLength(TILES.length);
  });

  it('renders an empty grid without crashing when given no tiles', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<StatTileGrid tiles={[]} />);
    });
    expect(tree.root.findAllByType(StatTile)).toHaveLength(0);
  });
});
