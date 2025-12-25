// src/storage/chrome-local/ChromeStorage.ts

import type { DomainSettingsDTO, UserSettingsDTO } from './dto';
import type { DomainStatus } from '@/types/domain';

/**
 * Central class for all chrome.storage.local operations
 * All storage operations must go through this class
 */
export class ChromeStorage {
  // ============================================
  // STATIC STORAGE KEYS
  // Add all storage keys here as static constants
  // ============================================
  static readonly KEYS = {
    USER_SETTINGS: 'user_settings',
    SAVED_WORDS: 'saved_words',
    SESSION_DATA: 'session_data',
    LAST_SYNC: 'last_sync',
    EXTENSION_SETTINGS: 'extension_settings',
    DISABLE_MODAL_DISMISSED: 'disable_modal_dismissed',
    XPLAINO_AUTH_INFO: 'xplaino_ext_user_auth_info',
    PAGE_CONTENT: 'page_content',
    USER_SETTING_GLOBAL_THEME: 'user_setting_global_theme',
    USER_SETTING_PAGE_TRANSLATION_VIEW: 'user_setting_page_translation_view',
    USER_SETTING_THEME_ON_SITE: 'user_setting_theme_on_site',
    USER_SETTING_NATIVE_LANGUAGE: 'user_setting_native_language',
    UNAUTHENTICATED_USER_ID: 'x_unauthenticated_user_id',
    PARAGRAPH_BOOKMARK_PREFERENCE_FOLDER_ID: 'paragraph_bookmark_preference_folder_id',
  } as const;

  // ============================================
  // GENERIC METHODS
  // ============================================

