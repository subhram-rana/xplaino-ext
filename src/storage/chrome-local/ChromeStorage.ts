// src/storage/chrome-local/ChromeStorage.ts

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
    AUTH_TOKEN: 'auth_token',
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

  // --- Auth Token ---
  static async getAuthToken(): Promise<string | null> {
    return this.get<string>(this.KEYS.AUTH_TOKEN);
  }

  static async setAuthToken(token: string): Promise<void> {
    return this.set(this.KEYS.AUTH_TOKEN, token);
  }

  static async removeAuthToken(): Promise<void> {
    return this.remove(this.KEYS.AUTH_TOKEN);
  }

  // --- Last Sync ---
  static async getLastSync(): Promise<number | null> {
    return this.get<number>(this.KEYS.LAST_SYNC);
  }

  static async setLastSync(timestamp: number = Date.now()): Promise<void> {
    return this.set(this.KEYS.LAST_SYNC, timestamp);
  }
}

