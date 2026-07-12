import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { NetWorthCard } from './NetWorthCard';
import { OrialColors } from '../utils/colors';

async function renderCard(balance: number, changePct: number, currency?: string) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<NetWorthCard balance={balance} changePct={changePct} currency={currency} />);
  });
  return tree;
}

describe('NetWorthCard', () => {
  it('renders without crashing', async () => {
    const tree = await renderCard(18240.5, 3.2);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('formats the balance as EUR currency by default', async () => {
    const tree = await renderCard(18240.5, 3.2);
    const balanceText = tree.root.findByProps({ testID: 'net-worth-balance' });
    expect(balanceText.props.children).toBe('€18,240.50');
  });

  it('formats the balance using a custom currency', async () => {
    const tree = await renderCard(1000, 1, 'USD');
    const balanceText = tree.root.findByProps({ testID: 'net-worth-balance' });
    expect(balanceText.props.children).toBe('$1,000.00');
  });

  it('shows a "+" prefix and success color for a positive change', async () => {
    const tree = await renderCard(1000, 3.2);
    const changeText = tree.root.findByProps({ testID: 'net-worth-change' });
    expect(changeText.props.children).toBe('+3.2%');
    const flatStyle = Object.assign({}, ...[changeText.props.style].flat());
    expect(flatStyle.color).toBe(OrialColors.success);
  });

  it('shows no "+" prefix and error color for a negative change', async () => {
    const tree = await renderCard(1000, -1.8);
    const changeText = tree.root.findByProps({ testID: 'net-worth-change' });
    expect(changeText.props.children).toBe('-1.8%');
    const flatStyle = Object.assign({}, ...[changeText.props.style].flat());
    expect(flatStyle.color).toBe(OrialColors.error);
  });

  it('treats exactly 0pct change as non-negative (success color, "+" prefix)', async () => {
    const tree = await renderCard(1000, 0);
    const changeText = tree.root.findByProps({ testID: 'net-worth-change' });
    expect(changeText.props.children).toBe('+0.0%');
    const flatStyle = Object.assign({}, ...[changeText.props.style].flat());
    expect(flatStyle.color).toBe(OrialColors.success);
  });
});
