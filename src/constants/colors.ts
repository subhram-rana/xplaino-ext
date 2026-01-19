// src/constants/colors.ts
// Colors synced from xplaino-web project

export const COLORS = {
  // ============================================
  // PRIMARY COLORS (Teal theme - #0d8070)
  // ============================================
  PRIMARY: '#0d8070',           // Main teal (rgb(13, 128, 112))
  PRIMARY_LIGHT: '#14a08a',     // Lighter teal (lighter variant)
  PRIMARY_LIGHT_ALT: '#1fb89a', // Alternative light teal
  PRIMARY_VERY_LIGHT: '#e0f2ef', // Very light teal tint
  PRIMARY_DARK: '#0a5f54',      // Darker teal
  PRIMARY_HOVER: '#14a08a',     // Hover state teal
  PRIMARY_HOVER_DARK: '#0a5f54', // Dark hover state
  PRIMARY_HOVER_ALT: '#0d8070',  // Alternative hover variant

  // ============================================
  // SECONDARY COLORS (Green theme - from xplaino-web)
  // ============================================
  SECONDARY: '#10B981',         // Main green
  SECONDARY_LIGHT: '#D1FAE5',   // Light green
  SECONDARY_MEDIUM: '#34D399', // Medium green
  SECONDARY_SUCCESS: '#4CAF50', // Success green
  SECONDARY_SUCCESS_DARK: '#45a049', // Dark success green
  SUCCESS_GREEN: '#00C800',     // Success green for text underlines (rgb(0, 200, 0))

  // ============================================
  // NEUTRAL COLORS
  // ============================================
  WHITE: '#FFFFFF',
  BLACK: '#000000',

  // Gray scale (standard)
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

  // Gray scale (alternative variants found in codebase)
  GRAY_200_ALT: '#e5e7eb',      // Alternative gray-200
  GRAY_300_ALT: '#d1d5db',      // Alternative gray-300
  GRAY_600_ALT: '#6b7280',      // Alternative gray-600
  GRAY_700_ALT: '#374151',      // Alternative gray-700
  GRAY_800_ALT: '#111827',      // Alternative gray-800 (very dark)
  GRAY_DARK: '#333',            // Dark gray (shorthand)
  GRAY_LIGHT: '#ccc',           // Light gray (shorthand)

  // ============================================
  // SEMANTIC COLORS (synced with xplaino-web)
  // ============================================
  SUCCESS: '#10B981',           // Main success green
  SUCCESS_LIGHT: '#D1FAE5',     // Light success green
  SUCCESS_MEDIUM: '#34D399',    // Medium success green

  ERROR: '#EF4444',             // Main error red
  ERROR_LIGHT: '#FEE2E2',       // Light error red
  ERROR_MEDIUM: '#F87171',      // Medium error red
  ERROR_DARK: '#DC2626',        // Dark error red
  ERROR_ALT: '#ff4444',         // Alternative error red
  ERROR_DARK_ALT: '#cc0000',    // Dark alternative error red

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
  BACKGROUND_GRAY_50: '#F9FAFB',
  BACKGROUND_GRAY_100: '#F3F4F6',
  BACKGROUND_GRAY_200: '#E5E7EB',
  BACKGROUND_GREEN_TINT_1: '#e0f2ef', // Teal-tinted background
  BACKGROUND_GREEN_TINT_2: '#c8e8e0', // Teal-tinted background variant
  BACKGROUND_GREEN_TINT_3: '#f0f9f7', // Teal-tinted background variant

  // ============================================
  // TEXT COLORS
  // ============================================
  TEXT_PRIMARY: '#1A202C',
  TEXT_SECONDARY: '#718096',
  TEXT_MUTED: '#A0AEC0',
  TEXT_INVERSE: '#FFFFFF',
  TEXT_LINK: '#4299E1',
  TEXT_DARK: '#333',            // Dark text (shorthand)
  TEXT_GRAY_700: '#374151',     // Gray-700 text
  TEXT_GRAY_800: '#111827',     // Gray-800 text

  // ============================================
  // BORDER COLORS
  // ============================================
  BORDER_DEFAULT: '#E2E8F0',
  BORDER_FOCUS: '#4299E1',
  BORDER_ERROR: '#F56565',
  BORDER_GRAY_200: '#e5e7eb',   // Gray-200 border
  BORDER_GRAY_300: '#d1d5db',   // Gray-300 border

  // ============================================
  // OVERLAY COLORS
  // ============================================
  OVERLAY: 'rgba(0, 0, 0, 0.5)',
  OVERLAY_LIGHT: 'rgba(0, 0, 0, 0.3)',
  OVERLAY_DARK: 'rgba(26, 32, 44, 0.9)', // Dark overlay with gray-900

  // ============================================
  // PRIMARY COLOR OPACITY VARIANTS (for shadows, backgrounds, borders)
  // ============================================
  PRIMARY_OPACITY_5: 'rgba(13, 128, 112, 0.05)',
  PRIMARY_OPACITY_8: 'rgba(13, 128, 112, 0.08)',
  PRIMARY_OPACITY_10: 'rgba(13, 128, 112, 0.1)',
  PRIMARY_OPACITY_15: 'rgba(13, 128, 112, 0.15)',
  PRIMARY_OPACITY_18: 'rgba(13, 128, 112, 0.18)',
  PRIMARY_OPACITY_20: 'rgba(13, 128, 112, 0.2)',
  PRIMARY_OPACITY_25: 'rgba(13, 128, 112, 0.25)',
  PRIMARY_OPACITY_30: 'rgba(13, 128, 112, 0.3)',
  PRIMARY_OPACITY_35: 'rgba(13, 128, 112, 0.35)',
  PRIMARY_OPACITY_40: 'rgba(13, 128, 112, 0.4)',
  PRIMARY_OPACITY_45: 'rgba(13, 128, 112, 0.45)',
  PRIMARY_OPACITY_50: 'rgba(13, 128, 112, 0.5)',
  PRIMARY_OPACITY_60: 'rgba(13, 128, 112, 0.6)',
  PRIMARY_OPACITY_70: 'rgba(13, 128, 112, 0.7)',
  PRIMARY_OPACITY_80: 'rgba(13, 128, 112, 0.8)',
  PRIMARY_OPACITY_90: 'rgba(13, 128, 112, 0.9)',

  // ============================================
  // SECONDARY/SUCCESS COLOR OPACITY VARIANTS
  // ============================================
  SUCCESS_OPACITY_15: 'rgba(0, 200, 0, 0.15)',
  SUCCESS_OPACITY_25: 'rgba(0, 200, 0, 0.25)',
  SUCCESS_OPACITY_30: 'rgba(144, 238, 144, 0.3)',
  SUCCESS_OPACITY_50: 'rgba(0, 200, 0, 0.5)',
  SUCCESS_OPACITY_80: 'rgba(0, 200, 0, 0.8)',

  // ============================================
  // ERROR COLOR OPACITY VARIANTS
  // ============================================
  ERROR_OPACITY_10: 'rgba(255, 68, 68, 0.1)',
  ERROR_OPACITY_10_ALT: 'rgba(239, 68, 68, 0.1)',
  ERROR_OPACITY_30: 'rgba(239, 68, 68, 0.3)',

  // ============================================
  // WHITE OPACITY VARIANTS
  // ============================================
  WHITE_OPACITY_10: 'rgba(255, 255, 255, 0.1)',
  WHITE_OPACITY_20: 'rgba(255, 255, 255, 0.2)',
  WHITE_OPACITY_30: 'rgba(255, 255, 255, 0.3)',
  WHITE_OPACITY_40: 'rgba(255, 255, 255, 0.4)',
  WHITE_OPACITY_50: 'rgba(255, 255, 255, 0.5)',
  WHITE_OPACITY_60: 'rgba(255, 255, 255, 0.6)',
  WHITE_OPACITY_70: 'rgba(255, 255, 255, 0.7)',
  WHITE_OPACITY_80: 'rgba(255, 255, 255, 0.8)',
  WHITE_OPACITY_85: 'rgba(255, 255, 255, 0.85)',
  WHITE_OPACITY_90: 'rgba(255, 255, 255, 0.9)',
  WHITE_OPACITY_95: 'rgba(255, 255, 255, 0.95)',
  WHITE_OPACITY_100: 'rgba(255, 255, 255, 1)',

  // ============================================
  // GRADIENT COLORS
  // ============================================
  GRADIENT_PINK: '#FF6B9D',     // Pink gradient color
  GRADIENT_YELLOW: '#FFC107',   // Yellow gradient color

  // ============================================
  // GRADIENT PINK OPACITY VARIANTS
  // ============================================
  GRADIENT_PINK_OPACITY_30: 'rgba(255, 107, 157, 0.3)',
  GRADIENT_PINK_OPACITY_40: 'rgba(255, 107, 157, 0.4)',
  GRADIENT_PINK_OPACITY_50: 'rgba(255, 107, 157, 0.5)',
  GRADIENT_PINK_OPACITY_60: 'rgba(255, 107, 157, 0.6)',

  // ============================================
  // GOOGLE COLORS
  // ============================================
  GOOGLE_TEXT: '#3c4043',       // Google text color
  GOOGLE_BG: '#f8f9fa',         // Google background color
  GOOGLE_BLUE: '#4285F4',       // Google blue (Sign in button)
  GOOGLE_GREEN: '#34A853',      // Google green (Sign in button)
  GOOGLE_YELLOW: '#FBBC05',     // Google yellow (Sign in button)
  GOOGLE_RED: '#EA4335',        // Google red (Sign in button)

  // ============================================
  // SHADOW COLORS
  // ============================================
  SHADOW_BLACK_10: 'rgba(0, 0, 0, 0.1)',
  SHADOW_BLACK_15: 'rgba(0, 0, 0, 0.15)',
  SHADOW_BLACK_20: 'rgba(0, 0, 0, 0.2)',
  SHADOW_BLACK_30: 'rgba(0, 0, 0, 0.3)',

  // ============================================
  // DARK THEME COLORS
  // ============================================
  DARK_BG_PRIMARY: '#1E1E1E',        // Card/primary background
  DARK_BG_SECONDARY: '#2A2A2A',      // Secondary background (slightly lighter for layering)
  DARK_BG_TERTIARY: '#252525',       // Tertiary background
  DARK_BG_HOVER: '#252525',          // Hover state background
  DARK_TEXT_PRIMARY: '#E6E6E6',      // Primary text color
  DARK_TEXT_SECONDARY: '#9FA6A4',    // Secondary text color
  DARK_TEXT_MUTED: '#6B7370',        // Muted text (between secondary and borders)
  DARK_TEXT_INVERSE: '#1E1E1E',      // Inverse text (for light backgrounds)
  DARK_BORDER_DEFAULT: '#243332',    // Default border color
  DARK_BORDER_FOCUS: '#14B8A6',      // Focus border (accent hover)
  DARK_ACCENT: '#0FA89A',            // Link/accent color
  DARK_ACCENT_HOVER: '#14B8A6',      // Accent hover state
  DARK_OVERLAY: 'rgba(30, 30, 30, 0.9)', // Dark overlay
} as const;

