import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { IconButton } from './IconButton';
import { OrialColors } from '../utils/colors';

// react-native's Pressable is a memo/forwardRef-wrapped component whose imported
// reference doesn't match the fiber's reported `type` in react-test-renderer, so
// we locate it by function name instead of `findByType(Pressable)`.
function findPressable(tree: ReactTestRenderer) {
  return tree.root.findAll(
    (node) => typeof node.type === 'function' && (node.type as { name?: string }).name === 'Pressable'
  )[0];
}

describe('IconButton', () => {
  it('renders without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<IconButton icon={<Text>i</Text>} onPress={jest.fn()} />);
    });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('uses surface background by default', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<IconButton icon={<Text>i</Text>} onPress={jest.fn()} />);
    });
    const pressable = findPressable(tree);
    const flatStyle = Object.assign({}, ...[pressable.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(OrialColors.surface);
  });

  it('uses violet background for the add variant', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<IconButton icon={<Text>+</Text>} onPress={jest.fn()} variant="add" />);
    });
    const pressable = findPressable(tree);
    const flatStyle = Object.assign({}, ...[pressable.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(OrialColors.violet);
  });

  it('renders the passed icon element', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<IconButton icon={<Text testID="my-icon">icon</Text>} onPress={jest.fn()} />);
    });
    expect(tree.root.findByProps({ testID: 'my-icon' })).toBeDefined();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<IconButton icon={<Text>i</Text>} onPress={onPress} />);
    });
    findPressable(tree).props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
