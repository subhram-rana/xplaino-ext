// src/content/components/HighlightedCoupon/MinimalCouponButton.tsx
import React, { useState, useEffect } from 'react';
import { CouponService } from '@/api-services/CouponService';
import { GetActiveHighlightedCouponResponse } from '@/api-services/dto/CouponDTO';
import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import styles from './MinimalCouponButton.module.css';

export interface MinimalCouponButtonProps {
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

export const MinimalCouponButton: React.FC<MinimalCouponButtonProps> = ({
  useShadowDom = false,
}) => {
  const [coupon, setCoupon] = useState<GetActiveHighlightedCouponResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let abortController: AbortController | null = null;

    const fetchCoupon = async () => {
      abortController = new AbortController();
      setLoading(true);

      await CouponService.getActiveHighlightedCoupon(
        {
          onSuccess: async (response) => {
            if (response.code === 'NO_ACTIVE_HIGHLIGHTED_COUPON' || !response.id) {
              setCoupon(null);
            } else {
              // Check if coupon was dismissed
              const dismissed = await ChromeStorage.getHighlightedCouponDismissed(response.id);
              if (dismissed) {
                setCoupon(response); // Show button even if dismissed
                setIsDismissed(true);
              } else {
                setCoupon(null); // Don't show button if coupon is still visible
              }
            }
            setLoading(false);
          },
          onError: () => {
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

  // Don't render if loading, no coupon, or coupon not dismissed
  if (loading || !coupon || !isDismissed) {
    return null;
  }

  // Format discount percentage
  const discountText = coupon.discount
    ? `${Math.round(coupon.discount)}% OFF`
    : 'Special Offer';

  // Handle button click
  const handleClick = () => {
    const pricingUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/pricing`;
    window.open(pricingUrl, '_blank');
  };

  return (
    <button
      className={getClassName('minimalCouponButton', styles.minimalCouponButton)}
      onClick={handleClick}
      type="button"
    >
      <span className={getClassName('buttonText', styles.buttonText)}>
        {discountText} | GET DEAL
      </span>
    </button>
  );
};

MinimalCouponButton.displayName = 'MinimalCouponButton';

