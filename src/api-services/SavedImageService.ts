// src/api-services/SavedImageService.ts
// Service for managing saved images

import { ENV } from '@/config/env';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
import { SaveImageRequest, SavedImageResponse } from './dto/SavedImageDTO';

// Callbacks
export interface SaveImageCallbacks {
  onSuccess: (response: SavedImageResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired?: () => void;
  onSubscriptionRequired?: () => void;
}

export interface DeleteSavedImageCallbacks {
  onSuccess: () => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired?: () => void;
  onSubscriptionRequired?: () => void;
}

/**
 * Service for managing saved images
 */
export class SavedImageService {
  private static readonly ENDPOINT = '/api/saved-image';

  /**
   * Save an image
   */
  static async saveImage(
    request: SaveImageRequest,
    callbacks: SaveImageCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('SavedImageService');

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
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'SavedImageService');

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
              'SavedImageService'
            );
            
            if (!retryResponse.ok) {
              const errorData = await ApiResponseHandler.parseErrorResponse(retryResponse);
              const errorCode = errorData?.error_code || `HTTP_${retryResponse.status}`;
              const errorMessage = errorData?.error_message || errorData?.detail || retryResponse.statusText;
              callbacks.onError(errorCode, errorMessage);
              return;
            }
            
            const data: SavedImageResponse = await retryResponse.json();
            callbacks.onSuccess(data);
            return;
          } catch (refreshError) {
            console.error('[SavedImageService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }
        
        // Handle other 401 errors (LOGIN_REQUIRED, AUTH_001, AUTH_002, AUTH_003)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'SavedImageService');
          return;
        }
        
        const errorCode = errorData?.error_code || 'UNAUTHORIZED';
        const errorMessage = errorData?.error_message || errorData?.detail || 'Unauthorized';
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        // Check for LOGIN_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'SavedImageService');
          return;
        }
        
        // Check for SUBSCRIPTION_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkSubscriptionRequired(errorData, response.status)) {
          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'SavedImageService');
          return;
        }
        
        const errorCode = errorData?.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData?.error_message || errorData?.detail || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      const data: SavedImageResponse = await response.json();
      callbacks.onSuccess(data);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onError('ABORTED', 'Request was aborted');
      } else {
        callbacks.onError('NETWORK_ERROR', (error as Error).message || 'Network error occurred');
      }
    }
  }

  /**
   * Delete a saved image
   */
  static async deleteSavedImage(
    savedImageId: string,
    callbacks: DeleteSavedImageCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}/${savedImageId}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('SavedImageService');

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
        signal: abortSignal,
        credentials: 'include',
      });

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'SavedImageService');

      // Handle 401 errors with TOKEN_EXPIRED check
      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            // Retry request with token refresh
            const retryResponse = await TokenRefreshRetry.retryRequestWithTokenRefresh(
              {
                url,
                method: 'DELETE',
                headers: {
                  ...authHeaders,
                },
                signal: abortSignal,
                credentials: 'include',
              },
              'SavedImageService'
            );
            
            if (!retryResponse.ok) {
              const errorData = await ApiResponseHandler.parseErrorResponse(retryResponse);
              const errorCode = errorData?.error_code || `HTTP_${retryResponse.status}`;
              const errorMessage = errorData?.error_message || errorData?.detail || retryResponse.statusText;
              callbacks.onError(errorCode, errorMessage);
              return;
            }
            
            callbacks.onSuccess();
            return;
          } catch (refreshError) {
            console.error('[SavedImageService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }
        
        // Handle other 401 errors (LOGIN_REQUIRED, AUTH_001, AUTH_002, AUTH_003)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'SavedImageService');
          return;
        }
        
        const errorCode = errorData?.error_code || 'UNAUTHORIZED';
        const errorMessage = errorData?.error_message || errorData?.detail || 'Unauthorized';
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        // Check for LOGIN_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'SavedImageService');
          return;
        }
        
        // Check for SUBSCRIPTION_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkSubscriptionRequired(errorData, response.status)) {
          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'SavedImageService');
          return;
        }
        
        const errorCode = errorData?.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData?.error_message || errorData?.detail || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      // 204 No Content on success
      callbacks.onSuccess();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onError('ABORTED', 'Request was aborted');
      } else {
        callbacks.onError('NETWORK_ERROR', (error as Error).message || 'Network error occurred');
      }
    }
  }
}

