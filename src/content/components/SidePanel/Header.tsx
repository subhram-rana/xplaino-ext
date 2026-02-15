// src/content/components/SidePanel/Header.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import styles from './Header.module.css';
import { ENV } from '@/config/env';
import { COLORS } from '@/constants/colors';
import { OnHoverMessage } from '../OnHoverMessage';
import { MinimizeIcon } from '../ui/MinimizeIcon';

export interface HeaderProps {
  /** Brand image source */
  brandImageSrc?: string;
  /** Click handler for brand */
  onBrandClick?: () => void;
  /** Slide out handler */
  onSlideOut?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Active tab type */
  activeTab?: 'summary' | 'settings';
  /** Bookmark handler */
  onBookmark?: () => void;
  /** Whether to show bookmark icon */
  showBookmark?: boolean;
  /** Whether the bookmark is filled (saved) */
  isBookmarked?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  brandImageSrc,
  onBrandClick,
  onSlideOut,
  useShadowDom = false,
  activeTab,
  onBookmark,
  showBookmark = false,
  isBookmarked = false,
}) => {
  // Refs for buttons
  const bookmarkButtonRef = useRef<HTMLButtonElement>(null);
  
  // Track when refs are mounted for OnHoverMessage
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleBrandClick = () => {
    if (onBrandClick) {
      onBrandClick();
    } else {
      // Default: open xplaino.com in new tab
      window.open(ENV.XPLAINO_WEBSITE_BASE_URL, '_blank');
    }
  };

  const handleSlideOut = () => {
    onSlideOut?.();
  };

  return (
    <div className={`${getClassName('header')} ${activeTab === 'settings' ? getClassName('headerSettings') : ''}`}>
      {/* Left: Action Icons */}
      <div className={getClassName('headerLeft')}>
        <MinimizeIcon
          onClick={handleSlideOut}
          size={18}
          useShadowDom={useShadowDom}
        />
      </div>

      {/* Center: Branding or Page Summary */}
      <div className={getClassName('headerCenter')}>
        {activeTab === 'summary' ? (
          <div className={getClassName('headerTitle')}>
            Page summary
          </div>
        ) : (
          <>
            {brandImageSrc ? (
              <img
                src={brandImageSrc}
                alt="Xplaino"
                className={getClassName('headerBrand')}
                onClick={handleBrandClick}
              />
            ) : (
              <div
                className={getClassName('headerBrand')}
                onClick={handleBrandClick}
              >
                Xplaino
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Bookmark (summary tab only) */}
      <div className={getClassName('headerRight')}>
        {activeTab === 'summary' && showBookmark && (
          <>
            <button
              ref={bookmarkButtonRef}
              className={`${getClassName('headerIconButton')} ${isBookmarked ? getClassName('bookmarked') : ''}`}
              onClick={onBookmark}
              aria-label={isBookmarked ? "Remove saved link" : "Save summary and page link"}
              type="button"
            >
              <Bookmark 
                size={18} 
                fill={isBookmarked ? COLORS.PRIMARY : "none"} 
                color={isBookmarked ? COLORS.PRIMARY : "currentColor"} 
              />
            </button>
            {isMounted && bookmarkButtonRef.current && (
              <OnHoverMessage
                message={isBookmarked ? "Remove saved link" : "Save summary and page link"}
                targetRef={bookmarkButtonRef}
                position="bottom"
                offset={8}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

Header.displayName = 'Header';
