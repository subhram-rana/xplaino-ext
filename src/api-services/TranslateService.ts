// src/api-services/TranslateService.ts
// Service for translation API

import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { TokenRefreshService } from './TokenRefreshService';

// Types
export interface TranslateRequest {
  targetLangugeCode: string; // Note: API uses "Languge" (typo) not "Language"
  texts: string[];
}

export interface TranslateResponse {
  targetLangugeCode: string;
  translatedTexts: string[];
}

export interface TranslateCallbacks {
  onSuccess: (translatedTexts: string[]) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired: () => void;
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
 * Convert language display name to ISO 639-1 code
 */
export function getLanguageCode(languageName: string): string | null {
  return LANGUAGE_CODE_MAP[languageName] || null;
}

/**
 * Service for handling translation API calls
 */
export class TranslateService {
  private static readonly ENDPOINT = '/api/v2/translate';

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
   * Translate texts to target language
   */
  static async translate(
    request: TranslateRequest,
    callbacks: TranslateCallbacks,
    abortController?: AbortController
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const authHeaders = await this.getAuthHeaders();

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

      // Handle 401 errors
      if (response.status === 401) {
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        const errorData = await responseClone.json().catch(() => ({}));
        
        // Check for TOKEN_EXPIRED error code
        if (TokenRefreshService.isTokenExpiredError(response.status, errorData)) {
          console.log('[TranslateService] Token expired, attempting refresh');
          
          try {
            // Refresh the token and get the new access token directly
            const refreshResponse = await TokenRefreshService.refreshAccessToken();
            
            // Retry the request with new token directly from refresh response
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
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

            // If retry successful, parse response
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              callbacks.onError('HTTP_ERROR', `HTTP ${retryResponse.status}: ${errorText}`);
              return;
            }

            // Parse successful response
            const responseData = await retryResponse.json() as TranslateResponse;
            callbacks.onSuccess(responseData.translatedTexts);
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

      // Parse successful response
      const responseData = await response.json() as TranslateResponse;
      callbacks.onSuccess(responseData.translatedTexts);
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

