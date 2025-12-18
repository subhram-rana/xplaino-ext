// src/api-services/ApiService.ts

/**
 * Central class for all API calls
 * All API operations must go through this class
 */
export class ApiService {
  // ============================================
  // CONFIGURATION
  // ============================================

  private static readonly BASE_URL = 'https://api.example.com';

  // ============================================
  // GENERIC REQUEST METHODS
  // ============================================

  /**
   * Generic request handler with error handling
   * @param endpoint - API endpoint (will be appended to BASE_URL)
   * @param options - Fetch options
   * @returns Promise resolving to response data
   * @throws Error on non-OK response
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.BASE_URL}${endpoint}`;

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
      const errorBody = await response.text();
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
   */
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
   */
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
   */
  private static async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Get auth token from storage
   */
  private static async getAuthToken(): Promise<string | null> {
    // Import dynamically to avoid circular dependencies
    const { ChromeStorage } = await import(
      '@/storage/chrome-local/ChromeStorage'
    );
    return ChromeStorage.getAuthToken();
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

