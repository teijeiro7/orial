import { TextStyle } from 'react-native';
import { OrialColors } from './colors';

export const OrialTypography = {
  displayLarge: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    fontWeight: '700' as const,
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    fontWeight: '700' as const,
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
  },
  headingLarge: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 24,
    fontWeight: '600' as const,
    color: OrialColors.textPrimary,
  },
  headingMedium: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    fontWeight: '600' as const,
    color: OrialColors.textPrimary,
  },
  headingSmall: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    fontWeight: '600' as const,
    color: OrialColors.textPrimary,
  },
  bodyLarge: {
    fontFamily: 'Inter-Regular',
    fontSize: 17,
    fontWeight: '400' as const,
    color: OrialColors.textSecondary,
  },
  bodyMedium: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    fontWeight: '400' as const,
    color: OrialColors.textSecondary,
  },
  bodySmall: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    fontWeight: '400' as const,
    color: OrialColors.textMuted,
  },
  caption: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    fontWeight: '500' as const,
    color: OrialColors.textMuted,
    letterSpacing: 0.5,
  },
  button: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    fontWeight: '600' as const,
    color: OrialColors.textPrimary,
  },
} as const;

export type TypographyStyle = keyof typeof OrialTypography;
