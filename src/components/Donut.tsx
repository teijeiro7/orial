import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { OrialColors } from '../utils/colors';

interface DonutSegment {
  pct: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

const DEFAULT_SIZE = 120;
const DEFAULT_STROKE_WIDTH = 20;
const START_ROTATION_DEG = -90;
const FULL_TURN_DEG = 360;

export function Donut({ segments, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE_WIDTH }: DonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePct = 0;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={OrialColors.surfaceElevated}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((segment, index) => {
          const clampedPct = Math.max(0, Math.min(100, segment.pct));
          const segmentLength = circumference * (clampedPct / 100);
          const rotation = START_ROTATION_DEG + (cumulativePct / 100) * FULL_TURN_DEG;
          cumulativePct += clampedPct;

          return (
            <Circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeLinecap="butt"
              rotation={rotation}
              origin={`${center}, ${center}`}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
