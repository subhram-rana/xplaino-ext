// src/constants/colors.css.ts
// CSS custom properties generated from color constants
// Use this for Shadow DOM and CSS variable injection

import { COLORS } from './colors';
import { FONT_FAMILY } from './styles';
import { getCurrentTheme, getThemeColor, THEMES } from './theme';

/**
 * Generate comprehensive CSS custom properties string from color constants
 * This is used to inject CSS variables into Shadow DOM
 * 
 * @param theme - Theme to use ('light' or 'dark'). If not provided, will fetch current theme
 * @param useHost - Whether to use :host selector (for Shadow DOM) or :root
 * @returns Promise resolving to CSS string with all color variables
 */
export async function getAllColorVariables(theme?: 'light' | 'dark', useHost: boolean = true): Promise<string> {
  // If theme is not provided, fetch the current theme
  const activeTheme = theme || await getCurrentTheme();
  const selector = useHost ? ':host' : ':root';
  
  // Get theme colors (use sync access when theme is explicit, async when fetching)
  const bgPrimary = theme ? THEMES[activeTheme]['bg-primary'] : await getThemeColor('bg-primary', activeTheme);
  const bgSecondary = theme ? THEMES[activeTheme]['bg-secondary'] : await getThemeColor('bg-secondary', activeTheme);
  const bgTertiary = theme ? THEMES[activeTheme]['bg-tertiary'] : await getThemeColor('bg-tertiary', activeTheme);
  const textPrimary = theme ? THEMES[activeTheme]['text-primary'] : await getThemeColor('text-primary', activeTheme);
  const textSecondary = theme ? THEMES[activeTheme]['text-secondary'] : await getThemeColor('text-secondary', activeTheme);
  const textMuted = theme ? THEMES[activeTheme]['text-muted'] : await getThemeColor('text-muted', activeTheme);
  const borderDefault = theme ? THEMES[activeTheme]['border-default'] : await getThemeColor('border-default', activeTheme);
  
  return `
    ${selector} {
      /* ============================================
         PRIMARY COLORS
         ============================================ */
      --color-primary: ${COLORS.PRIMARY} !important;
      --color-primary-light: ${COLORS.PRIMARY_LIGHT} !important;
      --color-primary-light-alt: ${COLORS.PRIMARY_LIGHT_ALT} !important;
      --color-primary-very-light: ${COLORS.PRIMARY_VERY_LIGHT} !important;
      --color-primary-dark: ${COLORS.PRIMARY_DARK} !important;
      --color-primary-hover: ${COLORS.PRIMARY_HOVER} !important;
      --color-primary-hover-dark: ${COLORS.PRIMARY_HOVER_DARK} !important;
      --color-primary-hover-alt: ${COLORS.PRIMARY_HOVER_ALT} !important;
      
      /* ============================================
         SECONDARY COLORS
         ============================================ */
      --color-secondary: ${COLORS.SECONDARY} !important;
      --color-secondary-light: ${COLORS.SECONDARY_LIGHT} !important;
      --color-secondary-medium: ${COLORS.SECONDARY_MEDIUM} !important;
      --color-secondary-success: ${COLORS.SECONDARY_SUCCESS} !important;
      --color-secondary-success-dark: ${COLORS.SECONDARY_SUCCESS_DARK} !important;
      --color-success-green: ${COLORS.SUCCESS_GREEN} !important;
      
      /* ============================================
         NEUTRAL COLORS
         ============================================ */
      --color-white: ${COLORS.WHITE} !important;
      --color-black: ${COLORS.BLACK} !important;
      
      /* ============================================
         GRAY SCALE
         ============================================ */
      --color-gray-50: ${COLORS.GRAY_50} !important;
      --color-gray-100: ${COLORS.GRAY_100} !important;
      --color-gray-200: ${COLORS.GRAY_200} !important;
      --color-gray-300: ${COLORS.GRAY_300} !important;
      --color-gray-400: ${COLORS.GRAY_400} !important;
      --color-gray-500: ${COLORS.GRAY_500} !important;
      --color-gray-600: ${COLORS.GRAY_600} !important;
      --color-gray-700: ${COLORS.GRAY_700} !important;
      --color-gray-800: ${COLORS.GRAY_800} !important;
      --color-gray-900: ${COLORS.GRAY_900} !important;
      
      /* Gray scale alternative variants */
      --color-gray-200-alt: ${COLORS.GRAY_200_ALT} !important;
      --color-gray-300-alt: ${COLORS.GRAY_300_ALT} !important;
      --color-gray-600-alt: ${COLORS.GRAY_600_ALT} !important;
      --color-gray-700-alt: ${COLORS.GRAY_700_ALT} !important;
      --color-gray-800-alt: ${COLORS.GRAY_800_ALT} !important;
      --color-gray-dark: ${COLORS.GRAY_DARK} !important;
      --color-gray-light: ${COLORS.GRAY_LIGHT} !important;
      
      /* ============================================
         SEMANTIC COLORS
         ============================================ */
      --color-success: ${COLORS.SUCCESS} !important;
      --color-success-light: ${COLORS.SUCCESS_LIGHT} !important;
      --color-success-medium: ${COLORS.SUCCESS_MEDIUM} !important;
      --color-success-green: ${COLORS.SUCCESS_GREEN} !important;
      
      --color-error: ${COLORS.ERROR} !important;
      --color-error-light: ${COLORS.ERROR_LIGHT} !important;
      --color-error-medium: ${COLORS.ERROR_MEDIUM} !important;
      --color-error-dark: ${COLORS.ERROR_DARK} !important;
      --color-error-alt: ${COLORS.ERROR_ALT} !important;
      --color-error-dark-alt: ${COLORS.ERROR_DARK_ALT} !important;
      
      --color-warning: ${COLORS.WARNING} !important;
      --color-warning-light: ${COLORS.WARNING_LIGHT} !important;
      --color-warning-dark: ${COLORS.WARNING_DARK} !important;
      
      --color-info: ${COLORS.INFO} !important;
      --color-info-light: ${COLORS.INFO_LIGHT} !important;
      --color-info-dark: ${COLORS.INFO_DARK} !important;
      
      /* ============================================
         BACKGROUND COLORS
         ============================================ */
      --color-bg-primary: ${COLORS.BACKGROUND_PRIMARY} !important;
      --color-bg-secondary: ${COLORS.BACKGROUND_SECONDARY} !important;
      --color-bg-tertiary: ${COLORS.BACKGROUND_TERTIARY} !important;
      --color-bg-dark: ${COLORS.BACKGROUND_DARK} !important;
      --color-bg-gray-50: ${COLORS.BACKGROUND_GRAY_50} !important;
      --color-bg-gray-100: ${COLORS.BACKGROUND_GRAY_100} !important;
      --color-bg-gray-200: ${COLORS.BACKGROUND_GRAY_200} !important;
      --color-bg-green-tint-1: ${COLORS.BACKGROUND_GREEN_TINT_1} !important;
      --color-bg-green-tint-2: ${COLORS.BACKGROUND_GREEN_TINT_2} !important;
      --color-bg-green-tint-3: ${COLORS.BACKGROUND_GREEN_TINT_3} !important;
      
      /* ============================================
         TEXT COLORS
         ============================================ */
      --color-text-primary: ${COLORS.TEXT_PRIMARY} !important;
      --color-text-secondary: ${COLORS.TEXT_SECONDARY} !important;
      --color-text-muted: ${COLORS.TEXT_MUTED} !important;
      --color-text-inverse: ${COLORS.TEXT_INVERSE} !important;
      --color-text-link: ${COLORS.TEXT_LINK} !important;
      --color-text-dark: ${COLORS.TEXT_DARK} !important;
      --color-text-gray-700: ${COLORS.TEXT_GRAY_700} !important;
      --color-text-gray-800: ${COLORS.TEXT_GRAY_800} !important;
      
      /* ============================================
         BORDER COLORS
         ============================================ */
      --color-border-default: ${COLORS.BORDER_DEFAULT} !important;
      --color-border-focus: ${COLORS.BORDER_FOCUS} !important;
      --color-border-error: ${COLORS.BORDER_ERROR} !important;
      --color-border-gray-200: ${COLORS.BORDER_GRAY_200} !important;
      --color-border-gray-300: ${COLORS.BORDER_GRAY_300} !important;
      
      /* ============================================
         OVERLAY COLORS
         ============================================ */
      --color-overlay: ${COLORS.OVERLAY} !important;
      --color-overlay-light: ${COLORS.OVERLAY_LIGHT} !important;
      --color-overlay-dark: ${COLORS.OVERLAY_DARK} !important;
      
      /* ============================================
         PRIMARY COLOR OPACITY VARIANTS
         ============================================ */
      --color-primary-opacity-5: ${COLORS.PRIMARY_OPACITY_5} !important;
      --color-primary-opacity-8: ${COLORS.PRIMARY_OPACITY_8} !important;
      --color-primary-opacity-10: ${COLORS.PRIMARY_OPACITY_10} !important;
      --color-primary-opacity-15: ${COLORS.PRIMARY_OPACITY_15} !important;
      --color-primary-opacity-18: ${COLORS.PRIMARY_OPACITY_18} !important;
      --color-primary-opacity-20: ${COLORS.PRIMARY_OPACITY_20} !important;
      --color-primary-opacity-25: ${COLORS.PRIMARY_OPACITY_25} !important;
      --color-primary-opacity-30: ${COLORS.PRIMARY_OPACITY_30} !important;
      --color-primary-opacity-35: ${COLORS.PRIMARY_OPACITY_35} !important;
      --color-primary-opacity-40: ${COLORS.PRIMARY_OPACITY_40} !important;
      --color-primary-opacity-45: ${COLORS.PRIMARY_OPACITY_45} !important;
      --color-primary-opacity-50: ${COLORS.PRIMARY_OPACITY_50} !important;
      --color-primary-opacity-60: ${COLORS.PRIMARY_OPACITY_60} !important;
      --color-primary-opacity-70: ${COLORS.PRIMARY_OPACITY_70} !important;
      --color-primary-opacity-80: ${COLORS.PRIMARY_OPACITY_80} !important;
      --color-primary-opacity-90: ${COLORS.PRIMARY_OPACITY_90} !important;
      
      /* ============================================
         SUCCESS COLOR OPACITY VARIANTS
         ============================================ */
      --color-success-opacity-15: ${COLORS.SUCCESS_OPACITY_15} !important;
      --color-success-opacity-25: ${COLORS.SUCCESS_OPACITY_25} !important;
      --color-success-opacity-30: ${COLORS.SUCCESS_OPACITY_30} !important;
      --color-success-opacity-50: ${COLORS.SUCCESS_OPACITY_50} !important;
      --color-success-opacity-80: ${COLORS.SUCCESS_OPACITY_80} !important;
      
      /* ============================================
         ERROR COLOR OPACITY VARIANTS
         ============================================ */
      --color-error-opacity-10: ${COLORS.ERROR_OPACITY_10} !important;
      --color-error-opacity-10-alt: ${COLORS.ERROR_OPACITY_10_ALT} !important;
      --color-error-opacity-30: ${COLORS.ERROR_OPACITY_30} !important;
      
      /* ============================================
         WHITE OPACITY VARIANTS
         ============================================ */
      --color-white-opacity-10: ${COLORS.WHITE_OPACITY_10} !important;
      --color-white-opacity-20: ${COLORS.WHITE_OPACITY_20} !important;
      --color-white-opacity-30: ${COLORS.WHITE_OPACITY_30} !important;
      --color-white-opacity-40: ${COLORS.WHITE_OPACITY_40} !important;
      --color-white-opacity-50: ${COLORS.WHITE_OPACITY_50} !important;
      --color-white-opacity-60: ${COLORS.WHITE_OPACITY_60} !important;
      --color-white-opacity-70: ${COLORS.WHITE_OPACITY_70} !important;
      --color-white-opacity-80: ${COLORS.WHITE_OPACITY_80} !important;
      --color-white-opacity-85: ${COLORS.WHITE_OPACITY_85} !important;
      --color-white-opacity-90: ${COLORS.WHITE_OPACITY_90} !important;
      --color-white-opacity-95: ${COLORS.WHITE_OPACITY_95} !important;
      --color-white-opacity-100: ${COLORS.WHITE_OPACITY_100} !important;
      
      /* ============================================
         GRADIENT COLORS
         ============================================ */
      --color-gradient-pink: ${COLORS.GRADIENT_PINK} !important;
      --color-gradient-yellow: ${COLORS.GRADIENT_YELLOW} !important;
      
      /* ============================================
         GRADIENT PINK OPACITY VARIANTS
         ============================================ */
      --color-gradient-pink-opacity-30: ${COLORS.GRADIENT_PINK_OPACITY_30} !important;
      --color-gradient-pink-opacity-40: ${COLORS.GRADIENT_PINK_OPACITY_40} !important;
      --color-gradient-pink-opacity-50: ${COLORS.GRADIENT_PINK_OPACITY_50} !important;
      --color-gradient-pink-opacity-60: ${COLORS.GRADIENT_PINK_OPACITY_60} !important;
      
      /* ============================================
         GOOGLE COLORS
         ============================================ */
      --color-google-text: ${COLORS.GOOGLE_TEXT} !important;
      --color-google-bg: ${COLORS.GOOGLE_BG} !important;
      --color-google-blue: ${COLORS.GOOGLE_BLUE} !important;
      --color-google-green: ${COLORS.GOOGLE_GREEN} !important;
      --color-google-yellow: ${COLORS.GOOGLE_YELLOW} !important;
      --color-google-red: ${COLORS.GOOGLE_RED} !important;
      
      /* ============================================
         SHADOW COLORS
         ============================================ */
      --color-shadow-black-10: ${COLORS.SHADOW_BLACK_10} !important;
      --color-shadow-black-15: ${COLORS.SHADOW_BLACK_15} !important;
      --color-shadow-black-20: ${COLORS.SHADOW_BLACK_20} !important;
      --color-shadow-black-30: ${COLORS.SHADOW_BLACK_30} !important;
      
      /* ============================================
         THEME-AWARE SEMANTIC COLORS
         ============================================ */
      --color-bg-primary-theme: ${bgPrimary} !important;
      --color-bg-secondary-theme: ${bgSecondary} !important;
      --color-bg-tertiary-theme: ${bgTertiary} !important;
      --color-text-primary-theme: ${textPrimary} !important;
      --color-text-secondary-theme: ${textSecondary} !important;
      --color-text-muted-theme: ${textMuted} !important;
      --color-border-default-theme: ${borderDefault} !important;
      
      /* ============================================
         FONT FAMILY
         ============================================ */
      --font-family-primary: ${FONT_FAMILY.PRIMARY} !important;
    }
  `;
}

