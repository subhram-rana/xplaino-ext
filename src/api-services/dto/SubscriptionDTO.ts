// src/api-services/dto/SubscriptionDTO.ts
// DTOs for subscription API (GET /api/subscription/{userId})

/**
 * Unit price for a subscription item
 */
export interface SubscriptionUnitPrice {
  /** Amount in the lowest denomination (e.g., cents) */
  amount: string;
  /** Currency code (e.g., USD) */
  currency_code: string;
}

/**
 * Price details for a subscription item
 */
export interface SubscriptionItemPrice {
  /** Price name (e.g., "Ultra Yearly", "Plus Monthly") */
  name: string | null;
  /** Unit price */
  unit_price: SubscriptionUnitPrice | null;
}

/**
 * Subscription item (product/price line item)
 */
export interface SubscriptionItem {
  /** Price details */
  price: SubscriptionItemPrice | null;
}

/**
 * Paddle subscription response
 * Matches backend PaddleSubscriptionResponse model
 */
export interface PaddleSubscriptionResponse {
  /** Internal ID (UUID) */
  id: string;
  /** Paddle subscription ID */
  paddle_subscription_id: string;
  /** Paddle customer ID */
  paddle_customer_id: string;
  /** Linked user ID (UUID) or null */
  user_id: string | null;
  /** Subscription status: ACTIVE, CANCELED, PAST_DUE, PAUSED, TRIALING */
  status: string;
  /** Currency code (e.g., USD) */
  currency_code: string;
  /** Billing interval: DAY, WEEK, MONTH, YEAR */
  billing_cycle_interval: string;
  /** Billing frequency */
  billing_cycle_frequency: number;
  /** Current period start (ISO format) or null */
  current_billing_period_starts_at: string | null;
  /** Current period end (ISO format) or null */
  current_billing_period_ends_at: string | null;
  /** Next billing date (ISO format) or null */
  next_billed_at: string | null;
  /** Pause date (ISO format) or null */
  paused_at?: string | null;
  /** Cancel date (ISO format) or null */
  canceled_at?: string | null;
  /** Subscription items/products */
  items: SubscriptionItem[];
  /** Creation timestamp (ISO format) */
  created_at: string;
  /** Last update timestamp (ISO format) */
  updated_at: string;
}

/**
 * Paddle customer response
 * Matches backend PaddleCustomerResponse model
 */
export interface PaddleCustomerResponse {
  /** Internal ID (UUID) */
  id: string;
  /** Paddle customer ID */
  paddle_customer_id: string;
  /** Linked user ID (UUID) or null */
  user_id: string | null;
  /** Customer email */
  email: string;
  /** Customer name or null */
  name: string | null;
  /** Customer locale or null */
  locale: string | null;
  /** Customer status: ACTIVE or ARCHIVED */
  status: string;
  /** Creation timestamp (ISO format) */
  created_at: string;
  /** Last update timestamp (ISO format) */
  updated_at: string;
}

/**
 * Response from GET /api/subscription/{userId}
 * Matches backend GetUserSubscriptionResponse model
 */
export interface SubscriptionStatusDTO {
  /** Whether user has an active subscription */
  has_active_subscription: boolean;
  /** Active subscription details, or null if no subscription */
  subscription: PaddleSubscriptionResponse | null;
  /** Customer details, or null if no customer */
  customer: PaddleCustomerResponse | null;
}

/**
 * Plan type derived from subscription status
 */
export type PlanType = 'free_trial' | 'plus' | 'ultra';

/**
 * Extract plan name from subscription items
 * Mirrors the getPlanName helper in xplaino-web
 */
export function getPlanName(subscription: PaddleSubscriptionResponse | null): string | null {
  if (!subscription?.items?.length) return null;
  return subscription.items[0]?.price?.name ?? null;
}

/**
 * Derive plan type from subscription status DTO
 */
export function derivePlanType(status: SubscriptionStatusDTO | null): PlanType {
  if (!status || !status.has_active_subscription || !status.subscription) {
    return 'free_trial';
  }
  const planName = getPlanName(status.subscription);
  if (planName && planName.toUpperCase().startsWith('PLUS')) {
    return 'plus';
  }
  if (planName && planName.toUpperCase().startsWith('ULTRA')) {
    return 'ultra';
  }
  // Default: if there's an active subscription but plan name is unknown, treat as ultra
  return 'ultra';
}
