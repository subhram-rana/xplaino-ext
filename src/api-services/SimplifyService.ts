// src/api-services/SimplifyService.ts
// Service for text simplification API with SSE streaming

import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { TokenRefreshService } from './TokenRefreshService';

// Types
export interface SimplifyRequest {
  textStartIndex: number;
  textLength: number;
  text: string;
  previousSimplifiedTexts: string[];
  context?: string;
  languageCode?: string;
}

export interface SimplifyChunkEvent {
  chunk: string;
  accumulatedSimplifiedText: string;
  textStartIndex: number;
  textLength: number;
  text: string;
  previousSimplifiedTexts: string[];
}

export interface SimplifyCompleteEvent {
  type: 'complete';
  textStartIndex: number;
  textLength: number;
  text: string;
  previousSimplifiedTexts: string[];
  simplifiedText: string;
  shouldAllowSimplifyMore: boolean;
  possibleQuestions?: string[];
}

export interface SimplifyErrorEvent {
  type: 'error';
  error_code: string;
  error_message: string;
}

export type SimplifyEvent = SimplifyChunkEvent | SimplifyCompleteEvent | SimplifyErrorEvent;

export interface SimplifyCallbacks {
  onChunk: (chunk: string, accumulated: string) => void;
  onComplete: (simplifiedText: string, shouldAllowSimplifyMore: boolean, possibleQuestions: string[]) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired: () => void;
}

/**
 * Service for handling text simplification API calls with SSE streaming
 */
export class SimplifyService {
  private static readonly ENDPOINT = '/api/v2/simplify';

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
   * Simplify text with SSE streaming
   */
  static async simplify(
    request: SimplifyRequest[],
    callbacks: SimplifyCallbacks,
    abortController?: AbortController
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await this.getAuthHeaders();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...authHeaders,
        },
        body: JSON.stringify(request),
        signal: abortController?.signal,
        credentials: 'include',
      });

      // Handle 401 errors
      if (response.status === 401) {
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        const errorData = await responseClone.json().catch(() => ({}));
        
        // Check for TOKEN_EXPIRED error code
        if (TokenRefreshService.isTokenExpiredError(response.status, errorData)) {
          console.log('[SimplifyService] Token expired, attempting refresh');
          
          try {
            // Refresh the token and get the new access token directly
            const refreshResponse = await TokenRefreshService.refreshAccessToken();
            
            // Retry the request with new token directly from refresh response
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'Authorization': `Bearer ${refreshResponse.accessToken}`,
              },
              body: JSON.stringify(request),
              signal: abortController?.signal,
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

            // If retry successful, continue with SSE stream processing
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              callbacks.onError('HTTP_ERROR', `HTTP ${retryResponse.status}: ${errorText}`);
              return;
            }

            // Process SSE stream from retry response
            const reader = retryResponse.body?.getReader();
            if (!reader) {
              callbacks.onError('STREAM_ERROR', 'Failed to get response reader');
              return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              
              // Process complete SSE events
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  
                  // Check for done signal
                  if (data === '[DONE]') {
                    continue;
                  }

                  try {
                    const event = JSON.parse(data) as SimplifyEvent;
                    
                    // Handle different event types
                    if ('type' in event) {
                      if (event.type === 'complete') {
                        callbacks.onComplete(
                          event.simplifiedText,
                          event.shouldAllowSimplifyMore,
                          event.possibleQuestions || []
                        );
                      } else if (event.type === 'error') {
                        if (event.error_code === 'LOGIN_REQUIRED') {
                          callbacks.onLoginRequired();
                        } else {
                          callbacks.onError(event.error_code, event.error_message);
                        }
                      }
                    } else if ('chunk' in event && 'accumulatedSimplifiedText' in event) {
                      // Chunk event
                      callbacks.onChunk(event.chunk, event.accumulatedSimplifiedText);
                    }
                  } catch (parseError) {
                    console.error('[SimplifyService] Failed to parse SSE event:', data, parseError);
                  }
                }
              }
            }
            return; // Successfully processed retry response
          } catch (refreshError) {
            console.error('[SimplifyService] Token refresh failed:', refreshError);
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

      // Handle SSE streaming
      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError('STREAM_ERROR', 'Failed to get response reader');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            // Check for done signal
            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data) as SimplifyEvent;
              
              // Handle different event types
              if ('type' in event) {
                if (event.type === 'complete') {
                  callbacks.onComplete(
                    event.simplifiedText,
                    event.shouldAllowSimplifyMore,
                    event.possibleQuestions || []
                  );
                } else if (event.type === 'error') {
                  if (event.error_code === 'LOGIN_REQUIRED') {
                    callbacks.onLoginRequired();
                  } else {
                    callbacks.onError(event.error_code, event.error_message);
                  }
                }
              } else if ('chunk' in event && 'accumulatedSimplifiedText' in event) {
                // Chunk event
                callbacks.onChunk(event.chunk, event.accumulatedSimplifiedText);
              }
            } catch (parseError) {
              console.error('[SimplifyService] Failed to parse SSE event:', data, parseError);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Request was aborted, don't call error callback
          return;
        }
        callbacks.onError('NETWORK_ERROR', error.message);
      } else {
        callbacks.onError('UNKNOWN_ERROR', 'An unknown error occurred');
      }
    }
  }
}



