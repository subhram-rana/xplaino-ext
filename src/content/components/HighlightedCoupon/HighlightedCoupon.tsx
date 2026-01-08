// src/content/components/HighlightedCoupon/HighlightedCoupon.tsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CouponService } from '@/api-services/CouponService';
import { GetActiveHighlightedCouponResponse } from '@/api-services/dto/CouponDTO';
import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import styles from './HighlightedCoupon.module.css';

export interface HighlightedCouponProps {
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Callback when coupon is dismissed */
  onDismiss?: (couponId: string) => void;
}

export const HighlightedCoupon: React.FC<HighlightedCouponProps> = ({
  useShadowDom = false,
  onDismiss,
}) => {
  const [coupon, setCoupon] = useState<GetActiveHighlightedCouponResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let abortController: AbortController | null = null;

    const fetchCoupon = async () => {
      abortController = new AbortController();
      setLoading(true);
      setError(null);

      await CouponService.getActiveHighlightedCoupon(
        {
          onSuccess: async (response) => {
            // Only set coupon if it's not the "no coupon" response
            if (response.code === 'NO_ACTIVE_HIGHLIGHTED_COUPON' || !response.id) {
              setCoupon(null);
            } else {
              // Check if coupon was previously dismissed
              const dismissed = await ChromeStorage.getHighlightedCouponDismissed(response.id);
              if (dismissed) {
                setIsDismissed(true);
                setCoupon(null);
              } else {
                setCoupon(response);
              }
            }
            setLoading(false);
          },
          onError: (errorCode, errorMessage) => {
            console.error('[HighlightedCoupon] Failed to fetch coupon:', errorCode, errorMessage);
            setError(errorMessage);
            setCoupon(null);
            setLoading(false);
          },
        },
        abortController.signal
      );
    };

    fetchCoupon();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, []);

  // Get class name based on context (Shadow DOM vs CSS Modules)
  const getClassName = (shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  };

  // Don't render if loading, error, or no coupon
  if (loading || error || !coupon || coupon.code === 'NO_ACTIVE_HIGHLIGHTED_COUPON') {
    return null;
  }

  // Format discount percentage
  const discountText = coupon.discount
    ? `${Math.round(coupon.discount)}% OFF`
    : 'Special Offer';

  // Format expiry date
  const formatExpiry = (expiry: string | null | undefined): string => {
    if (!expiry) return '';
    try {
      const date = new Date(expiry);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const expiryText = formatExpiry(coupon.expiry);

  // Handle copy coupon code
  const handleCopyCode = async () => {
    if (!coupon.coupon_code) return;
    try {
      await navigator.clipboard.writeText(coupon.coupon_code);
      // You could add a toast notification here if needed
      console.log('[HighlightedCoupon] Code copied:', coupon.coupon_code);
    } catch (error) {
      console.error('[HighlightedCoupon] Failed to copy code:', error);
    }
  };

  // Handle Get Deal button click
  const handleGetDeal = () => {
    const pricingUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/pricing`;
    window.open(pricingUrl, '_blank');
  };

  // Handle close button click
  const handleClose = async () => {
    if (!coupon?.id) return;
    
    // Store dismissed state
    await ChromeStorage.setHighlightedCouponDismissed(coupon.id, true);
    setIsDismissed(true);
    setCoupon(null);
    
    // Notify parent component
    onDismiss?.(coupon.id);
  };

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  return (
    <div className={getClassName('highlightedCoupon', styles.highlightedCoupon)}>
      <div className={getClassName('couponContainer', styles.couponContainer)}>
        {/* Close Button */}
        <button
          className={getClassName('closeButton', styles.closeButton)}
          onClick={handleClose}
          aria-label="Close coupon"
          type="button"
        >
          <X size={16} />
        </button>

        {/* Discount Badge - Compact */}
        <div className={getClassName('discountBadge', styles.discountBadge)}>
          <span className={getClassName('discountText', styles.discountText)}>
            {discountText}
          </span>
        </div>

        {/* Coupon Content - Compact Layout */}
        <div className={getClassName('couponContent', styles.couponContent)}>
          {/* Name and Description in one line if possible */}
          <div className={getClassName('couponHeader', styles.couponHeader)}>
            {coupon.name && (
              <h3 className={getClassName('couponName', styles.couponName)}>
                {coupon.name}
              </h3>
            )}
            {expiryText && (
              <span className={getClassName('couponExpiry', styles.couponExpiry)}>
                Expires: {expiryText}
              </span>
            )}
          </div>

          {/* Description - Compact */}
          {coupon.description && (
            <p className={getClassName('couponDescription', styles.couponDescription)}>
              {coupon.description}
            </p>
          )}

          {/* Coupon Code and Get Deal Button - Horizontal Layout */}
          <div className={getClassName('couponActions', styles.couponActions)}>
            {coupon.coupon_code && (
              <div className={getClassName('couponCodeContainer', styles.couponCodeContainer)}>
                <span className={getClassName('couponCodeLabel', styles.couponCodeLabel)}>
                  Code:
                </span>
                <button
                  className={getClassName('couponCode', styles.couponCode)}
                  onClick={handleCopyCode}
                  title="Click to copy code"
                >
                  {coupon.coupon_code}
                </button>
              </div>
            )}
            <button
              className={getClassName('getDealButton', styles.getDealButton)}
              onClick={handleGetDeal}
            >
              Get Deal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

HighlightedCoupon.displayName = 'HighlightedCoupon';

