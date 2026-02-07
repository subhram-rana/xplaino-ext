// src/content/components/BaseSidePanel/UpgradeFooter.tsx
// Unified upgrade footer with coupon and upgrade buttons
import React, { useState, useEffect } from 'react';
import { Copy, Check, Crown } from 'lucide-react';
import styles from './UpgradeFooter.module.css';
import { CouponService } from '@/api-services/CouponService';
import { GetActiveHighlightedCouponResponse } from '@/api-services/dto/CouponDTO';
import { ENV } from '@/config/env';

export interface UpgradeFooterProps {
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

export const UpgradeFooter: React.FC<UpgradeFooterProps> = ({ useShadowDom = false }) => {
  const [coupon, setCoupon] = useState<GetActiveHighlightedCouponResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  // Fetch coupon data
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
              setCoupon(response);
            }
            setLoading(false);
          },
          onError: (errorCode, errorMessage) => {
            console.error('[UpgradeFooter] Failed to fetch coupon:', errorCode, errorMessage);
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

  // Handle coupon button click (opens pricing page)
  const handleCouponClick = () => {
    const pricingUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/pricing`;
    window.open(pricingUrl, '_blank');
  };

  // Handle copy icon click
  const handleCopyClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (coupon?.coupon_code) {
      try {
        await navigator.clipboard.writeText(coupon.coupon_code);
        setIsCopied(true);
        console.log('[UpgradeFooter] Coupon code copied:', coupon.coupon_code);

        setTimeout(() => {
          setIsCopied(false);
        }, 1000);
      } catch (error) {
        console.error('[UpgradeFooter] Failed to copy code:', error);
      }
    }
  };

  // Format discount percentage
  const discountPercent = coupon?.discount ? Math.round(coupon.discount) : null;

  // Handle upgrade button click
  const handleUpgradeClick = () => {
    const pricingUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/pricing`;
    window.open(pricingUrl, '_blank');
  };

  const hasCoupon = coupon && !loading && discountPercent && coupon.coupon_code;

  return (
    <div className={getClassName('upgradeFooter')}>
      <div className={getClassName('upgradeFooterContent')}>
        {hasCoupon && (
          <button
            className={getClassName('couponButton')}
            onClick={handleCouponClick}
            type="button"
          >
            <span className={getClassName('couponText')}>
              Save {discountPercent}% by using {coupon.coupon_code}{' '}
              <span
                className={getClassName('copyIcon')}
                onClick={handleCopyClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCopyClick(e as unknown as React.MouseEvent);
                  }
                }}
              >
                {isCopied ? (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    <span className={getClassName('copiedText')}>Copied</span>
                  </>
                ) : (
                  <Copy size={16} strokeWidth={2.5} />
                )}
              </span>
            </span>
          </button>
        )}
        <div className={getClassName('upgradeButtonGroup')}>
          <span className={getClassName('limitedTimeOffer')}>Limited time: 30% off</span>
          <button
            className={getClassName('upgradeButton')}
            onClick={handleUpgradeClick}
            type="button"
          >
            <Crown size={16} strokeWidth={2.5} />
            <span>Upgrade</span>
          </button>
        </div>
      </div>
    </div>
  );
};

UpgradeFooter.displayName = 'UpgradeFooter';
