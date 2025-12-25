// src/api-services/WordAntonymsService.ts
// Service for getting antonyms for words

import { ENV } from '@/config/env';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';

export interface WordAntonyms {
  word: string;
  antonyms: string[];
}

export interface AntonymsRequest {
  words: string[];
}

export interface AntonymsResponse {
  antonyms: WordAntonyms[];
}

export interface AntonymsCallbacks {
  onSuccess: (response: AntonymsResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onSubscriptionRequired?: () => void;
  onLoginRequired?: () => void;
}

/**
 * Service for fetching antonyms for words
 */
export class WordAntonymsService {
  private static readonly ENDPOINT = '/api/v2/antonyms';

  /**
   * Get antonyms for words
   */
  static async getAntonyms(
    request: AntonymsRequest,
    callbacks: AntonymsCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WordAntonymsService');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(request),
        signal: abortSignal,
        credentials: 'include',
      });

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WordAntonymsService');

      // Handle 401 errors with TOKEN_EXPIRED check
      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            // Retry request with token refresh
            const retryResponse = await TokenRefreshRetry.retryRequestWithTokenRefresh(
              {
                url,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...authHeaders,
                },
                body: JSON.stringify(request),
                signal: abortSignal,
                credentials: 'include',
              },
              'WordAntonymsService'
            );
            
            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({}));
              const errorCode = errorData.error_code || `HTTP_${retryResponse.status}`;
              const errorMessage = errorData.error_message 
                || (typeof errorData.detail === 'string' ? errorData.detail : errorData.detail?.message)
                || retryResponse.statusText;
              callbacks.onError(errorCode, errorMessage);
              return;
            }
            
            const rawData = await retryResponse.json();
            // Transform API response from { results: [...] } to { antonyms: [...] }
            const data: AntonymsResponse = {
              antonyms: rawData.results || []
            };
            callbacks.onSuccess(data);
            return;
          } catch (refreshError) {
            console.error('[WordAntonymsService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }
        
        // Handle other 401 errors
        // Check for LOGIN_REQUIRED in error response body
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          // Call service-specific callback first (to clean up UI state)
          if (callbacks.onLoginRequired) {
            callbacks.onLoginRequired();
          }
          ApiResponseHandler.handleLoginRequired(undefined, 'WordAntonymsService');
          return;
        }
        
        const errorCode = errorData.error_code || 'UNAUTHORIZED';
        const errorMessage = errorData.error_message 
          || (typeof errorData.detail === 'string' ? errorData.detail : errorData.detail?.message)
          || 'Unauthorized';
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        // Check for LOGIN_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          // Call service-specific callback first (to clean up UI state)
          if (callbacks.onLoginRequired) {
            callbacks.onLoginRequired();
          }
          ApiResponseHandler.handleLoginRequired(undefined, 'WordAntonymsService');
          return;
        }
        
        // Check for SUBSCRIPTION_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkSubscriptionRequired(errorData, response.status)) {
          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'WordAntonymsService');
          return;
        }
        
        const errorCode = errorData.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData.error_message 
          || (typeof errorData.detail === 'string' ? errorData.detail : errorData.detail?.message)
          || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      const rawData = await response.json();
      // Transform API response from { results: [...] } to { antonyms: [...] }
      const data: AntonymsResponse = {
        antonyms: rawData.results || []
      };
      callbacks.onSuccess(data);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onError('ABORTED', 'Request was aborted');
      } else {
        callbacks.onError('NETWORK_ERROR', (error as Error).message || 'Network error occurred');
      }
    }
  }
}

