// src/content/components/SidePanel/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight, Bookmark } from 'lucide-react';
import styles from './Header.module.css';
import { UserProfilePopover } from './UserProfilePopover';
import { userAuthInfoAtom } from '@/store/uiAtoms';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { ENV } from '@/config/env';
import { COLORS } from '@/constants/colors';
import { MinimalCouponButton } from '../HighlightedCoupon';

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
  /** Login handler */
  onLogin?: () => void;
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
  onLogin,
  useShadowDom = false,
  isExpanded = false,
  activeTab,
  onBookmark,
  showBookmark = false,
  isBookmarked = false,
}) => {
  const userAuthInfo = useAtomValue(userAuthInfoAtom);
  const setUserAuthInfo = useSetAtom(userAuthInfoAtom);
  const [showPopover, setShowPopover] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const popoverCloseRef = useRef<(() => Promise<void>) | null>(null);

  // Load auth info on mount
  useEffect(() => {
    const loadAuthInfo = async () => {
      console.log('[Header] Loading auth info from Chrome storage...');
      const authInfo = await ChromeStorage.getAuthInfo();
      console.log('[Header] Auth info loaded:', {
        hasAuthInfo: !!authInfo,
        hasAccessToken: !!authInfo?.accessToken,
        hasRefreshToken: !!authInfo?.refreshToken,
        hasUser: !!authInfo?.user,
        userId: authInfo?.user?.id,
        userEmail: authInfo?.user?.email,
        userName: authInfo?.user?.name,
        userPicture: authInfo?.user?.picture,
        accessTokenExpiresAt: authInfo?.accessTokenExpiresAt,
      });
      setUserAuthInfo(authInfo);
    };
    loadAuthInfo();
  }, [setUserAuthInfo]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[ChromeStorage.KEYS.XPLAINO_AUTH_INFO]) {
        const newValue = changes[ChromeStorage.KEYS.XPLAINO_AUTH_INFO].newValue;
        console.log('[Header] Auth info changed in storage:', {
          hasNewValue: !!newValue,
          hasAccessToken: !!newValue?.accessToken,
          hasUser: !!newValue?.user,
          userPicture: newValue?.user?.picture,
        });
        setUserAuthInfo(newValue || null);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [setUserAuthInfo]);

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

  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      // Default: open xplaino.com login page
      chrome.tabs.create({ url: `${ENV.XPLAINO_WEBSITE_BASE_URL}/login` });
    }
  };

  const handleProfileClick = async () => {
    if (showPopover && popoverCloseRef.current) {
      // If popover is already open, close it with animation
      await popoverCloseRef.current();
    } else {
      // If popover is closed, open it
      setShowPopover(true);
    }
  };

  const handleClosePopover = () => {
    setShowPopover(false);
  };

  const handlePopoverCloseRequest = (closeFn: () => Promise<void>) => {
    popoverCloseRef.current = closeFn;
  };

  // Check isLoggedIn from Chrome storage first, then fall back to checking user and accessToken
  const isLoggedIn = userAuthInfo && (
    userAuthInfo.isLoggedIn !== undefined 
      ? userAuthInfo.isLoggedIn 
      : (userAuthInfo.user && userAuthInfo.accessToken)
  );

  // Log login state decision
  console.log('[Header] Rendering with login state:', {
    isLoggedIn,
    hasUserAuthInfo: !!userAuthInfo,
    isLoggedInProperty: userAuthInfo?.isLoggedIn,
    hasAccessToken: !!userAuthInfo?.accessToken,
    hasUser: !!userAuthInfo?.user,
    userPicture: userAuthInfo?.user?.picture,
    willShowProfileIcon: isLoggedIn,
    willShowLoginButton: !isLoggedIn,
  });

  return (
    <div className={getClassName('header')}>
      {/* Left: Action Icons */}
      <div className={getClassName('headerLeft')}>
        <button
          className={getClassName('headerIconButton')}
          onClick={handleSlideOut}
          aria-label="Slide out panel"
          type="button"
        >
          <ChevronRight size={18} />
        </button>
        <button
          className={getClassName('headerIconButton')}
          onClick={handleVerticalExpand}
          aria-label={isExpanded ? "Contract vertically" : "Expand vertically"}
          type="button"
        >
          {isExpanded ? <ContractVerticalIcon size={18} /> : <ExpandVerticalIcon size={18} />}
        </button>
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
        {/* Minimal Coupon Button */}
        <MinimalCouponButton useShadowDom={useShadowDom} />
      </div>

      {/* Right: Bookmark (summary tab) or Login/Profile (other tabs) */}
      <div className={getClassName('headerRight')}>
        {activeTab === 'summary' && showBookmark ? (
          <button
            className={`${getClassName('headerIconButton')} ${isBookmarked ? getClassName('bookmarked') : ''}`}
            onClick={onBookmark}
            aria-label={isBookmarked ? "Remove saved link" : "Save link"}
            title={isBookmarked ? "Remove saved link" : "Save link"}
            type="button"
          >
            <Bookmark 
              size={18} 
              fill={isBookmarked ? COLORS.PRIMARY : "none"} 
              color={isBookmarked ? COLORS.PRIMARY : "currentColor"} 
            />
          </button>
        ) : activeTab !== 'summary' && (
          <>
            {isLoggedIn && userAuthInfo ? (
              <div className={getClassName('profileContainer')} ref={profileRef}>
                <button
                  ref={profileButtonRef}
                  className={getClassName('profilePictureButton')}
                  onClick={handleProfileClick}
                  aria-label="User profile"
                  type="button"
                >
                  <img
                    src={userAuthInfo.user?.picture || ''}
                    alt={userAuthInfo.user?.name || 'User'}
                    className={getClassName('profilePicture')}
                  />
                </button>
                {showPopover && (
                  <UserProfilePopover
                    userName={userAuthInfo.user?.name || ''}
                    useShadowDom={useShadowDom}
                    onClose={handleClosePopover}
                    sourceRef={profileButtonRef}
                    onCloseRequest={handlePopoverCloseRequest}
                  />
                )}
              </div>
            ) : (
              <button
                className={getClassName('loginButton')}
                onClick={handleLogin}
                aria-label="Login"
                type="button"
              >
                LOGIN
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

Header.displayName = 'Header';
