// src/constants/colors.css.ts
// CSS custom properties generated from color constants
// Use this for Shadow DOM and CSS variable injection

import { COLORS } from './colors';
import { FONT_FAMILY } from './styles';

/**
 * Generate CSS custom properties string from color constants
 * This is used to inject CSS variables into Shadow DOM
 */
export function getColorCSSVariables(): string {
  return `
    :root {
      /* Primary Colors */
      --color-primary: ${COLORS.PRIMARY};
      --color-primary-light: ${COLORS.PRIMARY_LIGHT};
      --color-primary-very-light: ${COLORS.PRIMARY_VERY_LIGHT};
      --color-primary-dark: ${COLORS.PRIMARY_DARK};
      --color-primary-hover: ${COLORS.PRIMARY_HOVER};
      
      /* Neutral Colors */
      --color-white: ${COLORS.WHITE};
      --color-black: ${COLORS.BLACK};
      
      /* Gray Scale */
      --color-gray-600: ${COLORS.GRAY_600};
      
      /* Text Colors */
      --color-text-primary: ${COLORS.TEXT_PRIMARY};
      --color-text-secondary: ${COLORS.TEXT_SECONDARY};
      
      /* Font Family */
      --font-family-primary: ${FONT_FAMILY.PRIMARY};
    }
  `;
}

/**
 * Minimal set of CSS variables for FAB components
 * Only includes colors actually used in FAB/SidePanel
 * Uses :host for Shadow DOM compatibility
 */
export const FAB_COLOR_VARIABLES = `
  :host {
    --color-primary: ${COLORS.PRIMARY} !important;
    --color-primary-light: ${COLORS.PRIMARY_LIGHT} !important;
    --color-primary-very-light: ${COLORS.PRIMARY_VERY_LIGHT} !important;
    --color-primary-dark: ${COLORS.PRIMARY_DARK} !important;
    --color-white: ${COLORS.WHITE} !important;
    --color-gray-600: ${COLORS.GRAY_600} !important;
    --color-secondary-medium: ${COLORS.SECONDARY_MEDIUM} !important;
    --color-secondary-light: ${COLORS.SECONDARY_LIGHT} !important;
    --font-family-primary: ${FONT_FAMILY.PRIMARY} !important;
  }
`;

