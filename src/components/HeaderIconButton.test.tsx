import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { HeaderIconButton } from './HeaderIconButton';

// react-native's Pressable is a memo/forwardRef-wrapped component whose imported
// reference doesn't match the fiber's reported `type` in react-test-renderer, so
// we locate it by function name instead of `findByType(Pressable)`.
function findPressable(tree: ReactTestRenderer) {
  return tree.root.findAll(
    (node) => typeof node.type === 'function' && (node.type as { name?: string }).name === 'Pressable'
  )[0];
}

describe('HeaderIconButton', () => {
  it('renders without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HeaderIconButton icon={<Text>i</Text>} onPress={jest.fn()} />);
    });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('does not render a badge dot by default', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HeaderIconButton icon={<Text>i</Text>} onPress={jest.fn()} />);
    });
    expect(tree.root.findAllByProps({ testID: 'badge-dot' })).toHaveLength(0);
  });

  it('renders a badge dot when showBadge is true', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HeaderIconButton icon={<Text>i</Text>} onPress={jest.fn()} showBadge />);
    });
    // A composite-level and a host-level fiber both carry the testID prop for
    // the same rendered node, so at least one match confirms the badge exists.
    expect(tree.root.findAllByProps({ testID: 'badge-dot' }).length).toBeGreaterThan(0);
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HeaderIconButton icon={<Text>i</Text>} onPress={onPress} />);
    });
    findPressable(tree).props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
