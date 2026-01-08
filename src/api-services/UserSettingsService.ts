// src/api-services/UserSettingsService.ts
// Service for fetching user account settings from backend

import { ENV } from '@/config/env';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import type { UserAccountSettingsDTO } from '@/storage/chrome-local/dto/UserAccountSettingsDTO';

/**
 * Service for fetching user account settings from backend API
 */
export class UserSettingsService {
  private static readonly ENDPOINT = '/api/user-settings';

  /**
   * Fetch user settings from backend and store in Chrome storage
   * Called on each URL load to sync account settings
   * Gracefully handles errors (401, network) without throwing
   */
  static async syncUserAccountSettings(): Promise<void> {
    try {
      const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
      const authHeaders = await ApiHeaders.getAuthHeaders('UserSettingsService');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
      });

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'UserSettingsService');

      if (!response.ok) {
        // Handle 401/UNAUTHORIZED gracefully - user may not be logged in
        if (response.status === 401) {
          console.log('[UserSettingsService] User not authenticated, skipping settings sync');
          return;
        }

        // Log other errors but don't throw - we'll use defaults
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn('[UserSettingsService] Failed to fetch user settings:', response.status, errorText);
        return;
      }

      // Parse and store the response
      const data: UserAccountSettingsDTO = await response.json();
      await ChromeStorage.setUserAccountSettings(data);
      console.log('[UserSettingsService] User account settings synced successfully');
    } catch (error) {
      // Handle network errors gracefully - don't throw, just log
      console.warn('[UserSettingsService] Network error fetching user settings:', error);
      // Continue without throwing - extension will use defaults
    }
  }
}

