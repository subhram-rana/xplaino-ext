// src/api-services/TranslateService.ts
// Service for translation API

import { ENV } from '@/config/env';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
import { ChromeTranslatorService, toBcp47 } from './ChromeTranslatorService';

// Types
export interface TranslateTextItem {
  id: string;
  text: string;
}

export interface TranslateRequest {
  targetLangugeCode: string; // Note: API uses "Languge" (typo) not "Language"
  texts: TranslateTextItem[];
}

export interface TranslateCallbacks {
  onSuccess: (translatedTexts: string[]) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired: () => void;
  onSubscriptionRequired?: () => void;
  onProgress?: (index: number, translatedText: string) => void;
}

/**
 * Language name to ISO 639-1 code mapping
 */
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'English': 'EN',
  'Español': 'ES',
  'Français': 'FR',
  'Deutsch': 'DE',
  'Italiano': 'IT',
  'Português': 'PT',
  'Русский': 'RU',
  '中文': 'ZH',
  '日本語': 'JA',
  '한국어': 'KO',
  'العربية': 'AR',
  'हिन्दी': 'HI',
  'Nederlands': 'NL',
  'Türkçe': 'TR',
  'Polski': 'PL',
  'Svenska': 'SV',
  'Norsk': 'NO',
  'Dansk': 'DA',
  'Suomi': 'FI',
  'Ελληνικά': 'EL',
  'Čeština': 'CS',
  'Magyar': 'HU',
  'Română': 'RO',
  'Български': 'BG',
  'Hrvatski': 'HR',
  'Srpski': 'SR',
  'Slovenčina': 'SK',
  'Slovenščina': 'SL',
  'Українська': 'UK',
  'עברית': 'HE',
  'فارسی': 'FA',
  'اردو': 'UR',
  'বাংলা': 'BN',
  'தமிழ்': 'TA',
  'తెలుగు': 'TE',
  'मराठी': 'MR',
  'ગુજરાતી': 'GU',
  'ಕನ್ನಡ': 'KN',
  'മലയാളം': 'ML',
  'ਪੰਜਾਬੀ': 'PA',
  'ଓଡ଼ିଆ': 'OR',
  'नेपाली': 'NE',
  'සිංහල': 'SI',
  'ไทย': 'TH',
  'Tiếng Việt': 'VI',
  'Bahasa Indonesia': 'ID',
  'Bahasa Melayu': 'MS',
  'Filipino': 'TL',
  'Tagalog': 'TL',
  'မြန်မာ': 'MY',
  'ភាសាខ្មែរ': 'KM',
  'Lao': 'LO',
  'Монгол': 'MN',
  'ქართული': 'KA',
  'Հայերեն': 'HY',
  'Azərbaycan': 'AZ',
  'Қазақ': 'KK',
  'Oʻzbek': 'UZ',
  'Türkmen': 'TK',
  'Kyrgyz': 'KY',
  'Afrikaans': 'AF',
  'Swahili': 'SW',
  'Zulu': 'ZU',
  'Xhosa': 'XH',
  'Amharic': 'AM',
  'Yoruba': 'YO',
  'Igbo': 'IG',
  'Hausa': 'HA',
};

/**
 * Reverse mapping: ISO 639-1 code to language name
 * Generated from LANGUAGE_CODE_MAP
 */
