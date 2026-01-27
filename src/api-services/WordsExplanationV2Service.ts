// src/api-services/WordsExplanationV2Service.ts
import { ENV } from '@/config/env';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';

export interface WordLocation {
  word: string;
  index: number;
  length: number;
}

export interface WordExplanationRequest {
  textStartIndex: number;
  text: string;
  important_words_location: WordLocation[];
  languageCode?: string;
}

export interface WordInfo {
  location: WordLocation;
  word: string;
  raw_response: string;
  meaning?: string;
  examples?: string[];
}

export interface WordExplanationCallbacks {
  onEvent: (wordInfo: WordInfo) => void;
  onComplete: () => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired: () => void;
  onSubscriptionRequired?: () => void;
}

export class WordsExplanationV2Service {
  private static readonly ENDPOINT = '/api/v2/words-explanation';

  /**
   * Get authorization headers if auth info exists
   */

  /**
   * Get word explanation using Server-Sent Events (SSE) streaming
   * @param word - The word to explain
   * @param context - Optional context text containing the word
   * @param languageCode - Optional language code for response language
   * @param callbacks - Callbacks for events
   * @param abortSignal - Optional abort signal for cancellation
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   */
  static async explainWord(
    word: string,
    context: string = '',
    languageCode: string | undefined,
    callbacks: WordExplanationCallbacks,
    abortSignal?: AbortSignal,
    timeoutMs: number = 30000
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;

    // Create abort controller for timeout if not provided
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    // Combine abort signals if external signal provided
    const combinedSignal = abortSignal
      ? this.combineAbortSignals([abortSignal, timeoutController.signal])
      : timeoutController.signal;

    try {
      // Prepare request body
      // Use context or just the word if no context provided
      const textToAnalyze = context || word;
      
      // Find word location in text
      const wordIndex = textToAnalyze.toLowerCase().indexOf(word.toLowerCase());
      const wordLocation: WordLocation = {
        word: word,
        index: wordIndex >= 0 ? wordIndex : 0,
        length: word.length,
      };

      const requestBody: WordExplanationRequest[] = [
        {
          textStartIndex: 0,
          text: textToAnalyze,
          important_words_location: [wordLocation],
          languageCode,
        },
      ];

      console.log('[WordsExplanationV2Service] Requesting word explanation:', {
        word,
        textLength: textToAnalyze.length,
        wordLocation,
      });

      // Make POST request with SSE
      const authHeaders = await ApiHeaders.getAuthHeaders('WordsExplanationV2Service');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...authHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Sync unauthenticated user ID from response headers (must be done before processing body)
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WordsExplanationV2Service');

      // Handle 401 errors with TOKEN_EXPIRED check
      if (response.status === 401) {
        const initialErrorData = await ApiResponseHandler.parseErrorResponse(response);
        
        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, initialErrorData)) {
          try {
            // Retry request with token refresh
            const retryResponse = await TokenRefreshRetry.retrySSERequestWithTokenRefresh(
              {
                url,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'text/event-stream',
                  ...authHeaders,
                },
                body: JSON.stringify(requestBody),
                signal: combinedSignal,
              },
              'WordsExplanationV2Service'
            );

            if (!retryResponse.ok) {
              const errorData = await ApiResponseHandler.parseErrorResponse(retryResponse);
              let errorMessage = 'Failed to get word explanation';
              
              // Check for LOGIN_REQUIRED in retry response
              if (retryResponse.status === 401 && ApiResponseHandler.checkLoginRequired(errorData, retryResponse.status)) {
                ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WordsExplanationV2Service');
                return;
              }
              
              errorMessage = errorData?.error_message || errorData?.message || errorMessage;
              callbacks.onError(retryResponse.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR', errorMessage);
              return;
            }
            
            if (!retryResponse.body) {
              callbacks.onError('NO_RESPONSE_BODY', 'No response body received');
              return;
            }
            
            // Process SSE stream from retry response
            const retryReader = retryResponse.body.getReader();
            const retryDecoder = new TextDecoder();
            let retryBuffer = '';
            
            while (true) {
              const { done, value } = await retryReader.read();
              
              if (done) break;
              
              retryBuffer += retryDecoder.decode(value, { stream: true });
              const retryLines = retryBuffer.split('\n');
              retryBuffer = retryLines.pop() || '';
              
              for (const line of retryLines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  
                  if (data === '[DONE]') {
                    console.log('[WordsExplanationV2Service] Retry stream completed');
                    callbacks.onComplete();
                    return;
                  }
                  
                  // Check if it's an error event (JSON format)
                  if (data.startsWith('{')) {
                    try {
                      const errorEvent = JSON.parse(data);
                      if (errorEvent.error_code && errorEvent.error_message) {
                        // Check for LOGIN_REQUIRED in SSE error events
                        const errorData = { error_code: errorEvent.error_code };
                        if (ApiResponseHandler.checkLoginRequired(errorData, 0)) {
                          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WordsExplanationV2Service');
                          return;
                        } else if (ApiResponseHandler.checkSubscriptionRequired(errorData, 0)) {
                          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'WordsExplanationV2Service');
                          return;
                        }
                        callbacks.onError(errorEvent.error_code, errorEvent.error_message);
                        return;
                      }
                    } catch {
                      // Not a JSON error event, treat as raw response
                    }
                  }
                  
                  // Parse the raw response format
                  const { meaning, examples } = this.parseRawResponse(data);
                  
                  console.log('[WordsExplanationV2Service] Parsed retry response:', { meaning, examples, rawData: data });
                  
                  if (meaning || examples.length > 0) {
                    const wordInfo: WordInfo = {
                      location: wordLocation,
                      word: word,
                      raw_response: data,
                      meaning,
                      examples,
                    };
                    
                    callbacks.onEvent(wordInfo);
                  }
                }
              }
            }
            return; // Exit after processing retry response
          } catch (refreshError) {
            console.error('[WordsExplanationV2Service] Token refresh failed:', refreshError);
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onLoginRequired();
            return;
          }
        }
        
        // Handle other 401 errors (LOGIN_REQUIRED, etc.)
        if (ApiResponseHandler.checkLoginRequired(initialErrorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WordsExplanationV2Service');
          return;
        }
        
        const errorText = await response.text();
        callbacks.onError('UNAUTHORIZED', errorText);
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        // Check for LOGIN_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WordsExplanationV2Service');
          return;
        }
        
        // Check for SUBSCRIPTION_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkSubscriptionRequired(errorData, response.status)) {
          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'WordsExplanationV2Service');
          return;
        }
        
        let errorMessage = 'Failed to get word explanation';
        if (errorData && typeof errorData === 'object') {
          errorMessage = errorData.error_message || errorData.message || errorMessage;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        callbacks.onError('API_ERROR', errorMessage);
        return;
      }

      if (!response.body) {
        callbacks.onError('NO_RESPONSE_BODY', 'No response body received');
        return;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              console.log('[WordsExplanationV2Service] Stream completed');
              callbacks.onComplete();
              return;
            }

            // The data is the raw_response string directly from the API
            // Format: [[[WORD_MEANING]]]:{meaning}[[[EXAMPLES]]]:{[[ITEM]]{example1}[[ITEM]]{example2}}
            
            // Check if it's an error event (JSON format)
            if (data.startsWith('{')) {
              try {
                const errorEvent = JSON.parse(data);
                if (errorEvent.error_code && errorEvent.error_message) {
                  // Check for LOGIN_REQUIRED in SSE error events
                  const errorData = { error_code: errorEvent.error_code };
                  if (ApiResponseHandler.checkLoginRequired(errorData, 0)) {
                    ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WordsExplanationV2Service');
                    return;
                  } else if (ApiResponseHandler.checkSubscriptionRequired(errorData, 0)) {
                    ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'WordsExplanationV2Service');
                    return;
                  }
                  callbacks.onError(errorEvent.error_code, errorEvent.error_message);
                  return;
                }
              } catch {
                // Not a JSON error event, treat as raw response
              }
            }

            // Parse the raw response format
            const { meaning, examples } = this.parseRawResponse(data);
            
            console.log('[WordsExplanationV2Service] Parsed response:', { meaning, examples, rawData: data });
            
            if (meaning || examples.length > 0) {
              // Create WordInfo object
              const wordInfo: WordInfo = {
                location: wordLocation,
                word: word,
                raw_response: data,
                meaning,
                examples,
              };
              
              console.log('[WordsExplanationV2Service] Received word info:', wordInfo);
              callbacks.onEvent(wordInfo);
            } else {
              console.warn('[WordsExplanationV2Service] Could not parse raw response:', data);
            }
          }
        }
      }

      // If we exit the loop without [DONE], still call onComplete
      console.log('[WordsExplanationV2Service] Stream ended without [DONE]');
      callbacks.onComplete();
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Check if it was a timeout or external abort
          if (timeoutController.signal.aborted) {
            callbacks.onError('TIMEOUT', 'Request timed out after 30 seconds');
          } else {
            callbacks.onError('ABORTED', 'Request was cancelled');
          }
        } else {
          callbacks.onError('NETWORK_ERROR', error.message);
        }
      } else {
        callbacks.onError('UNKNOWN_ERROR', 'An unknown error occurred');
      }
    }
  }

  /**
   * Combine multiple abort signals into one
   */
  private static combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }

      signal.addEventListener('abort', () => {
        controller.abort();
      });
    }

    return controller.signal;
  }

  /**
   * Parse raw_response from API to extract meaning and examples
   * Format: [[[WORD_MEANING]]]:{...}[[[EXAMPLES]]]:{[[ITEM]]{...}[[ITEM]]{...}}
   */
  static parseRawResponse(rawResponse: string): {
    meaning: string;
    examples: string[];
  } {
    try {
      console.log('[WordsExplanationV2Service] Parsing raw response:', rawResponse);
      
      // Extract meaning - match everything between [[[WORD_MEANING]]]:{  and  }[[[EXAMPLES]]]
      const meaningMatch = rawResponse.match(/\[\[\[WORD_MEANING\]\]\]:\{([^}]*)\}/);
      const meaning = meaningMatch ? meaningMatch[1].trim() : '';
      
      console.log('[WordsExplanationV2Service] Extracted meaning:', meaning);

      // Extract examples - match everything between [[[EXAMPLES]]]:{  and the final }
      const examplesMatch = rawResponse.match(/\[\[\[EXAMPLES\]\]\]:\{(.*)\}$/);
      const examples: string[] = [];

      if (examplesMatch) {
        const examplesContent = examplesMatch[1];
        console.log('[WordsExplanationV2Service] Examples content:', examplesContent);
        
        // Match all [[ITEM]]{...} patterns
        const itemMatches = examplesContent.matchAll(/\[\[ITEM\]\]\{([^}]+)\}/g);

        for (const itemMatch of itemMatches) {
          const example = itemMatch[1].trim();
          if (example) {
            examples.push(example);
            console.log('[WordsExplanationV2Service] Extracted example:', example);
          }
        }
      }

      console.log('[WordsExplanationV2Service] Parse result:', { meaning, examples });
      return { meaning, examples };
    } catch (error) {
      console.error('[WordsExplanationV2Service] Failed to parse raw_response:', error, rawResponse);
      return { meaning: '', examples: [] };
    }
  }
}

