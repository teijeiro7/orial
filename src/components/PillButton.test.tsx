import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { PillButton } from './PillButton';
import { OrialColors } from '../utils/colors';

// react-native's Pressable is a memo/forwardRef-wrapped component whose imported
// reference doesn't match the fiber's reported `type` in react-test-renderer, so
// we locate it by function name instead of `findByType(Pressable)`.
function findPressable(tree: ReactTestRenderer) {
  return tree.root.findAll(
    (node) => typeof node.type === 'function' && (node.type as { name?: string }).name === 'Pressable'
  )[0];
}

describe('PillButton', () => {
  it('renders without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<PillButton label="Save" onPress={jest.fn()} />);
    });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('defaults to violet background and textPrimary color', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<PillButton label="Save" onPress={jest.fn()} />);
    });
    const pressable = findPressable(tree);
    const flatStyle = Object.assign({}, ...[pressable.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(OrialColors.violet);

    const text = tree.root.findByType(Text);
    const flatTextStyle = Object.assign({}, ...[text.props.style].flat());
    expect(flatTextStyle.color).toBe(OrialColors.textPrimary);
  });

  it('applies custom backgroundColor and textColor props', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PillButton label="Delete" onPress={jest.fn()} backgroundColor={OrialColors.error} textColor="#000000" />
      );
    });
    const pressable = findPressable(tree);
    const flatStyle = Object.assign({}, ...[pressable.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(OrialColors.error);

    const text = tree.root.findByType(Text);
    const flatTextStyle = Object.assign({}, ...[text.props.style].flat());
    expect(flatTextStyle.color).toBe('#000000');
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<PillButton label="Save" onPress={onPress} />);
    });
    findPressable(tree).props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
