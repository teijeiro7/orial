import { TextStyle } from 'react-native';
import { OrialColors } from './colors';

export const OrialTypography = {
  displayLarge: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 48,
    fontWeight: '700' as const,
    color: OrialColors.textPrimary,
    letterSpacing: -1,
    lineHeight: 52,
  },
  displayMedium: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 36,
    fontWeight: '700' as const,
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  headingLarge: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 28,
    fontWeight: '700' as const,
    color: OrialColors.textPrimary,
    letterSpacing: 0.2,
  },
  headingMedium: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 22,
    fontWeight: '700' as const,
    color: OrialColors.textPrimary,
    letterSpacing: 0.2,
  },
  headingSmall: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 17,
    fontWeight: '600' as const,
    color: OrialColors.textPrimary,
  },
  bodyLarge: {
    fontFamily: 'Manrope-Regular',
    fontSize: 17,
    fontWeight: '400' as const,
    color: OrialColors.textSecondary,
  },
  bodyMedium: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    fontWeight: '400' as const,
    color: OrialColors.textSecondary,
  },
  bodySmall: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    fontWeight: '400' as const,
    color: OrialColors.textMuted,
  },
  caption: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    fontWeight: '500' as const,
    color: OrialColors.textMuted,
    letterSpacing: 1.5,
  },
  button: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    fontWeight: '600' as const,
    color: OrialColors.textPrimary,
  },
} as const;

export type TypographyStyle = keyof typeof OrialTypography;
