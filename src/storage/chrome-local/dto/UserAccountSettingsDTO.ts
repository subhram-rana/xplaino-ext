// src/storage/chrome-local/dto/UserAccountSettingsDTO.ts

/**
 * User account settings DTO
 * Matches the backend UserSettingsResponse structure from /api/user-settings
 */
export interface UserAccountSettingsDTO {
  /** User ID (UUID) */
  userId: string;
  /** User settings */
  settings: {
    /** Native language code (e.g., 'EN', 'ES', 'FR', 'DE', 'HI') or null */
    nativeLanguage: string | null;
    /** Page translation view mode: 'APPEND' | 'REPLACE' */
    pageTranslationView: 'APPEND' | 'REPLACE';
    /** Theme preference: 'LIGHT' | 'DARK' */
    theme: 'LIGHT' | 'DARK';
  };
}

