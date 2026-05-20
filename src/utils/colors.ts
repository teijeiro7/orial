export const OrialColors = {
  // Backgrounds
  deepNavy: '#080C18',
  darkBlue: '#0D1B2A',
  surface: '#111827',
  surfaceElevated: '#1C2539',

  // Borders
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.13)',

  // Glass (legacy — prefer flat cards)
  glassWhite: 'rgba(255, 255, 255, 0.15)',
  glassBorder: 'rgba(255, 255, 255, 0.20)',

  // Accents
  violet: '#7C3AED',
  violetLight: '#A78BFA',
  cyan: '#06B6D4',
  cyanLight: '#67E8F9',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#4B5563',

  // Category colors
  categoryHealth: '#10B981',
  categoryMind: '#8B5CF6',
  categoryWork: '#3B82F6',
  categorySocial: '#F59E0B',
  categoryFitness: '#EF4444',
  categoryLearn: '#06B6D4',
  categoryOther: '#6B7280',
} as const;

export type CategoryColor = typeof OrialColors[keyof typeof OrialColors];
