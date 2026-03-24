// src/api-services/WebNoteService.ts
// Service for managing web notes (browser extension notes on text selections).
// Follows the exact same pattern as WebHighlightService.ts.
// Note: the backend returns 200 with null/empty for unauthenticated requests
// instead of 401, so no login-required handling is needed in most flows.

import { ENV } from '@/config/env';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
import type {
  CreateWebNoteRequest,
  GetWebNotesResponse,
  WebNoteWriteResponse,
} from './dto/WebNoteDTO';

export interface GetNotesCallbacks {
  onSuccess: (response: GetWebNotesResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
}

export interface WriteNoteCallbacks {
  onSuccess: (response: WebNoteWriteResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired?: () => void;
}

export interface DeleteNoteCallbacks {
  onSuccess: () => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired?: () => void;
}

export class WebNoteService {
  private static readonly ENDPOINT = '/api/web-notes';

  /**
   * Fetch all notes for the authenticated user on a specific page URL.
   * Returns empty list when unauthenticated (backend returns 200 with []).
   */
  static async getWebNotes(
    pageUrl: string,
    callbacks: GetNotesCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const encodedUrl = encodeURIComponent(pageUrl);
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}?url=${encodedUrl}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebNoteService');

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        signal: abortSignal,
        credentials: 'include',
      });

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebNoteService');

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        callbacks.onError(
          errorData.error_code || `HTTP_${response.status}`,
          errorData.error_message || errorData.detail || response.statusText
        );
        return;
      }

      const data: GetWebNotesResponse = await response.json();
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
   * Create a new web note.
   * When unauthenticated the backend returns 200 { note: null } — onSuccess is
   * called with that null note so the caller can handle it gracefully.
   */
  static async createNote(
    request: CreateWebNoteRequest,
    callbacks: WriteNoteCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebNoteService');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(request),
        signal: abortSignal,
        credentials: 'include',
      });

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebNoteService');

      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            const retryResponse = await TokenRefreshRetry.retryRequestWithTokenRefresh(
              {
                url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify(request),
                signal: abortSignal,
                credentials: 'include',
              },
              'WebNoteService'
            );

            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              callbacks.onError(
                retryErrorData.error_code || `HTTP_${retryResponse.status}`,
                retryErrorData.error_message || retryErrorData.detail || retryResponse.statusText
              );
              return;
            }

            const data: WebNoteWriteResponse = await retryResponse.json();
            callbacks.onSuccess(data);
            return;
          } catch (refreshError) {
            console.error('[WebNoteService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebNoteService');
          return;
        }

        callbacks.onError(
          errorData.error_code || 'UNAUTHORIZED',
          errorData.error_message || errorData.detail || 'Unauthorized'
        );
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebNoteService');
          return;
        }

        callbacks.onError(
          errorData.error_code || `HTTP_${response.status}`,
          errorData.error_message || errorData.detail || response.statusText
        );
        return;
      }

      const data: WebNoteWriteResponse = await response.json();
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
   * Update the content of an existing note (PATCH).
   * 404 → note was deleted elsewhere; caller should clean up and treat as error.
   */
  static async updateNote(
    noteId: string,
    content: string,
    callbacks: WriteNoteCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}/${noteId}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebNoteService');
    const body = JSON.stringify({ content });

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body,
        signal: abortSignal,
        credentials: 'include',
      });

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebNoteService');

      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            const retryResponse = await TokenRefreshRetry.retryRequestWithTokenRefresh(
              {
                url,
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body,
                signal: abortSignal,
                credentials: 'include',
              },
              'WebNoteService'
            );

            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              callbacks.onError(
                retryErrorData.error_code || `HTTP_${retryResponse.status}`,
                retryErrorData.error_message || retryErrorData.detail || retryResponse.statusText
              );
              return;
            }

            const data: WebNoteWriteResponse = await retryResponse.json();
            callbacks.onSuccess(data);
            return;
          } catch (refreshError) {
            console.error('[WebNoteService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebNoteService');
          return;
        }

        callbacks.onError(
          errorData.error_code || 'UNAUTHORIZED',
          errorData.error_message || errorData.detail || 'Unauthorized'
        );
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebNoteService');
          return;
        }

        callbacks.onError(
          errorData.error_code || `HTTP_${response.status}`,
          errorData.error_message || errorData.detail || response.statusText
        );
        return;
      }

      const data: WebNoteWriteResponse = await response.json();
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
   * Delete a web note by ID.
   * 204 No Content on success. 404 is treated as a soft success.
   * Unauthenticated requests return 200 — treated as success (nothing to delete).
   */
  static async deleteNote(
    noteId: string,
    callbacks: DeleteNoteCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}/${noteId}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebNoteService');

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { ...authHeaders },
        signal: abortSignal,
        credentials: 'include',
      });

      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebNoteService');

      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            const retryResponse = await TokenRefreshRetry.retryRequestWithTokenRefresh(
              {
                url,
                method: 'DELETE',
                headers: { ...authHeaders },
                signal: abortSignal,
                credentials: 'include',
              },
              'WebNoteService'
            );

            if (!retryResponse.ok && retryResponse.status !== 404) {
              const retryErrorData = await retryResponse.json().catch(() => ({}));
              callbacks.onError(
                retryErrorData.error_code || `HTTP_${retryResponse.status}`,
                retryErrorData.error_message || retryErrorData.detail || retryResponse.statusText
              );
              return;
            }

            if (retryResponse.status === 404) {
              console.warn('[WebNoteService] Note not found on delete (already deleted), treating as success');
            }
            callbacks.onSuccess();
            return;
          } catch (refreshError) {
            console.error('[WebNoteService] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onError('AUTH_ERROR', 'Token refresh failed');
            return;
          }
        }

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebNoteService');
          return;
        }

        callbacks.onError(
          errorData.error_code || 'UNAUTHORIZED',
          errorData.error_message || errorData.detail || 'Unauthorized'
        );
        return;
      }

      // 404 = note already deleted; treat as soft success
      if (response.status === 404) {
        console.warn('[WebNoteService] Note not found on delete (already deleted), treating as success');
        callbacks.onSuccess();
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebNoteService');
          return;
        }

        callbacks.onError(
          errorData.error_code || `HTTP_${response.status}`,
          errorData.error_message || errorData.detail || response.statusText
        );
        return;
      }

      // 204 No Content or 200 (unauthenticated) — success, never read body
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
