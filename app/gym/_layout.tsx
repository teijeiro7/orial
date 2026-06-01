import { Stack } from 'expo-router';
import { OrialColors } from '../../src/utils/colors';

export default function GymLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: OrialColors.deepNavy },
        animation: 'slide_from_right',
      }}
    />
  );
}