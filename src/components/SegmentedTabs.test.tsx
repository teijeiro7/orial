import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SegmentedTabs } from './SegmentedTabs';
import { OrialColors } from '../utils/colors';

const TABS = ['Day', 'Week', 'Month'];

// react-native's Pressable is a memo/forwardRef-wrapped component whose imported
// reference doesn't match the fiber's reported `type` in react-test-renderer, so
// we locate it by function name instead of `findAllByType(Pressable)`.
function findPressables(tree: ReactTestRenderer) {
  return tree.root.findAll(
    (node) => typeof node.type === 'function' && (node.type as { name?: string }).name === 'Pressable'
  );
}

async function renderTabs(activeIndex: number, onChange = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<SegmentedTabs tabs={TABS} activeIndex={activeIndex} onChange={onChange} />);
  });
  return tree;
}

describe('SegmentedTabs', () => {
  it('renders without crashing', async () => {
    const tree = await renderTabs(0);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders one button per tab label', async () => {
    const tree = await renderTabs(0);
    const texts = tree.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toEqual(TABS);
  });

  it('gives the active tab a violet background and bold text', async () => {
    const tree = await renderTabs(1);
    const pressables = findPressables(tree);
    const activeStyle = Object.assign({}, ...[pressables[1].props.style].flat());
    expect(activeStyle.backgroundColor).toBe(OrialColors.violet);

    const activeText = tree.root.findAllByType(Text)[1];
    const flatTextStyle = Object.assign({}, ...[activeText.props.style].flat());
    expect(flatTextStyle.color).toBe(OrialColors.textPrimary);
    expect(flatTextStyle.fontWeight).toBe('600');
  });

  it('leaves inactive tabs transparent with muted text', async () => {
    const tree = await renderTabs(1);
    const pressables = findPressables(tree);
    const inactiveStyle = Object.assign({}, ...[pressables[0].props.style].flat());
    expect(inactiveStyle.backgroundColor).toBe('transparent');
  });

  it('calls onChange with the pressed tab index', async () => {
    const onChange = jest.fn();
    const tree = await renderTabs(0, onChange);
    findPressables(tree)[2].props.onPress();
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
