// src/api-services/ApiService.ts

import type { GetAllDomainsResponseDTO } from './dto/DomainDTO';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { TokenRefreshService } from './TokenRefreshService';

/**
 * Central class for all API calls
 * All API operations must go through this class
 */
export class ApiService {
  // ============================================
  // CONFIGURATION
  // ============================================

  // TODO: Update this to your actual API URL
  // For local development: 'http://localhost:8000'
  // For production: 'https://api.xplaino.com'
  private static readonly BASE_URL = 'http://localhost:8000';

  // ============================================
  // GENERIC REQUEST METHODS
  // ============================================

  /**
   * Generic request handler with error handling
   * @param endpoint - API endpoint (will be appended to BASE_URL)
   * @param options - Fetch options
   * @param retryOnTokenExpired - Whether to retry on token expiration (default: true)
   * @returns Promise resolving to response data
   * @throws Error on non-OK response
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOnTokenExpired: boolean = true
  ): Promise<T> {
    const url = `${this.BASE_URL}${endpoint}`;

    // Don't retry on token refresh endpoint itself to avoid infinite loops
    if (endpoint.includes('/api/auth/refresh-token')) {
      retryOnTokenExpired = false;
    }

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    const token = await this.getAuthToken();
    if (token) {
      (defaultHeaders as Record<string, string>)['Authorization'] =
        `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Check for token expiration
      if (response.status === 401 && retryOnTokenExpired) {
        try {
          // Clone response to read body without consuming it
          const responseClone = response.clone();
          const errorBodyText = await responseClone.text();
          let errorBody: any;
          try {
            errorBody = JSON.parse(errorBodyText);
          } catch {
            errorBody = errorBodyText;
          }

          if (TokenRefreshService.isTokenExpiredError(response.status, errorBody)) {
            console.log('[ApiService] Token expired, attempting refresh');
            
            try {
              // Refresh the token and get the new access token directly
              const refreshResponse = await TokenRefreshService.refreshAccessToken();
              
              // Retry the original request with new token directly from refresh response
              const newHeaders: HeadersInit = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${refreshResponse.accessToken}`,
              };

              const retryResponse = await fetch(url, {
                ...options,
                headers: {
                  ...newHeaders,
                  ...options.headers,
                },
              });

              if (!retryResponse.ok) {
                const retryErrorBody = await retryResponse.text();
                throw new Error(
                  `API Error: ${retryResponse.status} ${retryResponse.statusText} - ${retryErrorBody}`
                );
              }

              return retryResponse.json();
            } catch (refreshError) {
              console.error('[ApiService] Token refresh failed:', refreshError);
              // Handle refresh failure
              await TokenRefreshService.handleTokenRefreshFailure();
              throw new Error(
                `API Error: ${response.status} ${response.statusText} - Token refresh failed`
              );
            }
          }
        } catch (parseError) {
          console.error('[ApiService] Error parsing 401 response:', parseError);
        }
      }

      // If not token expiration or refresh failed, throw original error
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    return response.json();
  }

  /**
   * GET request helper
   */
  private static async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request helper
   * Reserved for future API calls
   */
  // @ts-ignore - Reserved for future use
  private static async post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request helper
   * Reserved for future API calls
   */
  // @ts-ignore - Reserved for future use
  private static async put<TRequest, TResponse>(
    endpoint: string,
    data: TRequest
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request helper
   * Reserved for future API calls
   */
  // @ts-ignore - Reserved for future use
  private static async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Get auth token from XPLAINO_AUTH_INFO
   * Returns accessToken from the auth info object stored after login
   */
  private static async getAuthToken(): Promise<string | null> {
    const authInfo = await ChromeStorage.getAuthInfo();
    return authInfo?.accessToken || null;
  }

  // ============================================
  // API METHODS
  // Add all API calls here with proper typing
  // ============================================

  // Placeholder methods - implement with actual DTOs as needed

  /**
   * Example health check endpoint
   */
  static async healthCheck(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/health');
  }

  /**
   * Get all domains
   * API Endpoint: GET /api/domain/
   * Note: This endpoint requires authentication (returns 401 if not logged in)
   * @returns Promise resolving to domains response
   */
  static async getAllDomains(): Promise<GetAllDomainsResponseDTO> {
    return this.get<GetAllDomainsResponseDTO>('/api/domain/');
  }
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