  /**
   * Get a value from chrome.storage.local
   * @param key - Storage key
   * @returns Promise resolving to the value or null
   */
  static async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? null);
      });
    });
  }

  /**
   * Set a value in chrome.storage.local
   * @param key - Storage key
   * @param value - Value to store
   */
  static async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  /**
   * Remove a value from chrome.storage.local
   * @param key - Storage key to remove
   */
  static async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  }

  /**
   * Remove multiple values from chrome.storage.local
   * @param keys - Array of storage keys to remove
   */
  static async removeMultiple(keys: string[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    });
  }

  /**
   * Clear all values from chrome.storage.local
   */
  static async clear(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }

  /**
   * Get all stored data
   * @returns Promise resolving to all stored data
   */
  static async getAll(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(result);
      });
    });
  }

  // ============================================
  // TYPE-SAFE GETTERS AND SETTERS
  // Add methods for each DTO type here as needed
  // ============================================

  // Example placeholder methods - implement with actual DTOs

  // --- Last Sync ---
  static async getLastSync(): Promise<number | null> {
    return this.get<number>(this.KEYS.LAST_SYNC);
  }

  static async setLastSync(timestamp: number = Date.now()): Promise<void> {
    return this.set(this.KEYS.LAST_SYNC, timestamp);
  }

  // --- Extension Settings ---
  static async getExtensionSettings(): Promise<DomainSettingsDTO | null> {
    return this.get<DomainSettingsDTO>(this.KEYS.EXTENSION_SETTINGS);
  }

  static async setExtensionSettings(settings: DomainSettingsDTO): Promise<void> {
    return this.set(this.KEYS.EXTENSION_SETTINGS, settings);
  }

  static async getGlobalDisabled(): Promise<boolean> {
    const settings = await this.getExtensionSettings();
    return settings?.globalDisabled ?? false;
  }

  static async setGlobalDisabled(disabled: boolean): Promise<void> {
    const settings = await this.getExtensionSettings();
    const updatedSettings: DomainSettingsDTO = {
      globalDisabled: disabled,
      domainSettings: settings?.domainSettings ?? {},
    };
    return this.setExtensionSettings(updatedSettings);
  }

  static async getDomainStatus(domain: string): Promise<DomainStatus | null> {
    const settings = await this.getExtensionSettings();
    return settings?.domainSettings[domain] ?? null;
  }

  static async setDomainStatus(domain: string, status: DomainStatus): Promise<void> {
    const settings = await this.getExtensionSettings();
    const updatedSettings: DomainSettingsDTO = {
      globalDisabled: settings?.globalDisabled ?? false,
      domainSettings: {
        ...(settings?.domainSettings ?? {}),
        [domain]: status,
      },
    };
    return this.setExtensionSettings(updatedSettings);
  }

  static async getAllDomainSettings(): Promise<Record<string, DomainStatus>> {
    const settings = await this.getExtensionSettings();
    return settings?.domainSettings ?? {};
  }

  // --- User Settings ---
  static async getUserSettings(): Promise<UserSettingsDTO | null> {
    return this.get<UserSettingsDTO>(this.KEYS.USER_SETTINGS);
  }

  static async setUserSettings(settings: UserSettingsDTO): Promise<void> {
    return this.set(this.KEYS.USER_SETTINGS, settings);
  }

  static async getLanguage(): Promise<string | null> {
    const settings = await this.getUserSettings();
    return settings?.language ?? null;
  }

  static async setLanguage(language: string): Promise<void> {
    const settings = await this.getUserSettings();
    const updatedSettings: UserSettingsDTO = {
      ...settings,
      language,
    };
    return this.setUserSettings(updatedSettings);
  }

  static async getTranslationView(): Promise<'none' | 'append' | 'replace' | null> {
    const settings = await this.getUserSettings();
    return settings?.translationView ?? null;
  }

  static async setTranslationView(view: 'none' | 'append' | 'replace'): Promise<void> {
    const settings = await this.getUserSettings();
    const updatedSettings: UserSettingsDTO = {
      ...settings,
      translationView: view,
    };
    return this.setUserSettings(updatedSettings);
  }

  static async getGlobalTheme(): Promise<'light' | 'dark' | null> {
    const settings = await this.getUserSettings();
    return settings?.globalTheme ?? null;
  }

  static async setGlobalTheme(theme: 'light' | 'dark'): Promise<void> {
    const settings = await this.getUserSettings();
    const updatedSettings: UserSettingsDTO = {
      ...settings,
      globalTheme: theme,
    };
    return this.setUserSettings(updatedSettings);
  }

  static async getDomainTheme(domain: string): Promise<'light' | 'dark' | null> {
    const settings = await this.getUserSettings();
    return settings?.domainThemes?.[domain] ?? null;
  }

  static async setDomainTheme(domain: string, theme: 'light' | 'dark'): Promise<void> {
    const settings = await this.getUserSettings();
    const updatedSettings: UserSettingsDTO = {
      ...settings,
      domainThemes: {
        ...(settings?.domainThemes ?? {}),
        [domain]: theme,
      },
    };
    return this.setUserSettings(updatedSettings);
  }

  // --- Side Panel Expanded State ---
  static async getSidePanelExpanded(domain: string): Promise<boolean> {
    const settings = await this.getUserSettings();
    return settings?.sidePanelExpanded?.[domain] ?? false;
  }

  static async setSidePanelExpanded(domain: string, expanded: boolean): Promise<void> {
    const settings = await this.getUserSettings();
    const updatedSettings: UserSettingsDTO = {
      ...settings,
      sidePanelExpanded: {
        ...(settings?.sidePanelExpanded ?? {}),
        [domain]: expanded,
      },
    };
    return this.setUserSettings(updatedSettings);
  }

  // --- Disable Modal Preference ---
  static async getDisableModalDismissed(): Promise<boolean> {
    const value = await this.get<boolean>(this.KEYS.DISABLE_MODAL_DISMISSED);
    return value ?? false;
  }

  static async setDisableModalDismissed(dismissed: boolean): Promise<void> {
    return this.set(this.KEYS.DISABLE_MODAL_DISMISSED, dismissed);
  }

  // --- Xplaino Auth Info ---
  /**
   * Auth info stored after successful login
   */
  static async getAuthInfo(): Promise<{
    isLoggedIn?: boolean;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    refreshTokenExpiresAt?: number;
    userSessionPk?: string;
    user?: {
      id: string;
      name: string;
      firstName?: string;
      lastName?: string;
      email: string;
      picture?: string;
      role?: string;
    };
  } | null> {
    return this.get(this.KEYS.XPLAINO_AUTH_INFO);
  }

  static async setAuthInfo(authInfo: {
    isLoggedIn?: boolean;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    refreshTokenExpiresAt?: number;
    userSessionPk?: string;
    user?: {
      id: string;
      name: string;
      firstName?: string;
      lastName?: string;
      email: string;
      picture?: string;
      role?: string;
    };
  }): Promise<void> {
    return this.set(this.KEYS.XPLAINO_AUTH_INFO, authInfo);
  }

  static async removeAuthInfo(): Promise<void> {
    return this.remove(this.KEYS.XPLAINO_AUTH_INFO);
  }

  // --- Page Content (per domain) ---
  static async getPageContent(domain: string): Promise<string | null> {
    const pageContentMap = await this.get<Record<string, string>>(this.KEYS.PAGE_CONTENT);
    return pageContentMap?.[domain] ?? null;
  }

  static async setPageContent(domain: string, content: string): Promise<void> {
    const pageContentMap = await this.get<Record<string, string>>(this.KEYS.PAGE_CONTENT) ?? {};
    const updatedMap = {
      ...pageContentMap,
      [domain]: content,
    };
    return this.set(this.KEYS.PAGE_CONTENT, updatedMap);
  }

  static async removePageContent(domain: string): Promise<void> {
    const pageContentMap = await this.get<Record<string, string>>(this.KEYS.PAGE_CONTENT);
    if (pageContentMap && pageContentMap[domain]) {
      delete pageContentMap[domain];
      return this.set(this.KEYS.PAGE_CONTENT, pageContentMap);
    }
  }

  static async clearAllPageContent(): Promise<void> {
    return this.remove(this.KEYS.PAGE_CONTENT);
  }

  // ============================================
  // NEW FLAT STORAGE METHODS
  // ============================================

  /**
   * Migrate old nested user settings to new flat storage keys
   * This should be called once on extension startup or settings load
   */
  static async migrateUserSettingsToFlatKeys(): Promise<void> {
    // Check if migration already done by checking if new keys exist
    const [hasGlobalTheme, hasTranslationView, hasThemeOnSite, hasNativeLanguage] = await Promise.all([
      this.get(this.KEYS.USER_SETTING_GLOBAL_THEME),
      this.get(this.KEYS.USER_SETTING_PAGE_TRANSLATION_VIEW),
      this.get(this.KEYS.USER_SETTING_THEME_ON_SITE),
      this.get(this.KEYS.USER_SETTING_NATIVE_LANGUAGE),
    ]);

    // Get old nested settings
    const oldSettings = await this.getUserSettings();

    if (oldSettings) {
      // Migrate global theme
      if (oldSettings.globalTheme && hasGlobalTheme === null) {
        await this.set(this.KEYS.USER_SETTING_GLOBAL_THEME, oldSettings.globalTheme);
      }

      // Migrate translation view (skip 'none' as it's deprecated)
      if (oldSettings.translationView && oldSettings.translationView !== 'none' && hasTranslationView === null) {
        await this.set(this.KEYS.USER_SETTING_PAGE_TRANSLATION_VIEW, oldSettings.translationView);
      }

      // Migrate domain themes
      if (oldSettings.domainThemes && Object.keys(oldSettings.domainThemes).length > 0 && hasThemeOnSite === null) {
        await this.set(this.KEYS.USER_SETTING_THEME_ON_SITE, oldSettings.domainThemes);
      }

      // Migrate native language
      if (oldSettings.language && hasNativeLanguage === null) {
        await this.set(this.KEYS.USER_SETTING_NATIVE_LANGUAGE, oldSettings.language);
      }
    }
  }

  // --- User Setting: Global Theme ---
  static async getUserSettingGlobalTheme(): Promise<'light' | 'dark' | null> {
    // Run migration first
    await this.migrateUserSettingsToFlatKeys();
    return this.get<'light' | 'dark'>(this.KEYS.USER_SETTING_GLOBAL_THEME);
  }

  static async setUserSettingGlobalTheme(theme: 'light' | 'dark'): Promise<void> {
    return this.set(this.KEYS.USER_SETTING_GLOBAL_THEME, theme);
  }

  // --- User Setting: Page Translation View ---
  static async getUserSettingPageTranslationView(): Promise<'append' | 'replace' | null> {
    // Run migration first
    await this.migrateUserSettingsToFlatKeys();
    const value = await this.get<'append' | 'replace' | 'none'>(this.KEYS.USER_SETTING_PAGE_TRANSLATION_VIEW);
    // Migrate 'none' to 'append' if found
    if (value === 'none') {
      await this.setUserSettingPageTranslationView('append');
      return 'append';
    }
    return value;
  }

  static async setUserSettingPageTranslationView(view: 'append' | 'replace'): Promise<void> {
    return this.set(this.KEYS.USER_SETTING_PAGE_TRANSLATION_VIEW, view);
  }

  // --- User Setting: Theme On Site (Domain Map) ---
  static async getUserSettingThemeOnSite(): Promise<Record<string, 'light' | 'dark'>> {
    // Run migration first
    await this.migrateUserSettingsToFlatKeys();
    const value = await this.get<Record<string, 'light' | 'dark'>>(this.KEYS.USER_SETTING_THEME_ON_SITE);
    return value ?? {};
  }

  static async getUserSettingThemeOnSiteForDomain(domain: string): Promise<'light' | 'dark' | null> {
    const themeMap = await this.getUserSettingThemeOnSite();
    return themeMap[domain] ?? null;
  }

  static async setUserSettingThemeOnSiteForDomain(domain: string, theme: 'light' | 'dark'): Promise<void> {
    const themeMap = await this.getUserSettingThemeOnSite();
    const updatedMap = {
      ...themeMap,
      [domain]: theme,
    };
    return this.set(this.KEYS.USER_SETTING_THEME_ON_SITE, updatedMap);
  }

  // --- User Setting: Native Language ---
  static async getUserSettingNativeLanguage(): Promise<string | null> {
    // Run migration first
    await this.migrateUserSettingsToFlatKeys();
    return this.get<string>(this.KEYS.USER_SETTING_NATIVE_LANGUAGE);
  }

  static async setUserSettingNativeLanguage(language: string): Promise<void> {
    return this.set(this.KEYS.USER_SETTING_NATIVE_LANGUAGE, language);
  }

  // --- Unauthenticated User ID ---
  /**
   * Get unauthenticated user ID
   * This ID is used for tracking unauthenticated users and is sent with all API requests
   * CRITICAL: This ID must never be deleted and persists across login/logout
   */
  static async getUnauthenticatedUserId(): Promise<string | null> {
    return this.get<string>(this.KEYS.UNAUTHENTICATED_USER_ID);
  }

  /**
   * Set unauthenticated user ID
   * This is set when the backend returns X-Unauthenticated-User-Id header
   * CRITICAL: This ID must never be deleted and persists across login/logout
   */
  static async setUnauthenticatedUserId(id: string): Promise<void> {
    return this.set(this.KEYS.UNAUTHENTICATED_USER_ID, id);
  }

  // --- Paragraph Bookmark Preference Folder ID ---
  /**
   * Get the preferred folder ID for paragraph bookmarks
   */
  static async getParagraphBookmarkPreferenceFolderId(): Promise<string | null> {
    return this.get<string>(this.KEYS.PARAGRAPH_BOOKMARK_PREFERENCE_FOLDER_ID);
  }

  /**
   * Set the preferred folder ID for paragraph bookmarks
   */
  static async setParagraphBookmarkPreferenceFolderId(folderId: string): Promise<void> {
    return this.set(this.KEYS.PARAGRAPH_BOOKMARK_PREFERENCE_FOLDER_ID, folderId);
  }

  /**
   * Remove the preferred folder ID for paragraph bookmarks
   */
  static async removeParagraphBookmarkPreferenceFolderId(): Promise<void> {
    return this.remove(this.KEYS.PARAGRAPH_BOOKMARK_PREFERENCE_FOLDER_ID);
  }
}

