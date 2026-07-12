import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { AreaChart } from './AreaChart';

async function renderAreaChart(data: number[], width = 100, height = 50, color = '#7C3AED') {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<AreaChart data={data} width={width} height={height} color={color} />);
  });
  return tree;
}

describe('AreaChart', () => {
  it('renders without crashing', async () => {
    const tree = await renderAreaChart([10, 40, 20, 80, 30]);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders nothing for empty data', async () => {
    const tree = await renderAreaChart([]);
    expect(tree.toJSON()).toBeNull();
  });

  it('plots the line path from the top-left origin at the first data point', async () => {
    const height = 50;
    // With a flat series, every point sits at the same normalized y (mid-clamped to 0 range->min=max).
    const tree = await renderAreaChart([10, 10, 10], 100, height);
    const paths = tree.root.findAllByType('RNSVGPath' as unknown as React.ComponentType);
    const linePath = paths[1]; // paths[0] is the filled area, paths[1] is the stroked line.
    expect(linePath.props.d.startsWith('M 0')).toBe(true);
  });

  it('places the highest value at y=0 and the lowest value at y=height', async () => {
    const height = 50;
    const tree = await renderAreaChart([0, 100], 100, height);
    const paths = tree.root.findAllByType('RNSVGPath' as unknown as React.ComponentType);
    const linePath = paths[1];
    // First point (value 0, the min) should be at the baseline (y = height).
    expect(linePath.props.d).toContain(`M 0 ${height}`);
    // Second point (value 100, the max) should be at the top (y = 0).
    expect(linePath.props.d).toContain('L 100 0');
  });

  it('closes the area path down to the baseline for the gradient fill', async () => {
    const height = 50;
    const width = 100;
    const tree = await renderAreaChart([0, 100], width, height);
    const paths = tree.root.findAllByType('RNSVGPath' as unknown as React.ComponentType);
    const areaPath = paths[0];
    expect(areaPath.props.d).toContain(`L ${width} ${height}`);
    expect(areaPath.props.d).toContain(`L 0 ${height}`);
    expect(areaPath.props.d.trim().endsWith('Z')).toBe(true);
  });
});
