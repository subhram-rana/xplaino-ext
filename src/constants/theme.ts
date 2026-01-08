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
 * Map backend theme enum ('LIGHT' | 'DARK') to frontend theme type ('light' | 'dark')
 */
function mapBackendThemeToFrontend(backendTheme: 'LIGHT' | 'DARK'): Theme {
  return backendTheme === 'LIGHT' ? 'light' : 'dark';
}

/**
 * Get the current theme based on extension domain overrides or account settings
 * Priority: extension domain theme > account theme > 'light' default
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
        
        // First, check extension settings for domain-specific override
        const extensionDomainTheme = await ChromeStorage.getUserExtensionDomainTheme(domain);
        console.log('[Theme] Extension domain theme from storage:', extensionDomainTheme);
        if (extensionDomainTheme) {
          const frontendTheme = mapBackendThemeToFrontend(extensionDomainTheme);
          console.log('[Theme] Applying extension domain theme:', frontendTheme, 'for domain:', domain);
          return frontendTheme;
        }
        console.log('[Theme] No extension domain theme found, falling back to account settings');
      } catch (error) {
        // If domain extraction fails, fall through to account theme
        console.warn('[Theme] Failed to extract domain, falling back to account theme:', error);
      }
    } else {
      console.log('[Theme] Not in browser context, skipping domain check');
    }
    
    // Fall back to account settings theme
    console.log('[Theme] Fetching account theme from storage...');
    const accountSettings = await ChromeStorage.getUserAccountSettings();
    console.log('[Theme] Account settings from storage:', accountSettings);
    if (accountSettings?.settings?.theme) {
      const frontendTheme = mapBackendThemeToFrontend(accountSettings.settings.theme);
      console.log('[Theme] Applying account theme:', frontendTheme);
      return frontendTheme;
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


