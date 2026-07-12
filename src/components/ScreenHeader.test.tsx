import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { ScreenHeader } from './ScreenHeader';

describe('ScreenHeader', () => {
  it('renders without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<ScreenHeader title="Habits" />);
    });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders the title text', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<ScreenHeader title="Habits" />);
    });
    expect(tree.root.findByType(Text).props.children).toBe('Habits');
  });

  it('renders left and right slot content', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <ScreenHeader
          title="Habits"
          left={<Text testID="left-slot">Back</Text>}
          right={<Text testID="right-slot">Add</Text>}
        />
      );
    });
    expect(tree.root.findByProps({ testID: 'left-slot' }).props.children).toBe('Back');
    expect(tree.root.findByProps({ testID: 'right-slot' }).props.children).toBe('Add');
  });

  it('renders with no title and no slots without crashing', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<ScreenHeader />);
    });
    expect(tree.toJSON()).not.toBeNull();
  });
});
