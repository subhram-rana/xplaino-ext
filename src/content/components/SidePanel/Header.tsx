// src/content/components/SidePanel/Header.tsx
import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight, Bookmark } from 'lucide-react';
import styles from './Header.module.css';
import { ENV } from '@/config/env';
import { COLORS } from '@/constants/colors';
import { OnHoverMessage } from '../OnHoverMessage';

// Custom expand icon - arrows pointing away from center (up and down)
const ExpandVerticalIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Arrow pointing up */}
    <polyline points="8 5 12 1 16 5" />
    {/* Arrow pointing down */}
    <polyline points="8 19 12 23 16 19" />
    {/* Center line */}
    <line x1="12" y1="1" x2="12" y2="23" />
  </svg>
);

// Custom contract icon - arrows pointing toward center
const ContractVerticalIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Arrow pointing down (from top) */}
    <polyline points="8 8 12 12 16 8" />
    {/* Arrow pointing up (from bottom) */}
    <polyline points="8 16 12 12 16 16" />
    {/* Top line */}
    <line x1="12" y1="1" x2="12" y2="12" />
    {/* Bottom line */}
    <line x1="12" y1="12" x2="12" y2="23" />
  </svg>
);

export interface HeaderProps {
  /** Brand image source */
  brandImageSrc?: string;
  /** Click handler for brand */
  onBrandClick?: () => void;
  /** Slide out handler */
  onSlideOut?: () => void;
  /** Vertical expand handler */
  onVerticalExpand?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Whether the panel is vertically expanded */
  isExpanded?: boolean;
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
  onVerticalExpand,
  useShadowDom = false,
  isExpanded = false,
  activeTab,
  onBookmark,
  showBookmark = false,
  isBookmarked = false,
}) => {
  // Refs for buttons
  const slideOutButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
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

  const handleVerticalExpand = () => {
    onVerticalExpand?.();
  };

  return (
    <div className={`${getClassName('header')} ${activeTab === 'settings' ? getClassName('headerSettings') : ''}`}>
      {/* Left: Action Icons */}
      <div className={getClassName('headerLeft')}>
        <button
          ref={slideOutButtonRef}
          className={getClassName('headerIconButton')}
          onClick={handleSlideOut}
          aria-label="Slide out panel"
          type="button"
        >
          <ChevronRight size={18} />
        </button>
        {isMounted && slideOutButtonRef.current && (
          <OnHoverMessage
            message="Minimize"
            targetRef={slideOutButtonRef}
            position="bottom"
            offset={8}
          />
        )}
        <button
          ref={expandButtonRef}
          className={getClassName('headerIconButton')}
          onClick={handleVerticalExpand}
          aria-label={isExpanded ? "Contract vertically" : "Expand vertically"}
          type="button"
        >
          {isExpanded ? <ContractVerticalIcon size={18} /> : <ExpandVerticalIcon size={18} />}
        </button>
        {isMounted && expandButtonRef.current && (
          <OnHoverMessage
            message={isExpanded ? "Contract" : "Expand"}
            targetRef={expandButtonRef}
            position="bottom"
            offset={8}
          />
        )}
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
