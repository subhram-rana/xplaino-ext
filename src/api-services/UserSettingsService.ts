// src/api-services/UserSettingsService.ts
// Service for fetching user account settings from backend

import { ENV } from '@/config/env';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
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
        // Handle 401/UNAUTHORIZED - check for TOKEN_EXPIRED
        if (response.status === 401) {
          const errorData = await ApiResponseHandler.parseErrorResponse(response);
          
          // Check for TOKEN_EXPIRED error code
          if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
            try {
              // Retry request with token refresh
              const retryResponse = await TokenRefreshRetry.retryRequestWithTokenRefresh(
                {
                  url,
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                  },
                  credentials: 'include',
                },
                'UserSettingsService'
              );

              // Sync unauthenticated user ID from retry response
              await ApiResponseHandler.syncUnauthenticatedUserId(retryResponse, 'UserSettingsService');

              // Handle retry response
              if (retryResponse.ok) {
                // Parse and store the response
                const data: UserAccountSettingsDTO = await retryResponse.json();
                await ChromeStorage.setUserAccountSettings(data);
                console.log('[UserSettingsService] User account settings synced successfully after token refresh');
                return;
              }

              // If retry failed with 401, check for LOGIN_REQUIRED
              if (retryResponse.status === 401) {
                const retryErrorData = await ApiResponseHandler.parseErrorResponse(retryResponse);
                if (ApiResponseHandler.checkLoginRequired(retryErrorData, retryResponse.status)) {
                  console.log('[UserSettingsService] LOGIN_REQUIRED after token refresh, skipping settings sync');
                  return;
                }
              }

              // Log retry error but don't throw
              const retryErrorText = await retryResponse.text().catch(() => 'Unknown error');
              console.warn('[UserSettingsService] Failed to fetch user settings after token refresh:', retryResponse.status, retryErrorText);
              return;
            } catch (refreshError) {
              console.error('[UserSettingsService] Token refresh failed:', refreshError);
              // Continue without throwing - extension will use defaults
              return;
            }
          }

          // Not TOKEN_EXPIRED, just a regular 401 (user not logged in)
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

