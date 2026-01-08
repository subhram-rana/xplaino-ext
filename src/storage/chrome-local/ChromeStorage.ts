// src/storage/chrome-local/ChromeStorage.ts

import type {
  DomainSettingsDTO,
  UserSettingsDTO,
  UserAccountSettingsDTO,
  ExtensionSettingsDTO,
} from './dto';
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
    LINK_BOOKMARK_PREFERENCE_FOLDER_ID: 'link_bookmark_preference_folder_id',
    XPLAINO_PARAGRAPH_BOOKMARK_FOLDER_ID: 'XPLAINO_PARAGRAPH_BOOKMARK_FOLDER_ID',
    XPLAINO_LINK_BOOKMARK_FOLDER_ID: 'XPLAINO_LINK_BOOKMARK_FOLDER_ID',
    XPLAINO_WORD_BOOKMARK_FOLDER_ID: 'XPLAINO_WORD_BOOKMARK_FOLDER_ID',
    XPLAINO_IMAGE_BOOKMARK_FOLDER_ID: 'XPLAINO_IMAGE_BOOKMARK_FOLDER_ID',
    XPLAINO_BOOKMARK_FOLDER_ID: 'XPLAINO_BOOKMARK_FOLDER_ID',
    DONT_SHOW_XPLAINO_TEXT_BOOKMARK_SAVED_LINK_TOAST: 'dont_show_xplaino_text_bookmark_saved_link_toast',
    DONT_SHOW_XPLAINO_LINK_BOOKMARK_SAVED_LINK_TOAST: 'dont_show_xplaino_link_bookmark_saved_link_toast',
    DONT_SHOW_XPLAINO_WORD_BOOKMARK_SAVED_LINK_TOAST: 'dont_show_xplaino_word_bookmark_saved_link_toast',
    DONT_SHOW_WELCOME_MODAL: 'dont_show_welcome_modal',
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

  /**
   * Get whether highlighted coupon is dismissed
   */
  static async getHighlightedCouponDismissed(couponId: string): Promise<boolean> {
    const dismissed = await this.get<boolean>(`highlighted_coupon_dismissed_${couponId}`);
    return dismissed ?? false;
  }

  /**
   * Set whether highlighted coupon is dismissed
   */
  static async setHighlightedCouponDismissed(couponId: string, dismissed: boolean): Promise<void> {
    return this.set(`highlighted_coupon_dismissed_${couponId}`, dismissed);
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
    console.log('[ChromeStorage] setUserSettingGlobalTheme called with theme:', theme);
    console.log('[ChromeStorage] Setting key:', this.KEYS.USER_SETTING_GLOBAL_THEME);
    await this.set(this.KEYS.USER_SETTING_GLOBAL_THEME, theme);
    console.log('[ChromeStorage] Global theme successfully saved to storage');
    
    // Verify the value was saved
    const verify = await this.get<'light' | 'dark'>(this.KEYS.USER_SETTING_GLOBAL_THEME);
    console.log('[ChromeStorage] Verification - retrieved global theme from storage:', verify);
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
    console.log('[ChromeStorage] setUserSettingThemeOnSiteForDomain called with domain:', domain, 'theme:', theme);
    console.log('[ChromeStorage] Setting key:', this.KEYS.USER_SETTING_THEME_ON_SITE);
    
    const themeMap = await this.getUserSettingThemeOnSite();
    console.log('[ChromeStorage] Current theme map:', themeMap);
    
    const updatedMap = {
      ...themeMap,
      [domain]: theme,
    };
    console.log('[ChromeStorage] Updated theme map:', updatedMap);
    
    await this.set(this.KEYS.USER_SETTING_THEME_ON_SITE, updatedMap);
    console.log('[ChromeStorage] Domain theme successfully saved to storage');
    
    // Verify the value was saved
    const verify = await this.getUserSettingThemeOnSiteForDomain(domain);
    console.log('[ChromeStorage] Verification - retrieved domain theme from storage for', domain, ':', verify);
  }

  /**
   * Clear all domain-specific theme settings
   * This is useful when changing the global theme to ensure it applies everywhere
   */
  static async clearAllDomainThemes(): Promise<void> {
    console.log('[ChromeStorage] Clearing all domain-specific themes');
    await this.remove(this.KEYS.USER_SETTING_THEME_ON_SITE);
    console.log('[ChromeStorage] All domain themes cleared');
    
    // Verify the clear operation
    const verify = await this.getUserSettingThemeOnSite();
    console.log('[ChromeStorage] Verification - theme map after clear:', verify);
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
    const key = this.KEYS.XPLAINO_PARAGRAPH_BOOKMARK_FOLDER_ID;
    console.log('[ChromeStorage] Getting paragraph bookmark folder ID with key:', key);
    const value = await this.get<string>(key);
    console.log('[ChromeStorage] Retrieved value:', value);
    return value;
  }

  /**
   * Set the preferred folder ID for paragraph bookmarks
   */
  static async setParagraphBookmarkPreferenceFolderId(folderId: string): Promise<void> {
    const key = this.KEYS.XPLAINO_PARAGRAPH_BOOKMARK_FOLDER_ID;
    console.log('[ChromeStorage] Setting paragraph bookmark folder ID with key:', key, 'value:', folderId);
    await this.set(key, folderId);
    console.log('[ChromeStorage] Set complete, verifying...');
    const verify = await this.get<string>(key);
    console.log('[ChromeStorage] Verification after set:', verify);
  }

  /**
   * Remove the preferred folder ID for paragraph bookmarks
   */
  static async removeParagraphBookmarkPreferenceFolderId(): Promise<void> {
    return this.remove(this.KEYS.XPLAINO_PARAGRAPH_BOOKMARK_FOLDER_ID);
  }

  /**
   * Get the preferred folder ID for link bookmarks
   */
  static async getLinkBookmarkPreferenceFolderId(): Promise<string | null> {
    return this.get<string>(this.KEYS.XPLAINO_LINK_BOOKMARK_FOLDER_ID);
  }

  /**
   * Set the preferred folder ID for link bookmarks
   */
  static async setLinkBookmarkPreferenceFolderId(folderId: string): Promise<void> {
    return this.set(this.KEYS.XPLAINO_LINK_BOOKMARK_FOLDER_ID, folderId);
  }

  /**
   * Remove the preferred folder ID for link bookmarks
   */
  static async removeLinkBookmarkPreferenceFolderId(): Promise<void> {
    return this.remove(this.KEYS.XPLAINO_LINK_BOOKMARK_FOLDER_ID);
  }

  /**
   * Get the preferred folder ID for word bookmarks
   */
  static async getWordBookmarkPreferenceFolderId(): Promise<string | null> {
    return this.get<string>(this.KEYS.XPLAINO_WORD_BOOKMARK_FOLDER_ID);
  }

  /**
   * Set the preferred folder ID for word bookmarks
   */
  static async setWordBookmarkPreferenceFolderId(folderId: string): Promise<void> {
    return this.set(this.KEYS.XPLAINO_WORD_BOOKMARK_FOLDER_ID, folderId);
  }

  /**
   * Remove the preferred folder ID for word bookmarks
   */
  static async removeWordBookmarkPreferenceFolderId(): Promise<void> {
    return this.remove(this.KEYS.XPLAINO_WORD_BOOKMARK_FOLDER_ID);
  }

  /**
   * Get the preferred folder ID for image bookmarks
   */
  static async getImageBookmarkPreferenceFolderId(): Promise<string | null> {
    return this.get<string>(this.KEYS.XPLAINO_IMAGE_BOOKMARK_FOLDER_ID);
  }

  /**
   * Set the preferred folder ID for image bookmarks
   */
  static async setImageBookmarkPreferenceFolderId(folderId: string): Promise<void> {
    return this.set(this.KEYS.XPLAINO_IMAGE_BOOKMARK_FOLDER_ID, folderId);
  }

  /**
   * Remove the preferred folder ID for image bookmarks
   */
  static async removeImageBookmarkPreferenceFolderId(): Promise<void> {
    return this.remove(this.KEYS.XPLAINO_IMAGE_BOOKMARK_FOLDER_ID);
  }

  /**
   * Get the unified preferred folder ID for all bookmarks
   * This method includes migration logic to migrate from old type-specific keys
   */
  static async getBookmarkPreferenceFolderId(): Promise<string | null> {
    // First, check if the new unified key exists
    const unifiedValue = await this.get<string>(this.KEYS.XPLAINO_BOOKMARK_FOLDER_ID);
    if (unifiedValue) {
      return unifiedValue;
    }
    
    // If not found, check old keys and migrate if found
    // Check in order: paragraph, link, word, image
    const oldKeys = [
      this.KEYS.XPLAINO_PARAGRAPH_BOOKMARK_FOLDER_ID,
      this.KEYS.XPLAINO_LINK_BOOKMARK_FOLDER_ID,
      this.KEYS.XPLAINO_WORD_BOOKMARK_FOLDER_ID,
      this.KEYS.XPLAINO_IMAGE_BOOKMARK_FOLDER_ID,
    ];
    
    for (const oldKey of oldKeys) {
      const oldValue = await this.get<string>(oldKey);
      if (oldValue) {
        // Migrate to new unified key
        await this.set(this.KEYS.XPLAINO_BOOKMARK_FOLDER_ID, oldValue);
        // Remove old key
        await this.remove(oldKey);
        console.log('[ChromeStorage] Migrated bookmark folder preference from', oldKey, 'to unified key');
        return oldValue;
      }
    }
    
    return null;
  }

  /**
   * Set the unified preferred folder ID for all bookmarks
   */
  static async setBookmarkPreferenceFolderId(folderId: string): Promise<void> {
    return this.set(this.KEYS.XPLAINO_BOOKMARK_FOLDER_ID, folderId);
  }

  /**
   * Remove the unified preferred folder ID for all bookmarks
   */
  static async removeBookmarkPreferenceFolderId(): Promise<void> {
    return this.remove(this.KEYS.XPLAINO_BOOKMARK_FOLDER_ID);
  }

  // --- Bookmark Toast Preferences ---
  /**
   * Get whether to show the bookmark saved link toast for text/paragraph bookmarks
   */
  static async getDontShowTextBookmarkSavedLinkToast(): Promise<boolean> {
    const value = await this.get<boolean>(this.KEYS.DONT_SHOW_XPLAINO_TEXT_BOOKMARK_SAVED_LINK_TOAST);
    return value ?? false;
  }

  /**
   * Set whether to show the bookmark saved link toast for text/paragraph bookmarks
   */
  static async setDontShowTextBookmarkSavedLinkToast(dontShow: boolean): Promise<void> {
    return this.set(this.KEYS.DONT_SHOW_XPLAINO_TEXT_BOOKMARK_SAVED_LINK_TOAST, dontShow);
  }

  /**
   * Get whether to show the bookmark saved link toast for link bookmarks
   */
  static async getDontShowLinkBookmarkSavedLinkToast(): Promise<boolean> {
    const value = await this.get<boolean>(this.KEYS.DONT_SHOW_XPLAINO_LINK_BOOKMARK_SAVED_LINK_TOAST);
    return value ?? false;
  }

  /**
   * Set whether to show the bookmark saved link toast for link bookmarks
   */
  static async setDontShowLinkBookmarkSavedLinkToast(dontShow: boolean): Promise<void> {
    return this.set(this.KEYS.DONT_SHOW_XPLAINO_LINK_BOOKMARK_SAVED_LINK_TOAST, dontShow);
  }

  /**
   * Get whether to show the bookmark saved link toast for word bookmarks
   */
  static async getDontShowWordBookmarkSavedLinkToast(): Promise<boolean> {
    const value = await this.get<boolean>(this.KEYS.DONT_SHOW_XPLAINO_WORD_BOOKMARK_SAVED_LINK_TOAST);
    return value ?? false;
  }

  /**
   * Set whether to show the bookmark saved link toast for word bookmarks
   */
  static async setDontShowWordBookmarkSavedLinkToast(dontShow: boolean): Promise<void> {
    return this.set(this.KEYS.DONT_SHOW_XPLAINO_WORD_BOOKMARK_SAVED_LINK_TOAST, dontShow);
  }

  // --- Welcome Modal Preference ---
  /**
   * Get whether to show the welcome modal
   */
  static async getDontShowWelcomeModal(): Promise<boolean> {
    const value = await this.get<boolean>(this.KEYS.DONT_SHOW_WELCOME_MODAL);
    return value ?? false;
  }

  /**
   * Set whether to show the welcome modal
   */
  static async setDontShowWelcomeModal(dontShow: boolean): Promise<void> {
    return this.set(this.KEYS.DONT_SHOW_WELCOME_MODAL, dontShow);
  }

  // ============================================
  // USER ACCOUNT SETTINGS (from backend API)
  // ============================================

  /**
   * Get user account settings from backend API response
   * Stored under xplaino-user-account-settings
   */
  static async getUserAccountSettings(): Promise<UserAccountSettingsDTO | null> {
    return this.get<UserAccountSettingsDTO>('xplaino-user-account-settings');
  }

  /**
   * Set user account settings (from backend API response)
   */
  static async setUserAccountSettings(settings: UserAccountSettingsDTO): Promise<void> {
    return this.set('xplaino-user-account-settings', settings);
  }

  // ============================================
  // EXTENSION SETTINGS (extension-only settings)
  // ============================================

  /**
   * Get extension settings used for per-domain theme overrides
   * Returns default { domainThemes: {} } if not present
   */
  static async getUserExtensionSettings(): Promise<ExtensionSettingsDTO> {
    const settings = await this.get<ExtensionSettingsDTO>('xplaino-user-extension-settings');
    if (!settings) {
      return { domainThemes: {} };
    }
    return settings;
  }

  /**
   * Set extension settings used for per-domain theme overrides
   */
  static async setUserExtensionSettings(settings: ExtensionSettingsDTO): Promise<void> {
    return this.set('xplaino-user-extension-settings', settings);
  }

  /**
   * Get theme for a specific domain from extension settings
   * Returns null if domain has no override (should use account settings)
   */
  static async getUserExtensionDomainTheme(domain: string): Promise<'LIGHT' | 'DARK' | null> {
    const settings = await this.getUserExtensionSettings();
    return settings.domainThemes[domain] ?? null;
  }

  /**
   * Set theme for a specific domain in extension settings
   * Creates the extension settings object if it doesn't exist
   */
  static async setUserExtensionDomainTheme(domain: string, theme: 'LIGHT' | 'DARK'): Promise<void> {
    const settings = await this.getUserExtensionSettings();
    const updatedSettings: ExtensionSettingsDTO = {
      domainThemes: {
        ...settings.domainThemes,
        [domain]: theme,
      },
    };
    return this.setUserExtensionSettings(updatedSettings);
  }

  /**
   * Remove theme override for a specific domain
   * This allows the domain to fall back to account settings
   */
  static async removeUserExtensionDomainTheme(domain: string): Promise<void> {
    const settings = await this.getUserExtensionSettings();
    const updatedDomainThemes = { ...settings.domainThemes };
    delete updatedDomainThemes[domain];
    const updatedSettings: ExtensionSettingsDTO = {
      domainThemes: updatedDomainThemes,
    };
    return this.setUserExtensionSettings(updatedSettings);
  }

  /**
   * Ensure extension settings exist with default value
   * Called on page load to initialize if needed
   */
  static async ensureUserExtensionSettings(): Promise<void> {
    const existing = await this.get<ExtensionSettingsDTO>('xplaino-user-extension-settings');
    if (!existing) {
      await this.setUserExtensionSettings({ domainThemes: {} });
    }
  }
}

