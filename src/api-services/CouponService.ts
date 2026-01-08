// src/api-services/CouponService.ts
// Service for fetching coupon information

import { ENV } from '@/config/env';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { GetActiveHighlightedCouponResponse } from './dto/CouponDTO';

// Callbacks
export interface GetActiveHighlightedCouponCallbacks {
  onSuccess: (response: GetActiveHighlightedCouponResponse) => void;
  onError: (errorCode: string, errorMessage: string) => void;
}

/**
 * Service for fetching coupon information
 */
export class CouponService {
  private static readonly ENDPOINT = '/api/coupon/active-highlighted';

  /**
   * Get the currently active highlighted coupon
   * Note: This endpoint does not require authentication
   */
  static async getActiveHighlightedCoupon(
    callbacks: GetActiveHighlightedCouponCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    // Even though endpoint doesn't require auth, we include headers for consistency
    const authHeaders = await ApiHeaders.getAuthHeaders('CouponService');

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

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'CouponService');

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        const errorCode = errorData.error_code || `HTTP_${response.status}`;
        const errorMessage = errorData.error_message || errorData.detail || response.statusText;
        callbacks.onError(errorCode, errorMessage);
        return;
      }

      const data: GetActiveHighlightedCouponResponse = await response.json();
      callbacks.onSuccess(data);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onError('ABORTED', 'Request was aborted');
      } else {
        callbacks.onError('NETWORK_ERROR', (error as Error).message || 'Network error occurred');
      }
    }
  }
}