const CODE_TO_LANGUAGE_MAP: Record<string, string> = Object.entries(LANGUAGE_CODE_MAP).reduce(
  (acc, [languageName, code]) => {
    // Handle duplicate codes (e.g., 'Filipino' and 'Tagalog' both map to 'TL')
    // Keep the first occurrence
    if (!acc[code]) {
      acc[code] = languageName;
    }
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Convert language display name to ISO 639-1 code
 * Also handles cases where the input is already a language code
 */
export function getLanguageCode(languageName: string): string | null {
  // If input is already a valid 2-letter uppercase code (from backend API), return it
  if (languageName && languageName.length === 2 && languageName === languageName.toUpperCase()) {
    // Verify it's a valid code by checking if it exists in the map values
    const validCodes = Object.values(LANGUAGE_CODE_MAP);
    if (validCodes.includes(languageName)) {
      return languageName;
    }
  }
  
  // Otherwise, look up the language name in the map
  return LANGUAGE_CODE_MAP[languageName] || null;
}

/**
 * Convert ISO 639-1 code to language display name
 * @param languageCode - Two-letter language code (e.g., 'OR', 'HI', 'EN')
 * @returns Language name (e.g., 'ଓଡ଼ିଆ', 'हिन्दी', 'English') or null if not found
 */
export function getLanguageName(languageCode: string): string | null {
  if (!languageCode) return null;
  
  // Normalize to uppercase for lookup
  const normalizedCode = languageCode.toUpperCase();
  
  return CODE_TO_LANGUAGE_MAP[normalizedCode] || null;
}

/**
 * Service for handling translation API calls
 */
export class TranslateService {
  private static readonly ENDPOINT = '/api/v2/translate';


  /**
   * Parse SSE stream and process translation events
   */
  private static async processSSEStream(
    response: Response,
    request: TranslateRequest,
    callbacks: TranslateCallbacks,
    abortController?: AbortController
  ): Promise<void> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      callbacks.onError('STREAM_ERROR', 'Failed to get response reader');
      return;
    }

    // Map to store translations by ID
    const translationsMap = new Map<string, string>();
    // Create ID to index mapping for onProgress callbacks
    const idToIndexMap = new Map<string, number>();
    request.texts.forEach((item, index) => {
      idToIndexMap.set(item.id, index);
    });
    
    let buffer = '';

    try {
      while (true) {
        // Check if aborted
        if (abortController?.signal.aborted) {
          reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // SSE format: "data: {json}\n"
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove "data: " prefix

            // Check for completion event
            if (data === '[DONE]') {
              // All translations received, call success callback with ordered results
              const orderedTranslations: string[] = request.texts.map(item => 
                translationsMap.get(item.id) || ''
              );
              callbacks.onSuccess(orderedTranslations);
              return;
            }

            try {
              const event = JSON.parse(data);

              // Handle error events
              if (event.type === 'error') {
                callbacks.onError(
                  event.error_code || 'STREAM_ERROR',
                  event.error_message || 'Unknown streaming error'
                );
                return;
              }

              // Handle translation result
              if (event.id && event.translatedText !== undefined) {
                translationsMap.set(event.id, event.translatedText);
                
                // Call onProgress callback if provided
                if (callbacks.onProgress) {
                  const index = idToIndexMap.get(event.id);
                  if (index !== undefined) {
                    callbacks.onProgress(index, event.translatedText);
                  }
                }
              }
            } catch (parseError) {
              console.error('[TranslateService] Failed to parse SSE event:', parseError, data);
              // Continue processing other events
            }
          }
        }
      }

      // If we reach here without [DONE], return what we have
      const orderedTranslations: string[] = request.texts.map(item => 
        translationsMap.get(item.id) || ''
      );
      callbacks.onSuccess(orderedTranslations);
    } catch (streamError) {
      if (streamError instanceof Error && streamError.name === 'AbortError') {
        // Request was aborted, don't call error callback
        return;
      }
      callbacks.onError('STREAM_ERROR', `Stream processing error: ${streamError}`);
    }
  }

  /**
   * Translate texts to target language with SSE streaming
   */
  static async translate(
    request: TranslateRequest,
    callbacks: TranslateCallbacks,
    abortController?: AbortController
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('TranslateService');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(request),
        signal: abortController?.signal,
        credentials: 'include',
      });

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'TranslateService');

      // Handle 401 errors
      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        // Check for TOKEN_EXPIRED error code
        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            // Retry request with token refresh
            const retryResponse = await TokenRefreshRetry.retrySSERequestWithTokenRefresh(
              {
                url,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...authHeaders,
                },
                body: JSON.stringify(request),
                signal: abortController?.signal,
                credentials: 'include',
              },
              'TranslateService'
            );

            // Handle 401 errors on retry
            if (retryResponse.status === 401) {
              const retryErrorData = await ApiResponseHandler.parseErrorResponse(retryResponse);
              if (ApiResponseHandler.checkLoginRequired(retryErrorData, retryResponse.status)) {
                ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'TranslateService');
                return;
              }
              callbacks.onError('AUTH_ERROR', 'Authentication failed');
              return;
            }

            // If retry successful, process SSE stream
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              callbacks.onError('HTTP_ERROR', `HTTP ${retryResponse.status}: ${errorText}`);
              return;
            }

            // Process SSE stream from retry response
            await this.processSSEStream(retryResponse, request, callbacks, abortController);
            return;
          } catch (refreshError) {
            console.error('[TranslateService] Token refresh failed:', refreshError);
            // Handle refresh failure
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onLoginRequired();
            return;
          }
        }
        
        // Handle other 401 errors (LOGIN_REQUIRED, etc.)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'TranslateService');
          return;
        }
        callbacks.onError('AUTH_ERROR', 'Authentication failed');
        return;
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        
        // Check for LOGIN_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'TranslateService');
          return;
        }
        
        // Check for SUBSCRIPTION_REQUIRED in error response body (regardless of status code)
        if (ApiResponseHandler.checkSubscriptionRequired(errorData, response.status)) {
          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'TranslateService');
          return;
        }
        
        const errorText = await response.text();
        callbacks.onError('HTTP_ERROR', `HTTP ${response.status}: ${errorText}`);
        return;
      }

      // Process SSE stream from successful response
      await this.processSSEStream(response, request, callbacks, abortController);
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

