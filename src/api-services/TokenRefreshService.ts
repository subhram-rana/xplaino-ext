// src/api-services/TokenRefreshService.ts
// Service for refreshing access tokens when they expire

import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import type { LoginResponse } from './AuthService';

/**
 * Service for handling token refresh operations
 */
export class TokenRefreshService {
  private static readonly REFRESH_TOKEN_ENDPOINT = '/api/auth/refresh-token';

  /**
   * Refresh access token using refresh token
   * @returns Promise resolving to new LoginResponse with updated tokens
   * @throws Error if refresh fails
   */
  static async refreshAccessToken(): Promise<LoginResponse> {
    console.log('[TokenRefreshService] Starting token refresh');

    // Get current auth info from storage
    const authInfo = await ChromeStorage.getAuthInfo();
    
    if (!authInfo?.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (!authInfo?.accessToken) {
      throw new Error('No access token available');
    }

    const url = `${ENV.API_BASE_URL}${this.REFRESH_TOKEN_ENDPOINT}`;

    try {
      // Build headers with auth token and unauthenticated user ID
      const headers = await ApiHeaders.getAuthHeaders('TokenRefreshService');
      headers['Content-Type'] = 'application/json';
      headers['Authorization'] = `Bearer ${authInfo.accessToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          refreshToken: authInfo.refreshToken,
        }),
      });

      if (!response.ok) {
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        const errorText = await responseClone.text();
        let errorBody: any;
        try {
          errorBody = JSON.parse(errorText);
        } catch {
          errorBody = errorText;
        }

        console.error('[TokenRefreshService] Refresh token API failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          errorBody,
        });

        // Check for LOGIN_REQUIRED error code
        if (response.status === 401 && ApiResponseHandler.checkLoginRequired(errorBody, response.status)) {
          console.log('[TokenRefreshService] LOGIN_REQUIRED error, showing login modal');
          // Handle login required - remove auth info and show login modal
          await this.handleTokenRefreshFailure();
        }

        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'TokenRefreshService');

      const data = await response.json() as LoginResponse;
      console.log('[TokenRefreshService] Token refresh successful');

      // Update chrome storage with new tokens
      // ChromeStorage.setAuthInfo already handles the storage update properly
      await ChromeStorage.setAuthInfo({
        isLoggedIn: data.isLoggedIn,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
        userSessionPk: data.userSessionPk,
        user: data.user,
      });

      // Trigger storage change event to update atoms in components
      // This ensures immediate UI updates without waiting for the listener
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ 
          [ChromeStorage.KEYS.XPLAINO_AUTH_INFO]: {
            isLoggedIn: data.isLoggedIn,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            accessTokenExpiresAt: data.accessTokenExpiresAt,
            refreshTokenExpiresAt: data.refreshTokenExpiresAt,
            userSessionPk: data.userSessionPk,
            user: data.user,
          }
        }, () => {
          resolve();
        });
      });

      return data;
    } catch (error) {
      console.error('[TokenRefreshService] Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Handle token refresh failure
   * Removes auth info from storage and triggers login modal
   */
  static async handleTokenRefreshFailure(): Promise<void> {
    console.log('[TokenRefreshService] Handling token refresh failure');

    // Remove auth info from chrome storage
    await ChromeStorage.removeAuthInfo();

    // Trigger login modal by setting a flag in chrome.storage
    // The content script will listen for this and show the login modal
    await chrome.storage.local.set({ 
      'xplaino_show_login_modal': true 
    });

    // Also dispatch a custom event that content scripts can listen to
    // This is a fallback mechanism (only works in window context)
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('xplaino:login-required'));
      } catch (error) {
        // Ignore errors if window.dispatchEvent is not available
        console.warn('[TokenRefreshService] Could not dispatch login-required event:', error);
      }
    }
  }

  /**
   * Check if error response indicates token expiration
   * @param status - HTTP status code
   * @param errorBody - Error response body (parsed JSON or text)
   * @returns true if error is TOKEN_EXPIRED
   */
  static isTokenExpiredError(status: number, errorBody: any): boolean {
    if (status !== 401) {
      return false;
    }

    // Check for TOKEN_EXPIRED error code
    if (errorBody?.detail?.errorCode === 'TOKEN_EXPIRED') {
      return true;
    }

    return false;
  }
}

