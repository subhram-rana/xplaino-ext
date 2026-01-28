// src/config/env.ts
// Environment configuration for the extension

/**
 * Environment configuration
 * 
 * To configure, create a .env file in the project root with:
 * VITE_API_BASE_URL=http://localhost:8000
 * VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
 * VITE_XPLAINO_WEBSITE_BASE_URL=https://xplaino.com
 */
export const ENV = {
  /**
   * API Base URL for backend services
   * Default: http://localhost:8000
   */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',

  /**
   * Google OAuth Client ID (Production)
   */
  GOOGLE_OAUTH_CLIENT_ID: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '355884005048-76olfh4sp2o2uitojjeslpsaonvc7d2s.apps.googleusercontent.com',

  /**
   * Xplaino website base URL
   * Default: https://xplaino.com
   */
  XPLAINO_WEBSITE_BASE_URL: import.meta.env.VITE_XPLAINO_WEBSITE_BASE_URL || 'http://localhost:5173',
} as const;

// Type for environment variables
export type EnvConfig = typeof ENV;

