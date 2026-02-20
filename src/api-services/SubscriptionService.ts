// src/api-services/SubscriptionService.ts
// Service for fetching user subscription status from backend

import { ENV } from '@/config/env';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
import { TokenRefreshService } from './TokenRefreshService';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import type { SubscriptionStatusDTO } from './dto/SubscriptionDTO';

/**
 * Service for fetching user subscription status from backend API.
 * Endpoint: GET /api/subscription/{userId}
 */
export class SubscriptionService {
  private static readonly ENDPOINT_PREFIX = '/api/subscription';

  /**
   * Fetch subscription status from backend and store in Chrome storage.
   * Called after user settings sync on each URL load.
   * Gracefully handles errors (401, network) without throwing.
   * Requires userId from user account settings.
   */
  static async syncSubscriptionStatus(): Promise<void> {
    try {
      // Get userId from stored user account settings
      const accountSettings = await ChromeStorage.getUserAccountSettings();
      if (!accountSettings?.userId) {
        console.log('[SubscriptionService] No userId available, skipping subscription sync');
        return;
      }

      // Do not call API when user is logged out (no token or login status false)
      const authInfo = await ChromeStorage.getAuthInfo();
      if (!authInfo?.accessToken || authInfo?.isLoggedIn === false) {
        console.log('[SubscriptionService] User not logged in, skipping subscription sync');
        return;
      }

      const userId = accountSettings.userId;
      const url = `${ENV.API_BASE_URL}${this.ENDPOINT_PREFIX}/${userId}`;
      const authHeaders = await ApiHeaders.getAuthHeaders('SubscriptionService');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
      });

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'SubscriptionService');

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
                'SubscriptionService'
              );

              // Sync unauthenticated user ID from retry response
              await ApiResponseHandler.syncUnauthenticatedUserId(retryResponse, 'SubscriptionService');

              // Handle retry response
              if (retryResponse.ok) {
                const data: SubscriptionStatusDTO = await retryResponse.json();
                await ChromeStorage.setSubscriptionStatus(data);
                console.log('[SubscriptionService] Subscription status synced successfully after token refresh');
                return;
              }

              // If retry failed with 401, check for LOGIN_REQUIRED
              if (retryResponse.status === 401) {
                const retryErrorData = await ApiResponseHandler.parseErrorResponse(retryResponse);
                if (ApiResponseHandler.checkLoginRequired(retryErrorData, retryResponse.status)) {
                  console.log('[SubscriptionService] LOGIN_REQUIRED after token refresh, skipping subscription sync');
                  return;
                }
              }

              // Log retry error but don't throw
              const retryErrorText = await retryResponse.text().catch(() => 'Unknown error');
              console.warn('[SubscriptionService] Failed to fetch subscription after token refresh:', retryResponse.status, retryErrorText);
              return;
            } catch (refreshError) {
              console.error('[SubscriptionService] Token refresh failed:', refreshError);
              await TokenRefreshService.handleTokenRefreshFailure();
              return;
            }
          }

          // Not TOKEN_EXPIRED, just a regular 401
          console.log('[SubscriptionService] User not authenticated, skipping subscription sync');
          return;
        }

        // Log other errors but don't throw
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn('[SubscriptionService] Failed to fetch subscription status:', response.status, errorText);
        return;
      }

      // Parse and store the response
      const data: SubscriptionStatusDTO = await response.json();
      await ChromeStorage.setSubscriptionStatus(data);
      console.log('[SubscriptionService] Subscription status synced successfully:', {
        has_active_subscription: data.has_active_subscription,
      });
    } catch (error) {
      // Handle network errors gracefully
      console.warn('[SubscriptionService] Network error fetching subscription status:', error);
    }
  }

  /**
   * Get cached subscription status from Chrome storage.
   * Returns null if no status has been synced yet.
   */
  static async getSubscriptionStatus(): Promise<SubscriptionStatusDTO | null> {
    return ChromeStorage.getSubscriptionStatus();
  }
}
