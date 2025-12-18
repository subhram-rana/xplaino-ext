// src/constants/styles.ts

export const BORDER_RADIUS = {
  /** Cards, modals, panels, large containers */
  LARGE: '30px',

  /** Buttons, inputs, dropdowns */
  MEDIUM: '10px',

  /** Badges, tags, chips, small elements */
  SMALL: '6px',

  /** Circular elements (avatars, icons) */
  ROUND: '50%',

  /** No border radius */
  NONE: '0px',
} as const;

export type BorderRadiusKey = keyof typeof BORDER_RADIUS;

export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
  XXL: '48px',
} as const;

export const FONT_SIZE = {
  XS: '12px',
  SM: '14px',
  MD: '16px',
  LG: '18px',
  XL: '24px',
  XXL: '32px',
} as const;

export const FONT_WEIGHT = {
  NORMAL: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
} as const;

export const SHADOW = {
  SM: '0 1px 2px rgba(0, 0, 0, 0.05)',
  MD: '0 4px 6px rgba(0, 0, 0, 0.1)',
  LG: '0 10px 15px rgba(0, 0, 0, 0.1)',
  XL: '0 20px 25px rgba(0, 0, 0, 0.15)',
} as const;

export const TRANSITION = {
  FAST: '150ms ease',
  NORMAL: '250ms ease',
  SLOW: '350ms ease',
} as const;

export const FONT_FAMILY = {
  /** Primary font family - Inter with system font fallbacks */
  PRIMARY: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILY;

