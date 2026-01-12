// src/content/components/ui/ExplanationIconButton/ExplanationIconButton.tsx
import React, { useEffect, useRef, useState } from 'react';
import styles from './ExplanationIconButton.module.css';
import { COLORS } from '@/constants/colors';
import { OnHoverMessage } from '../../OnHoverMessage';
import { Spinner, SpinnerSize } from '../Spinner';

export interface ExplanationIconButtonProps {
  /** Whether to show spinner */
  isSpinning: boolean;
  /** Whether the panel is currently open */
  isPanelOpen?: boolean;
  /** Whether the item is bookmarked */
  isBookmarked?: boolean;
  /** Whether first chunk has been received (shows book icon instead of purple icon) */
  firstChunkReceived?: boolean;
  /** Whether the icon is hiding (for disappear animation) */
  isHiding?: boolean;
  /** Click handler for main icon */
  onClick: () => void;
  /** Click handler for bookmark icon */
  onBookmarkClick?: () => void;
  /** Mouse enter handler */
  onMouseEnter?: () => void;
  /** Mouse leave handler */
  onMouseLeave?: () => void;
  /** Ref for the container element */
  containerRef?: React.RefObject<HTMLDivElement>;
  /** Callback ref to get icon button element */
  iconRef?: (element: HTMLButtonElement | null) => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Size of the spinner */
  spinnerSize?: SpinnerSize;
  /** Whether to show purple xplaino icon initially (before first chunk) */
  showPurpleIconInitially?: boolean;
  /** Aria label for the main button */
  ariaLabel?: string;
  /** Hover message for the book icon */
  hoverMessage?: string;
  /** Hover message for the bookmark icon */
  bookmarkHoverMessage?: string;
}

/**
 * Get the icon URL for the purple xplaino icon
 */
function getPurpleIconUrl(): string {
  return chrome.runtime.getURL('src/assets/icons/xplaino-purple-icon.ico');
}

/**
 * Teal Book Open icon (Lucide wireframe/outline style) for successful explanation
 */
const TealBookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={COLORS.PRIMARY}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

/**
 * Bookmark icon (filled)
 */
const BookmarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={COLORS.PRIMARY}
    stroke={COLORS.PRIMARY}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Reusable Explanation Icon Button component
 * Used for both text and image explanation icons
 */
export const ExplanationIconButton: React.FC<ExplanationIconButtonProps> = ({
  isSpinning,
  isPanelOpen = false,
  isBookmarked = false,
  firstChunkReceived = false,
  isHiding = false,
  onClick,
  onBookmarkClick,
  onMouseEnter,
  onMouseLeave,
  containerRef,
  iconRef,
  useShadowDom = false,
  spinnerSize = 'xs',
  showPurpleIconInitially = false,
  ariaLabel = 'View explanation',
  hoverMessage = 'View explanation',
  bookmarkHoverMessage = 'Remove bookmark',
}) => {
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const iconElementRef = useRef<HTMLButtonElement | null>(null);
  const bookmarkElementRef = useRef<HTMLButtonElement | null>(null);
  
  // State to track when buttons are mounted for OnHoverMessage
  const [isBookIconMounted, setIsBookIconMounted] = useState(false);
  const [isBookmarkButtonMounted, setIsBookmarkButtonMounted] = useState(false);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  // Callback ref for the icon button element
  const setIconButtonRef = (node: HTMLButtonElement | null) => {
    iconElementRef.current = node;
    if (iconRef) {
      iconRef(node);
    }
  };

  // Update book icon mounted state when firstChunkReceived changes
  useEffect(() => {
    if ((firstChunkReceived || !showPurpleIconInitially) && iconElementRef.current && !isSpinning) {
      // Small delay to ensure ref is assigned after render
      const timer = setTimeout(() => {
        setIsBookIconMounted(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsBookIconMounted(false);
    }
  }, [firstChunkReceived, showPurpleIconInitially, isSpinning]);

  // Update bookmark button mounted state when isBookmarked changes
  useEffect(() => {
    if (isBookmarked && onBookmarkClick) {
      // Small delay to ensure ref is assigned after render
      const timer = setTimeout(() => {
        setIsBookmarkButtonMounted(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsBookmarkButtonMounted(false);
    }
  }, [isBookmarked, onBookmarkClick]);

  // Container style for vertical icon layout with white background
  // This container holds BOTH the book icon and bookmark icon
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0px',
    background: '#FFFFFF',
    borderRadius: '5px',
    padding: '2px',
    overflow: 'visible', // Allow tooltips to show outside
  };

  // Build button class names
  const buttonClassNames = [
    getClassName('explanationIconButton'),
    isPanelOpen ? getClassName('panelOpen') : '',
    firstChunkReceived ? getClassName('greenIcon') : '',
    isHiding ? getClassName('hiding') : '',
    isSpinning ? getClassName('spinning') : '',
  ].filter(Boolean).join(' ');

  // Bookmark button style (same dimensions as book icon button)
  const bookmarkButtonStyle: React.CSSProperties = {
    width: '14px',
    height: '14px',
    padding: '0',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0',
    outline: 'none',
  };

  // Determine which icon to show
  const renderIcon = () => {
    if (isSpinning) {
      return (
        <div className={getClassName('spinnerContainer')}>
          <Spinner size={spinnerSize} useShadowDom={useShadowDom} />
        </div>
      );
    }
    
    if (showPurpleIconInitially && !firstChunkReceived) {
      return (
        <img
          src={getPurpleIconUrl()}
          alt="Xplaino"
          className={getClassName('iconImage')}
        />
      );
    }
    
    return <TealBookIcon className={getClassName('iconImage')} />;
  };

  // Use external containerRef if provided, otherwise use internal
  const actualContainerRef = containerRef || internalContainerRef;

  return (
    <div ref={actualContainerRef} style={containerStyle}>
      <button
        ref={setIconButtonRef}
        className={buttonClassNames}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          onMouseEnter?.();
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          onMouseLeave?.();
        }}
        aria-label={ariaLabel}
      >
        {renderIcon()}
      </button>
      {isBookIconMounted && iconElementRef.current && (
        <OnHoverMessage
          message={hoverMessage}
          targetRef={iconElementRef}
          position="left"
          offset={8}
        />
      )}
      {isBookmarked && onBookmarkClick && (
        <>
          <button
            ref={bookmarkElementRef}
            style={bookmarkButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkClick();
            }}
            aria-label={bookmarkHoverMessage}
          >
            <BookmarkIcon className={getClassName('iconImage')} />
          </button>
          {isBookmarkButtonMounted && bookmarkElementRef.current && (
            <OnHoverMessage
              message={bookmarkHoverMessage}
              targetRef={bookmarkElementRef}
              position="left"
              offset={8}
            />
          )}
        </>
      )}
    </div>
  );
};

ExplanationIconButton.displayName = 'ExplanationIconButton';
