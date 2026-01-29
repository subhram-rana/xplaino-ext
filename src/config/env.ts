// src/config/env.ts
// Environment configuration for the extension

/**
 * Environment enum to switch between local and production
 */
export enum Environment {
  LOCAL = 'LOCAL',
  PRODUCTION = 'PRODUCTION',
}

/**
 * Current environment setting
 * Change this value to switch between LOCAL and PRODUCTION
 * --------- IMPORTANT ---------: 
 *  1. Change this value to PRODUCTION before deploying to the Chrome Web Store
 *  2. Update value of oauth2.client_id in manifest.json wtih the appropriate GOOGLE_OAUTH_CLIENT_ID value
 *     based on theenvironment
 */
export const env: Environment = Environment.PRODUCTION;

/**
 * Local environment configuration
 */
export const ENV_LOCAL = {
  API_BASE_URL: 'http://localhost:8000',
  GOOGLE_OAUTH_CLIENT_ID: '355884005048-4bn6e6rbq9mfdrb2q43sthsejc88sbcc.apps.googleusercontent.com',
  XPLAINO_WEBSITE_BASE_URL: 'http://localhost:5173',
} as const;

/**
 * Production environment configuration
 */
export const ENV_PROD = {
  API_BASE_URL: 'https://api.xplaino.com',
  GOOGLE_OAUTH_CLIENT_ID: '355884005048-76olfh4sp2o2uitojjeslpsaonvc7d2s.apps.googleusercontent.com',
  XPLAINO_WEBSITE_BASE_URL: 'https://xplaino.com',
} as const;

// Type for environment variables
export type EnvConfig = {
  readonly API_BASE_URL: string;
  readonly GOOGLE_OAUTH_CLIENT_ID: string;
  readonly XPLAINO_WEBSITE_BASE_URL: string;
};

/**
 * Environment configuration lookup
 */
const ENV_CONFIG: Record<Environment, EnvConfig> = {
  [Environment.LOCAL]: ENV_LOCAL,
  [Environment.PRODUCTION]: ENV_PROD,
};

/**
 * Active environment configuration
 * Automatically selected based on the `env` constant
 */
export const ENV: EnvConfig = ENV_CONFIG[env];

