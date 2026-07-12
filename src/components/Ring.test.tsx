import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { Ring } from './Ring';

async function renderRing(children?: React.ReactNode, props: Partial<React.ComponentProps<typeof Ring>> = {}) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <Ring pct={50} color="#7C3AED" {...props}>
        {children}
      </Ring>
    );
  });
  return tree;
}

describe('Ring', () => {
  it('renders without crashing', async () => {
    const tree = await renderRing();
    expect(tree.toJSON()).not.toBeNull();
  });

  it('sets strokeDashoffset to 0 at 100pct (fully filled ring)', async () => {
    const size = 64;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const tree = await renderRing(undefined, { pct: 100, size, strokeWidth });
    const json = JSON.stringify(tree.toJSON());
    // react-native-svg encodes a falsy (0) strokeDashoffset as null on the native prop.
    expect(json).toContain(`"strokeDashoffset":null`);
    expect(json).toContain(String(circumference));
  });

  it('sets strokeDashoffset to half the circumference at 50pct', async () => {
    const size = 64;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const expectedOffset = circumference * 0.5;

    const tree = await renderRing(undefined, { pct: 50, size, strokeWidth });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(`"strokeDashoffset":${expectedOffset}`);
  });

  it('clamps pct above 100 down to a full ring (dashoffset 0)', async () => {
    const tree = await renderRing(undefined, { pct: 150 });
    const json = JSON.stringify(tree.toJSON());
    // react-native-svg encodes a falsy (0) strokeDashoffset as null on the native prop.
    expect(json).toContain(`"strokeDashoffset":null`);
  });

  it('clamps negative pct up to an empty ring (dashoffset = circumference)', async () => {
    const size = 64;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const tree = await renderRing(undefined, { pct: -20, size, strokeWidth });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(`"strokeDashoffset":${circumference}`);
  });

  it('renders children centered inside the ring', async () => {
    const tree = await renderRing(<Text>70%</Text>, { pct: 70 });
    expect(tree.root.findByType(Text).props.children).toBe('70%');
  });
});