// ---------------------------------------------------------------------------
// Unified translation helper – Chrome Translator API first, backend fallback
// ---------------------------------------------------------------------------

/** Timeout (ms) for the Chrome Translator API path before falling back. */
const CHROME_API_TIMEOUT_MS = 15_000;

/**
 * Try the Chrome built-in Translator API first.  If the browser does not
 * support it, the requested language pair is unavailable, or the call takes
 * longer than `CHROME_API_TIMEOUT_MS`, fall back to the backend SSE endpoint
 * transparently.
 *
 * The callback interface is identical to `TranslateService.translate()` so
 * callers can swap in this function without any other changes.
 */
export async function translateWithFallback(
  request: TranslateRequest,
  callbacks: TranslateCallbacks,
  abortController?: AbortController,
): Promise<void> {
  console.log('[translateWithFallback] Called. Texts count:', request.texts.length,
    'Target:', request.targetLangugeCode);

  // --- 1. Check if Chrome Translator API is available (direct or via bridge) ---
  const chromeAvailable = await ChromeTranslatorService.ensureAvailable();
  console.log('[translateWithFallback] Chrome Translator API available:', chromeAvailable);

  if (chromeAvailable) {
    try {
      // Detect page source language (best-effort)
      const sampleText = request.texts[0]?.text ?? '';
      const sourceLang = await ChromeTranslatorService.detectSourceLanguage(sampleText);
      const targetBcp47 = toBcp47(request.targetLangugeCode);
      console.log('[translateWithFallback] Source lang:', sourceLang, 'Target BCP47:', targetBcp47);

      // Check language pair support
      const availability = await ChromeTranslatorService.checkLanguagePair(
        sourceLang,
        targetBcp47,
      );
      console.log('[translateWithFallback] Language pair availability:', availability);

      if (availability !== 'unavailable') {
        console.log('[translateWithFallback] Using Chrome Translator API');

        // Race the Chrome API against a timeout to avoid blocking forever
        // (e.g. if a language pack download stalls)
        const chromeTranslateResult = await Promise.race([
          (async (): Promise<'success'> => {
            const results: string[] = [];

            for (let i = 0; i < request.texts.length; i++) {
              // Respect abort signal
              if (abortController?.signal.aborted) return 'success';

              const translated = await ChromeTranslatorService.translate(
                request.texts[i].text,
                targetBcp47,
                sourceLang,
              );
              results.push(translated);
              callbacks.onProgress?.(i, translated);
            }

            callbacks.onSuccess(results);
            return 'success';
          })(),
          new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), CHROME_API_TIMEOUT_MS),
          ),
        ]);

        if (chromeTranslateResult === 'success') {
          console.log('[translateWithFallback] Chrome API translation completed successfully');
          return;
        }

        // Timeout – fall through to backend
        console.warn(
          `[translateWithFallback] Chrome API timed out after ${CHROME_API_TIMEOUT_MS}ms, falling back to backend`,
        );
      } else {
        console.log('[translateWithFallback] Language pair unavailable in Chrome API, using backend');
      }
    } catch (err) {
      // Chrome API failed at some point – fall through to backend
      console.warn(
        '[translateWithFallback] Chrome Translator API failed, falling back to backend:',
        err,
      );
    }
  } else {
    console.log('[translateWithFallback] Chrome Translator API NOT available in this context, using backend');
  }

  // --- 2. Fallback: backend SSE translation ---
  console.log('[translateWithFallback] Falling back to backend TranslateService');
  await TranslateService.translate(request, callbacks, abortController);
}

