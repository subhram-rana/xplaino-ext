// src/types/common.ts

/**
 * Common type definitions used across the application
 */

/** Generic API response wrapper */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/** Loading state type */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/** Theme type */
export type Theme = 'light' | 'dark';

/** Size variants */
export type Size = 'small' | 'medium' | 'large';

/** Button variants */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

