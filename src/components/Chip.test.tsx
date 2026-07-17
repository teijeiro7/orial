import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { Chip } from './Chip';
import { OrialColors } from '../utils/colors';

async function renderChip(active: boolean, onPress = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Chip label="Health" active={active} onPress={onPress} />);
  });
  return tree;
}

// react-native's Pressable is a memo/forwardRef-wrapped component whose imported
// reference doesn't match the fiber's reported `type` in react-test-renderer, so
// we locate it by function name instead of `findByType(Pressable)`.
function findPressable(tree: ReactTestRenderer) {
  return tree.root.findAll(
    (node) => typeof node.type === 'function' && (node.type as { name?: string }).name === 'Pressable'
  )[0];
}

describe('Chip', () => {
  it('renders without crashing', async () => {
    const tree = await renderChip(false);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders the label text', async () => {
    const tree = await renderChip(false);
    expect(tree.root.findByType(Text).props.children).toBe('Health');
  });

  it('uses surface background and glassBorder when inactive', async () => {
    const tree = await renderChip(false);
    const pressable = findPressable(tree);
    const flatStyle = Object.assign({}, ...[pressable.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(OrialColors.surface);
    expect(flatStyle.borderColor).toBe(OrialColors.glassBorder);
  });

  it('uses violet background and text when active', async () => {
    const tree = await renderChip(true);
    const pressable = findPressable(tree);
    const flatStyle = Object.assign({}, ...[pressable.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(OrialColors.violet);
    expect(flatStyle.borderColor).toBe(OrialColors.violet);

    const text = tree.root.findByType(Text);
    const flatTextStyle = Object.assign({}, ...[text.props.style].flat());
    expect(flatTextStyle.color).toBe(OrialColors.textPrimary);
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const tree = await renderChip(false, onPress);
    findPressable(tree).props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
