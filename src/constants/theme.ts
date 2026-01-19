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
  | 'text-disabled'
  | 'border-default'
  | 'border-subtle'
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
    'text-disabled': COLORS.GRAY_400,
    'border-default': COLORS.GRAY_300,
    'border-subtle': COLORS.GRAY_200,
    'border-focus': COLORS.PRIMARY,
    'border-error': COLORS.ERROR,
  },
  dark: {
    'bg-primary': COLORS.DARK_BG_PRIMARY,           // #121212
    'bg-secondary': COLORS.DARK_BG_SECONDARY,       // #1c1c1c
    'bg-tertiary': COLORS.DARK_BG_TERTIARY,         // #1c1c1c
    'bg-hover': COLORS.DARK_BG_HOVER,               // #252525
    'text-primary': COLORS.DARK_TEXT_PRIMARY,       // #e0e0e0
    'text-secondary': COLORS.DARK_TEXT_SECONDARY,   // #b0b0b0
    'text-muted': COLORS.DARK_TEXT_MUTED,           // #999999
    'text-inverse': COLORS.DARK_TEXT_INVERSE,       // #121212
    'text-disabled': COLORS.DARK_DISABLED,          // #666666
    'border-default': COLORS.DARK_BORDER_DEFAULT,   // #333333
    'border-subtle': COLORS.DARK_BORDER_SUBTLE,     // #444444
    'border-focus': COLORS.DARK_BORDER_FOCUS,       // #0fa38d
    'border-error': COLORS.DARK_ERROR,              // #ff6347
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


