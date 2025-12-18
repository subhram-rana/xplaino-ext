// src/constants/colors.ts
// Colors synced from xplaino-web project

export const COLORS = {
  // ============================================
  // PRIMARY COLORS (Purple theme - from xplaino-web)
  // ============================================
  PRIMARY: '#9527F5',           // --purple
  PRIMARY_LIGHT: '#BF7EFA',     // --medium-purple
  PRIMARY_VERY_LIGHT: '#eaddf8', // --very-light-purple
  PRIMARY_DARK: '#8607f5',      // --darker-purple
  PRIMARY_HOVER: '#BF7EFA',     // --medium-purple

  // ============================================
  // SECONDARY COLORS (Green theme - from xplaino-web)
  // ============================================
  SECONDARY: '#10B981',         // --green
  SECONDARY_LIGHT: '#D1FAE5',   // --light-green
  SECONDARY_MEDIUM: '#34D399',  // --medium-green

  // ============================================
  // NEUTRAL COLORS
  // ============================================
  WHITE: '#FFFFFF',
  BLACK: '#000000',

  // Gray scale
  GRAY_50: '#F9FAFB',
  GRAY_100: '#F7FAFC',
  GRAY_200: '#EDF2F7',
  GRAY_300: '#E2E8F0',
  GRAY_400: '#CBD5E0',
  GRAY_500: '#A0AEC0',
  GRAY_600: '#718096',
  GRAY_700: '#4A5568',
  GRAY_800: '#2D3748',
  GRAY_900: '#1A202C',

  // ============================================
  // SEMANTIC COLORS (synced with xplaino-web)
  // ============================================
  SUCCESS: '#10B981',           // --green
  SUCCESS_LIGHT: '#D1FAE5',     // --light-green
  SUCCESS_MEDIUM: '#34D399',    // --medium-green

  ERROR: '#EF4444',             // --red
  ERROR_LIGHT: '#FEE2E2',       // --light-red
  ERROR_MEDIUM: '#F87171',      // --medium-red

  WARNING: '#ED8936',
  WARNING_LIGHT: '#FBD38D',
  WARNING_DARK: '#C05621',

  INFO: '#4299E1',
  INFO_LIGHT: '#90CDF4',
  INFO_DARK: '#2B6CB0',

  // ============================================
  // BACKGROUND COLORS
  // ============================================
  BACKGROUND_PRIMARY: '#FFFFFF',
  BACKGROUND_SECONDARY: '#F7FAFC',
  BACKGROUND_TERTIARY: '#EDF2F7',
  BACKGROUND_DARK: '#1A202C',

  // ============================================
  // TEXT COLORS
  // ============================================
  TEXT_PRIMARY: '#1A202C',
  TEXT_SECONDARY: '#718096',
  TEXT_MUTED: '#A0AEC0',
  TEXT_INVERSE: '#FFFFFF',
  TEXT_LINK: '#4299E1',

  // ============================================
  // BORDER COLORS
  // ============================================
  BORDER_DEFAULT: '#E2E8F0',
  BORDER_FOCUS: '#4299E1',
  BORDER_ERROR: '#F56565',

  // ============================================
  // OVERLAY COLORS
  // ============================================
  OVERLAY: 'rgba(0, 0, 0, 0.5)',
  OVERLAY_LIGHT: 'rgba(0, 0, 0, 0.3)',
} as const;

// Type for color keys
export type ColorKey = keyof typeof COLORS;

// Type for color values
export type ColorValue = (typeof COLORS)[ColorKey];