// Type for color keys
export type ColorKey = keyof typeof COLORS;

// Type for color values
export type ColorValue = (typeof COLORS)[ColorKey];

/**
 * Convert hex color to rgba with opacity
 * @param hex - Hex color (e.g., '#0d8070' or '0d8070')
 * @param opacity - Opacity value (0-1)
 * @returns rgba string
 */
export function rgba(hex: string, opacity: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = cleanHex.length === 6 
    ? parseInt(cleanHex.substring(4, 6), 16)
    : parseInt(cleanHex.substring(2, 3) + cleanHex.substring(2, 3), 16);
  
  // Handle 3-digit hex colors
  if (cleanHex.length === 3) {
    const r3 = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g3 = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b3 = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `rgba(${r3}, ${g3}, ${b3}, ${opacity})`;
  }
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Generate rgba from color constant with opacity
 * @param color - Color value from COLORS constant
 * @param opacity - Opacity value (0-1)
 * @returns rgba string
 */
export function colorWithOpacity(color: ColorValue, opacity: number): string {
  // If color is already rgba, extract RGB values
  if (color.startsWith('rgba(')) {
    const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }
  
  // If color is rgb, convert to rgba
  if (color.startsWith('rgb(')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }
  
  // Otherwise treat as hex
  return rgba(color, opacity);
}

