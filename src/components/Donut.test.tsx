import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Donut } from './Donut';
import { OrialColors } from '../utils/colors';

const START_ROTATION_DEG = -90;
const FULL_TURN_DEG = 360;

function rotationMatrix(deg: number): number[] {
  const rad = (deg * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad)];
}

async function renderDonut(segments: { pct: number; color: string }[], size = 120, strokeWidth = 20) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Donut segments={segments} size={size} strokeWidth={strokeWidth} />);
  });
  // First RNSVGCircle is the background track; the rest are one per segment.
  const circles = tree.root.findAllByType('RNSVGCircle' as unknown as React.ComponentType);
  return { tree, segmentCircles: circles.slice(1) };
}

describe('Donut', () => {
  it('renders without crashing', async () => {
    const { tree } = await renderDonut([
      { pct: 40, color: OrialColors.categoryHealth },
      { pct: 60, color: OrialColors.categoryMind },
    ]);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('renders one circle per segment plus the background track', async () => {
    const { segmentCircles } = await renderDonut([
      { pct: 25, color: OrialColors.categoryHealth },
      { pct: 75, color: OrialColors.categoryMind },
    ]);
    expect(segmentCircles).toHaveLength(2);
  });

  it('rotates the first segment to start at 12 oclock (-90deg, no accumulation)', async () => {
    const { segmentCircles } = await renderDonut([
      { pct: 25, color: OrialColors.categoryHealth },
      { pct: 75, color: OrialColors.categoryMind },
    ]);
    const [a, b, c, d] = segmentCircles[0].props.matrix;
    const [ea, eb, ec, ed] = rotationMatrix(START_ROTATION_DEG);
    expect(a).toBeCloseTo(ea, 10);
    expect(b).toBeCloseTo(eb, 10);
    expect(c).toBeCloseTo(ec, 10);
    expect(d).toBeCloseTo(ed, 10);
  });

  it('accumulates prior segment pct into each subsequent segment rotation', async () => {
    const segments = [
      { pct: 25, color: OrialColors.categoryHealth },
      { pct: 50, color: OrialColors.categoryMind },
      { pct: 25, color: OrialColors.categoryWork },
    ];
    const { segmentCircles } = await renderDonut(segments);

    // Segment 2 starts after 25pct accumulated: -90 + (25/100)*360 = 0deg (identity rotation).
    const [a2, b2, c2, d2] = segmentCircles[1].props.matrix;
    const [ea2, eb2, ec2, ed2] = rotationMatrix(START_ROTATION_DEG + (25 / 100) * FULL_TURN_DEG);
    expect(a2).toBeCloseTo(ea2, 10);
    expect(b2).toBeCloseTo(eb2, 10);
    expect(c2).toBeCloseTo(ec2, 10);
    expect(d2).toBeCloseTo(ed2, 10);

    // Segment 3 starts after 75pct accumulated: -90 + (75/100)*360 = 180deg.
    const [a3, b3, c3, d3] = segmentCircles[2].props.matrix;
    const [ea3, eb3, ec3, ed3] = rotationMatrix(START_ROTATION_DEG + (75 / 100) * FULL_TURN_DEG);
    expect(a3).toBeCloseTo(ea3, 10);
    expect(b3).toBeCloseTo(eb3, 10);
    expect(c3).toBeCloseTo(ec3, 10);
    expect(d3).toBeCloseTo(ed3, 10);
  });

  it('sizes each segment strokeDasharray proportionally to its pct', async () => {
    const size = 120;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const { segmentCircles } = await renderDonut([{ pct: 50, color: OrialColors.categoryHealth }], size, strokeWidth);
    const [segmentLength, remainder] = segmentCircles[0].props.strokeDasharray.map(Number);
    expect(segmentLength).toBeCloseTo(circumference * 0.5, 6);
    expect(remainder).toBeCloseTo(circumference * 0.5, 6);
  });
});
