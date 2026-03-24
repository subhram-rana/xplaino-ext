// src/api-services/WebHighlightService.ts
// Service for managing web highlights (browser extension text highlights)

import { ENV } from '@/config/env';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
import type {
  CreateWebHighlightRequest,
  CreatedWebHighlightResponse,
  GetWebHighlightsResponse,
} from './dto/WebHighlightDTO';

export interface GetHighlightsCallbacks {
  onSuccess: (response: GetWebHighlightsResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
}

export interface CreateHighlightCallbacks {
  onSuccess: (response: CreatedWebHighlightResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired?: () => void;
}

export interface DeleteHighlightCallbacks {
  onSuccess: () => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired?: () => void;
}

/**
 * Service for managing web highlights
 */
export class WebHighlightService {
  private static readonly ENDPOINT = '/api/web-highlights';

  /**
   * Fetch all highlights for the authenticated user on a specific page URL.
   * Returns empty list if unauthenticated (no 401 from the backend).
   */
  static async getHighlights(
    pageUrl: string,
    callbacks: GetHighlightsCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const encodedUrl = encodeURIComponent(pageUrl);
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}?url=${encodedUrl}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebHighlightService');

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        signal: abortSignal,
        credentials: 'include',
      });

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebHighlightService');

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        const errorCode = errorData.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData.error_message || errorData.detail || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      const data: GetWebHighlightsResponse = await response.json();
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
   * Create a new web highlight for the authenticated user.
   */
  static async createHighlight(
    request: CreateWebHighlightRequest,
    callbacks: CreateHighlightCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebHighlightService');

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

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebHighlightService');

      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
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
              'WebHighlightService'
            );

            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              const errorCode = retryErrorData.error_code || `HTTP_${retryResponse.status}`;
              const errorMessage = retryErrorData.error_message || retryErrorData.detail || retryResponse.statusText;
              callbacks.onError(errorCode, errorMessage);
              return;
            }

            const data: CreatedWebHighlightResponse = await retryResponse.json();
            callbacks.onSuccess(data);
            return;
          } catch (refreshError) {
            console.error('[WebHighlightService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebHighlightService');
          return;
        }

        const errorCode = errorData.error_code || 'UNAUTHORIZED';
        const errorMessage = errorData.error_message || errorData.detail || 'Unauthorized';
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebHighlightService');
          return;
        }

        const errorCode = errorData.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData.error_message || errorData.detail || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      const data: CreatedWebHighlightResponse = await response.json();
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
   * Delete a web highlight by ID.
   * 404 is treated as a soft success (highlight already gone).
   * Returns 204 No Content on success — body is never read.
   */
  static async deleteHighlight(
    highlightId: string,
    callbacks: DeleteHighlightCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}/${highlightId}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebHighlightService');

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
        signal: abortSignal,
        credentials: 'include',
      });

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebHighlightService');

      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
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
              'WebHighlightService'
            );

            if (!retryResponse.ok && retryResponse.status !== 404) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              const errorCode = retryErrorData.error_code || `HTTP_${retryResponse.status}`;
              const errorMessage = retryErrorData.error_message || retryErrorData.detail || retryResponse.statusText;
              callbacks.onError(errorCode, errorMessage);
              return;
            }

            if (retryResponse.status === 404) {
              console.warn('[WebHighlightService] Highlight not found on delete (already deleted), treating as success');
            }

            callbacks.onSuccess();
            return;
          } catch (refreshError) {
            console.error('[WebHighlightService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebHighlightService');
          return;
        }

        const errorCode = errorData.error_code || 'UNAUTHORIZED';
        const errorMessage = errorData.error_message || errorData.detail || 'Unauthorized';
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      // 404 = highlight already deleted; treat as soft success
      if (response.status === 404) {
        console.warn('[WebHighlightService] Highlight not found on delete (already deleted), treating as success');
        callbacks.onSuccess();
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebHighlightService');
          return;
        }

        const errorCode = errorData.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData.error_message || errorData.detail || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      // 204 No Content — success, do not read body
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
