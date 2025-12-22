// src/api-services/VoiceToTextService.ts
// Service for voice-to-text API calls

import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { TokenRefreshService } from './TokenRefreshService';

// Types
export interface VoiceToTextRequest {
  audio: Blob;
}

export interface VoiceToTextResponse {
  text: string;
}

export interface VoiceToTextCallbacks {
  onSuccess: (text: string) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired: () => void;
}

/**
 * Service for handling voice-to-text API calls
 */
export class VoiceToTextService {
  private static readonly ENDPOINT = '/api/v2/voice-to-text';

  /**
   * Get authorization headers if auth info exists
   */
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const authInfo = await ChromeStorage.getAuthInfo();
    if (authInfo?.accessToken) {
      return {
        'Authorization': `Bearer ${authInfo.accessToken}`,
      };
    }
    return {};
  }

  /**
   * Convert audio blob to text
   */
  static async voiceToText(
    audioBlob: Blob,
    callbacks: VoiceToTextCallbacks
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await this.getAuthHeaders();

    try {
      // Create FormData with audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          // Don't set Content-Type header - browser will set it with boundary for FormData
          ...authHeaders,
        },
        body: formData,
        credentials: 'include',
      });

      // Handle 401 errors
      if (response.status === 401) {
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        const errorData = await responseClone.json().catch(() => ({}));
        
        // Check for TOKEN_EXPIRED error code
        if (TokenRefreshService.isTokenExpiredError(response.status, errorData)) {
          console.log('[VoiceToTextService] Token expired, attempting refresh');
          
          try {
            // Refresh the token and get the new access token directly
            const refreshResponse = await TokenRefreshService.refreshAccessToken();
            
            // Retry the request with new token directly from refresh response
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                // Don't set Content-Type header - browser will set it with boundary for FormData
                'Authorization': `Bearer ${refreshResponse.accessToken}`,
              },
              body: formData,
              credentials: 'include',
            });

            // Handle 401 errors on retry
            if (retryResponse.status === 401) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              if (retryErrorData.error_code === 'LOGIN_REQUIRED' || retryErrorData.detail?.includes('LOGIN_REQUIRED')) {
                callbacks.onLoginRequired();
                return;
              }
              callbacks.onError('AUTH_ERROR', 'Authentication failed');
              return;
            }

            // If retry successful, process response
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              callbacks.onError('HTTP_ERROR', `HTTP ${retryResponse.status}: ${errorText}`);
              return;
            }

            const data = await retryResponse.json() as VoiceToTextResponse;
            callbacks.onSuccess(data.text);
            return; // Successfully processed retry response
          } catch (refreshError) {
            console.error('[VoiceToTextService] Token refresh failed:', refreshError);
            // Handle refresh failure
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onLoginRequired();
            return;
          }
        }
        
        // Handle other 401 errors (LOGIN_REQUIRED, etc.)
        if (errorData.error_code === 'LOGIN_REQUIRED' || errorData.detail?.includes('LOGIN_REQUIRED')) {
          callbacks.onLoginRequired();
          return;
        }
        callbacks.onError('AUTH_ERROR', 'Authentication failed');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        callbacks.onError('HTTP_ERROR', `HTTP ${response.status}: ${errorText}`);
        return;
      }

      const data = await response.json() as VoiceToTextResponse;
      callbacks.onSuccess(data.text);
    } catch (error) {
      if (error instanceof Error) {
        callbacks.onError('NETWORK_ERROR', error.message);
      } else {
        callbacks.onError('UNKNOWN_ERROR', 'An unknown error occurred');
      }
    }
  }
}

