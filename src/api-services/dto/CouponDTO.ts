// src/api-services/dto/CouponDTO.ts
// DTOs for coupon API

/**
 * Response model for getting active highlighted coupon
 */
export interface GetActiveHighlightedCouponResponse {
  /** Response code: 'NO_ACTIVE_HIGHLIGHTED_COUPON' if no coupon found, otherwise null */
  code?: string | null;
  /** Coupon ID (UUID) */
  id?: string | null;
  /** Coupon code */
  coupon_code?: string | null;
  /** Coupon name */
  name?: string | null;
  /** Coupon description */
  description?: string | null;
  /** Discount percentage */
  discount?: number | null;
  /** Activation timestamp (ISO format) */
  activation?: string | null;
  /** Expiry timestamp (ISO format) */
  expiry?: string | null;
  /** Coupon status (ENABLED or DISABLED) */
  status?: string | null;
  /** Whether the coupon is highlighted */
  is_highlighted?: boolean | null;
}

