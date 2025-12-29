// src/constants/theme.ts
// Theme system for light/dark mode support
// Uses semantic color names that map to actual color values based on theme

import { COLORS } from './colors';
import { extractDomain } from '@/utils/domain';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';

export type Theme = 'light' | 'dark';

/**
 * Semantic color tokens that map to actual colors based on theme
 * This structure allows easy theme switching in the future
 */
export type ThemeColorToken =
  | 'bg-primary'
  | 'bg-secondary'
  | 'bg-tertiary'
  | 'bg-hover'
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'text-inverse'
  | 'border-default'
  | 'border-focus'
  | 'border-error';

/**
 * Theme configuration mapping semantic tokens to color values
 */
export const THEMES: Record<Theme, Record<ThemeColorToken, string>> = {
  light: {
    'bg-primary': COLORS.WHITE,
    'bg-secondary': COLORS.GRAY_50,
    'bg-tertiary': COLORS.GRAY_100,
    'bg-hover': COLORS.GRAY_100,
    'text-primary': COLORS.GRAY_900,
    'text-secondary': COLORS.GRAY_600,
    'text-muted': COLORS.GRAY_500,
    'text-inverse': COLORS.WHITE,
    'border-default': COLORS.GRAY_300,
    'border-focus': COLORS.PRIMARY,
    'border-error': COLORS.ERROR,
  },
  dark: {
    // Dark theme colors - to be implemented in the future
    'bg-primary': COLORS.GRAY_900,
    'bg-secondary': COLORS.GRAY_800,
    'bg-tertiary': COLORS.GRAY_700,
    'bg-hover': COLORS.GRAY_700,
    'text-primary': COLORS.WHITE,
    'text-secondary': COLORS.GRAY_400,
    'text-muted': COLORS.GRAY_500,
    'text-inverse': COLORS.GRAY_900,
    'border-default': COLORS.GRAY_600,
    'border-focus': COLORS.PRIMARY_LIGHT,
    'border-error': COLORS.ERROR_MEDIUM,
  },
} as const;

/**
 * Get the current theme based on domain-specific or global settings
 * Priority: domain-specific theme > global theme > 'light' default
 * @returns Promise resolving to the current theme
 */
export async function getCurrentTheme(): Promise<Theme> {
  console.log('[Theme] getCurrentTheme called');
  try {
    // Check if we're in a browser context with window.location
    if (typeof window !== 'undefined' && window.location) {
      try {
        const domain = extractDomain(window.location.href);
        console.log('[Theme] Extracted domain:', domain);
        
        // Try to get domain-specific theme first
        const domainTheme = await ChromeStorage.getUserSettingThemeOnSiteForDomain(domain);
        console.log('[Theme] Domain theme from storage:', domainTheme);
        if (domainTheme) {
          console.log('[Theme] Applying domain theme:', domainTheme, 'for domain:', domain);
          return domainTheme;
        }
        console.log('[Theme] No domain-specific theme found, falling back to global theme');
      } catch (error) {
        // If domain extraction fails, fall through to global theme
        console.warn('[Theme] Failed to extract domain, falling back to global theme:', error);
      }
    } else {
      console.log('[Theme] Not in browser context, skipping domain check');
    }
    
    // Fall back to global theme
    console.log('[Theme] Fetching global theme from storage...');
    const globalTheme = await ChromeStorage.getUserSettingGlobalTheme();
    console.log('[Theme] Global theme from storage:', globalTheme);
    if (globalTheme) {
      console.log('[Theme] Applying global theme:', globalTheme);
      return globalTheme;
    }
    
    // Default to 'light' if nothing is found
    console.log('[Theme] No theme found in storage, defaulting to light');
    return 'light';
  } catch (error) {
    // If storage read fails, default to 'light'
    console.warn('[Theme] Failed to read theme from storage, defaulting to light:', error);
    return 'light';
  }
}

/**
 * Get a semantic color value for the current theme
 * @param token - The semantic color token to retrieve
 * @param theme - Optional theme override. If not provided, will fetch current theme
 * @returns Promise resolving to the color value
 */
export async function getThemeColor(token: ThemeColorToken, theme?: Theme): Promise<string> {
  const activeTheme = theme || await getCurrentTheme();
  return THEMES[activeTheme][token];
}