/**
 * Synchronous version of getAllColorVariables for when theme is explicitly provided
 * This is used for module-level constants that need to be synchronous
 */
function getAllColorVariablesSync(theme: 'light' | 'dark', useHost: boolean = true): string {
  const selector = useHost ? ':host' : ':root';
  const activeTheme = theme;
  
  return `
    ${selector} {
      /* ============================================
         PRIMARY COLORS
         ============================================ */
      --color-primary: ${COLORS.PRIMARY} !important;
      --color-primary-light: ${COLORS.PRIMARY_LIGHT} !important;
      --color-primary-light-alt: ${COLORS.PRIMARY_LIGHT_ALT} !important;
      --color-primary-very-light: ${COLORS.PRIMARY_VERY_LIGHT} !important;
      --color-primary-dark: ${COLORS.PRIMARY_DARK} !important;
      --color-primary-hover: ${COLORS.PRIMARY_HOVER} !important;
      --color-primary-hover-dark: ${COLORS.PRIMARY_HOVER_DARK} !important;
      --color-primary-hover-alt: ${COLORS.PRIMARY_HOVER_ALT} !important;
      
      /* ============================================
         SECONDARY COLORS
         ============================================ */
      --color-secondary: ${COLORS.SECONDARY} !important;
      --color-secondary-light: ${COLORS.SECONDARY_LIGHT} !important;
      --color-secondary-medium: ${COLORS.SECONDARY_MEDIUM} !important;
      --color-secondary-success: ${COLORS.SECONDARY_SUCCESS} !important;
      --color-secondary-success-dark: ${COLORS.SECONDARY_SUCCESS_DARK} !important;
      --color-success-green: ${COLORS.SUCCESS_GREEN} !important;
      
      /* ============================================
         NEUTRAL COLORS
         ============================================ */
      --color-white: ${COLORS.WHITE} !important;
      --color-black: ${COLORS.BLACK} !important;
      
      /* ============================================
         GRAY SCALE
         ============================================ */
      --color-gray-50: ${COLORS.GRAY_50} !important;
      --color-gray-100: ${COLORS.GRAY_100} !important;
      --color-gray-200: ${COLORS.GRAY_200} !important;
      --color-gray-300: ${COLORS.GRAY_300} !important;
      --color-gray-400: ${COLORS.GRAY_400} !important;
      --color-gray-500: ${COLORS.GRAY_500} !important;
      --color-gray-600: ${COLORS.GRAY_600} !important;
      --color-gray-700: ${COLORS.GRAY_700} !important;
      --color-gray-800: ${COLORS.GRAY_800} !important;
      --color-gray-900: ${COLORS.GRAY_900} !important;
      
      /* Gray scale alternative variants */
      --color-gray-200-alt: ${COLORS.GRAY_200_ALT} !important;
      --color-gray-300-alt: ${COLORS.GRAY_300_ALT} !important;
      --color-gray-600-alt: ${COLORS.GRAY_600_ALT} !important;
      --color-gray-700-alt: ${COLORS.GRAY_700_ALT} !important;
      --color-gray-800-alt: ${COLORS.GRAY_800_ALT} !important;
      --color-gray-dark: ${COLORS.GRAY_DARK} !important;
      --color-gray-light: ${COLORS.GRAY_LIGHT} !important;
      
      /* ============================================
         SEMANTIC COLORS
         ============================================ */
      --color-success: ${COLORS.SUCCESS} !important;
      --color-success-light: ${COLORS.SUCCESS_LIGHT} !important;
      --color-success-medium: ${COLORS.SUCCESS_MEDIUM} !important;
      --color-success-green: ${COLORS.SUCCESS_GREEN} !important;
      
      --color-error: ${COLORS.ERROR} !important;
      --color-error-light: ${COLORS.ERROR_LIGHT} !important;
      --color-error-medium: ${COLORS.ERROR_MEDIUM} !important;
      --color-error-dark: ${COLORS.ERROR_DARK} !important;
      --color-error-alt: ${COLORS.ERROR_ALT} !important;
      --color-error-dark-alt: ${COLORS.ERROR_DARK_ALT} !important;
      
      --color-warning: ${COLORS.WARNING} !important;
      --color-warning-light: ${COLORS.WARNING_LIGHT} !important;
      --color-warning-dark: ${COLORS.WARNING_DARK} !important;
      
      --color-info: ${COLORS.INFO} !important;
      --color-info-light: ${COLORS.INFO_LIGHT} !important;
      --color-info-dark: ${COLORS.INFO_DARK} !important;
      
      /* ============================================
         BACKGROUND COLORS
         ============================================ */
      --color-bg-primary: ${COLORS.BACKGROUND_PRIMARY} !important;
      --color-bg-secondary: ${COLORS.BACKGROUND_SECONDARY} !important;
      --color-bg-tertiary: ${COLORS.BACKGROUND_TERTIARY} !important;
      --color-bg-dark: ${COLORS.BACKGROUND_DARK} !important;
      --color-bg-gray-50: ${COLORS.BACKGROUND_GRAY_50} !important;
      --color-bg-gray-100: ${COLORS.BACKGROUND_GRAY_100} !important;
      --color-bg-gray-200: ${COLORS.BACKGROUND_GRAY_200} !important;
      --color-bg-green-tint-1: ${COLORS.BACKGROUND_GREEN_TINT_1} !important;
      --color-bg-green-tint-2: ${COLORS.BACKGROUND_GREEN_TINT_2} !important;
      --color-bg-green-tint-3: ${COLORS.BACKGROUND_GREEN_TINT_3} !important;
      
      /* ============================================
         TEXT COLORS
         ============================================ */
      --color-text-primary: ${COLORS.TEXT_PRIMARY} !important;
      --color-text-secondary: ${COLORS.TEXT_SECONDARY} !important;
      --color-text-muted: ${COLORS.TEXT_MUTED} !important;
      --color-text-inverse: ${COLORS.TEXT_INVERSE} !important;
      --color-text-link: ${COLORS.TEXT_LINK} !important;
      --color-text-dark: ${COLORS.TEXT_DARK} !important;
      --color-text-gray-700: ${COLORS.TEXT_GRAY_700} !important;
      --color-text-gray-800: ${COLORS.TEXT_GRAY_800} !important;
      
      /* ============================================
         BORDER COLORS
         ============================================ */
      --color-border-default: ${COLORS.BORDER_DEFAULT} !important;
      --color-border-focus: ${COLORS.BORDER_FOCUS} !important;
      --color-border-error: ${COLORS.BORDER_ERROR} !important;
      --color-border-gray-200: ${COLORS.BORDER_GRAY_200} !important;
      --color-border-gray-300: ${COLORS.BORDER_GRAY_300} !important;
      
      /* ============================================
         OVERLAY COLORS
         ============================================ */
      --color-overlay: ${COLORS.OVERLAY} !important;
      --color-overlay-light: ${COLORS.OVERLAY_LIGHT} !important;
      --color-overlay-dark: ${COLORS.OVERLAY_DARK} !important;
      
      /* ============================================
         PRIMARY COLOR OPACITY VARIANTS
         ============================================ */
      --color-primary-opacity-5: ${COLORS.PRIMARY_OPACITY_5} !important;
      --color-primary-opacity-8: ${COLORS.PRIMARY_OPACITY_8} !important;
      --color-primary-opacity-10: ${COLORS.PRIMARY_OPACITY_10} !important;
      --color-primary-opacity-15: ${COLORS.PRIMARY_OPACITY_15} !important;
      --color-primary-opacity-18: ${COLORS.PRIMARY_OPACITY_18} !important;
      --color-primary-opacity-20: ${COLORS.PRIMARY_OPACITY_20} !important;
      --color-primary-opacity-25: ${COLORS.PRIMARY_OPACITY_25} !important;
      --color-primary-opacity-30: ${COLORS.PRIMARY_OPACITY_30} !important;
      --color-primary-opacity-35: ${COLORS.PRIMARY_OPACITY_35} !important;
      --color-primary-opacity-40: ${COLORS.PRIMARY_OPACITY_40} !important;
      --color-primary-opacity-45: ${COLORS.PRIMARY_OPACITY_45} !important;
      --color-primary-opacity-50: ${COLORS.PRIMARY_OPACITY_50} !important;
      --color-primary-opacity-60: ${COLORS.PRIMARY_OPACITY_60} !important;
      --color-primary-opacity-70: ${COLORS.PRIMARY_OPACITY_70} !important;
      --color-primary-opacity-80: ${COLORS.PRIMARY_OPACITY_80} !important;
      --color-primary-opacity-90: ${COLORS.PRIMARY_OPACITY_90} !important;
      
      /* ============================================
         SUCCESS COLOR OPACITY VARIANTS
         ============================================ */
      --color-success-opacity-15: ${COLORS.SUCCESS_OPACITY_15} !important;
      --color-success-opacity-25: ${COLORS.SUCCESS_OPACITY_25} !important;
      --color-success-opacity-30: ${COLORS.SUCCESS_OPACITY_30} !important;
      --color-success-opacity-50: ${COLORS.SUCCESS_OPACITY_50} !important;
      --color-success-opacity-80: ${COLORS.SUCCESS_OPACITY_80} !important;
      
      /* ============================================
         ERROR COLOR OPACITY VARIANTS
         ============================================ */
      --color-error-opacity-10: ${COLORS.ERROR_OPACITY_10} !important;
      --color-error-opacity-10-alt: ${COLORS.ERROR_OPACITY_10_ALT} !important;
      --color-error-opacity-30: ${COLORS.ERROR_OPACITY_30} !important;
      
      /* ============================================
         WHITE OPACITY VARIANTS
         ============================================ */
      --color-white-opacity-10: ${COLORS.WHITE_OPACITY_10} !important;
      --color-white-opacity-20: ${COLORS.WHITE_OPACITY_20} !important;
      --color-white-opacity-30: ${COLORS.WHITE_OPACITY_30} !important;
      --color-white-opacity-40: ${COLORS.WHITE_OPACITY_40} !important;
      --color-white-opacity-50: ${COLORS.WHITE_OPACITY_50} !important;
      --color-white-opacity-60: ${COLORS.WHITE_OPACITY_60} !important;
      --color-white-opacity-70: ${COLORS.WHITE_OPACITY_70} !important;
      --color-white-opacity-80: ${COLORS.WHITE_OPACITY_80} !important;
      --color-white-opacity-85: ${COLORS.WHITE_OPACITY_85} !important;
      --color-white-opacity-90: ${COLORS.WHITE_OPACITY_90} !important;
      --color-white-opacity-95: ${COLORS.WHITE_OPACITY_95} !important;
      --color-white-opacity-100: ${COLORS.WHITE_OPACITY_100} !important;
      
      /* ============================================
         GRADIENT COLORS
         ============================================ */
      --color-gradient-pink: ${COLORS.GRADIENT_PINK} !important;
      --color-gradient-yellow: ${COLORS.GRADIENT_YELLOW} !important;
      
      /* ============================================
         GRADIENT PINK OPACITY VARIANTS
         ============================================ */
      --color-gradient-pink-opacity-30: ${COLORS.GRADIENT_PINK_OPACITY_30} !important;
      --color-gradient-pink-opacity-40: ${COLORS.GRADIENT_PINK_OPACITY_40} !important;
      --color-gradient-pink-opacity-50: ${COLORS.GRADIENT_PINK_OPACITY_50} !important;
      --color-gradient-pink-opacity-60: ${COLORS.GRADIENT_PINK_OPACITY_60} !important;
      
      /* ============================================
         GOOGLE COLORS
         ============================================ */
      --color-google-text: ${COLORS.GOOGLE_TEXT} !important;
      --color-google-bg: ${COLORS.GOOGLE_BG} !important;
      --color-google-blue: ${COLORS.GOOGLE_BLUE} !important;
      --color-google-green: ${COLORS.GOOGLE_GREEN} !important;
      --color-google-yellow: ${COLORS.GOOGLE_YELLOW} !important;
      --color-google-red: ${COLORS.GOOGLE_RED} !important;
      
      /* ============================================
         SHADOW COLORS
         ============================================ */
      --color-shadow-black-10: ${COLORS.SHADOW_BLACK_10} !important;
      --color-shadow-black-15: ${COLORS.SHADOW_BLACK_15} !important;
      --color-shadow-black-20: ${COLORS.SHADOW_BLACK_20} !important;
      --color-shadow-black-30: ${COLORS.SHADOW_BLACK_30} !important;
      
      /* ============================================
         THEME-AWARE SEMANTIC COLORS
         ============================================ */
      --color-bg-primary-theme: ${THEMES[activeTheme]['bg-primary']} !important;
      --color-bg-secondary-theme: ${THEMES[activeTheme]['bg-secondary']} !important;
      --color-bg-tertiary-theme: ${THEMES[activeTheme]['bg-tertiary']} !important;
      --color-text-primary-theme: ${THEMES[activeTheme]['text-primary']} !important;
      --color-text-secondary-theme: ${THEMES[activeTheme]['text-secondary']} !important;
      --color-text-muted-theme: ${THEMES[activeTheme]['text-muted']} !important;
      --color-border-default-theme: ${THEMES[activeTheme]['border-default']} !important;
      
      /* ============================================
         FONT FAMILY
         ============================================ */
      --font-family-primary: ${FONT_FAMILY.PRIMARY} !important;
    }
  `;
}

/**
 * Generate CSS custom properties string from color constants (legacy function)
 * @deprecated Use getAllColorVariables() instead
 */
export function getColorCSSVariables(): string {
  return getAllColorVariablesSync('light', false);
}

/**
 * Minimal set of CSS variables for FAB components (legacy)
 * @deprecated Use getAllColorVariables() instead
 */
export const FAB_COLOR_VARIABLES = getAllColorVariablesSync('light', true);

/**
 * Light theme CSS variables
 */
export const LIGHT_THEME_VARIABLES = getAllColorVariablesSync('light', true);

/**
 * Dark theme CSS variables
 */
export const DARK_THEME_VARIABLES = getAllColorVariablesSync('dark', true);

/**
 * All color variables (defaults to light theme)
 * This is the main export to use for Shadow DOM injection
 */
export const ALL_COLOR_VARIABLES = getAllColorVariablesSync('light', true);
