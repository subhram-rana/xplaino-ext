// src/content/components/BaseSidePanel/UpgradeFooter.tsx
// Unified upgrade footer with upgrade button
import React from 'react';
import { Crown } from 'lucide-react';
import styles from './UpgradeFooter.module.css';
import { ENV } from '@/config/env';

export interface UpgradeFooterProps {
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

export const UpgradeFooter: React.FC<UpgradeFooterProps> = ({ useShadowDom = false }) => {
  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleUpgradeClick = () => {
    const pricingUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/pricing`;
    window.open(pricingUrl, '_blank');
  };

  return (
    <div className={getClassName('upgradeFooter')}>
      <div className={getClassName('upgradeFooterContent')}>
        <div className={getClassName('upgradeButtonGroup')}>
          <span className={getClassName('limitedTimeOffer')}>Limited time offer: 30% off</span>
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
