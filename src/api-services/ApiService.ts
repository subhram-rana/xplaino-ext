// src/api-services/ApiService.ts

import type { GetAllDomainsResponseDTO } from './dto/DomainDTO';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { TokenRefreshService } from './TokenRefreshService';
import { ApiErrorHandler } from './ApiErrorHandler';
import { ENV } from '@/config/env';

/**
 * Central class for all API calls
 * All API operations must go through this class
 */
export class ApiService {
  // ============================================
  // CONFIGURATION
  // ============================================

  private static readonly BASE_URL = ENV.API_BASE_URL;

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

    // Add unauthenticated user ID if available (always send, even when authenticated)
    const unauthenticatedUserId = await ChromeStorage.getUnauthenticatedUserId();
    if (unauthenticatedUserId) {
      (defaultHeaders as Record<string, string>)['X-Unauthenticated-User-Id'] =
        unauthenticatedUserId;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    // Check for and store X-Unauthenticated-User-Id from response headers
    const responseUnauthenticatedUserId = response.headers.get('X-Unauthenticated-User-Id');
    if (responseUnauthenticatedUserId) {
      await ChromeStorage.setUnauthenticatedUserId(responseUnauthenticatedUserId);
      console.log('[ApiService] Stored unauthenticated user ID:', responseUnauthenticatedUserId);
    }

    if (!response.ok) {
      // Check for 401 errors
      if (response.status === 401) {
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

          // Check for LOGIN_REQUIRED error code (supports multiple response formats)
          if (
            errorBody &&
            (errorBody.errorCode === 'LOGIN_REQUIRED' ||
              (typeof errorBody.detail === 'object' && errorBody.detail?.errorCode === 'LOGIN_REQUIRED'))
          ) {
            console.log('[ApiService] LOGIN_REQUIRED error detected, triggering login modal');
            ApiErrorHandler.triggerLoginRequired();
            throw new Error('Login required');
          }

          // Check for token expiration (only retry if retryOnTokenExpired is true)
          if (retryOnTokenExpired && TokenRefreshService.isTokenExpiredError(response.status, errorBody)) {
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

              // Check for and store X-Unauthenticated-User-Id from retry response headers
              const retryResponseUnauthUserId = retryResponse.headers.get('X-Unauthenticated-User-Id');
              if (retryResponseUnauthUserId) {
                await ChromeStorage.setUnauthenticatedUserId(retryResponseUnauthUserId);
                console.log('[ApiService] Stored unauthenticated user ID from retry:', retryResponseUnauthUserId);
              }

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
          // If it's the "Login required" error we threw, re-throw it
          if (parseError instanceof Error && parseError.message === 'Login required') {
            throw parseError;
          }
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

