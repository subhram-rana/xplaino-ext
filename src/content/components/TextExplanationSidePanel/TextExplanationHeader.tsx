// src/content/components/TextExplanationSidePanel/TextExplanationHeader.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Bookmark, Trash2, Eye } from 'lucide-react';
import { MinimizeIcon } from '../ui/MinimizeIcon';
import { OnHoverMessage } from '../OnHoverMessage';
import styles from './TextExplanationHeader.module.css';
import { COLORS } from '../../../constants/colors';

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

export interface TextExplanationHeaderProps {
  /** Close handler */
  onClose?: () => void;
  /** Vertical expand handler */
  onVerticalExpand?: () => void;
  /** Bookmark handler */
  onBookmark?: () => void;
  /** Remove handler */
  onRemove?: () => void;
  /** View original handler */
  onViewOriginal?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Whether the panel is vertically expanded */
  isExpanded?: boolean;
  /** Whether to show right-side action icons (view original, bookmark, remove) */
  showRightIcons?: boolean;
  /** Whether the text is bookmarked */
  isBookmarked?: boolean;
  /** Whether to show the delete icon (only show when there's content) */
  showDeleteIcon?: boolean;
  /** Active view mode */
  viewMode?: 'contextual' | 'translation';
}

export const TextExplanationHeader: React.FC<TextExplanationHeaderProps> = ({
  onClose,
  onVerticalExpand,
  onBookmark,
  onRemove,
  onViewOriginal,
  useShadowDom = false,
  isExpanded = false,
  showRightIcons = true,
  isBookmarked = false,
  showDeleteIcon = false,
  viewMode = 'contextual',
}) => {
  // Refs for buttons
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const bookmarkButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  
  // Track when refs are mounted for OnHoverMessage
  const [isMounted, setIsMounted] = useState(false);
  // Separate state for delete button since it's conditionally rendered
  const [isDeleteButtonMounted, setIsDeleteButtonMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Update delete button mounted state when showDeleteIcon changes
  useEffect(() => {
    if (showDeleteIcon) {
      // Small delay to ensure ref is assigned after render
      const timer = setTimeout(() => {
        setIsDeleteButtonMounted(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsDeleteButtonMounted(false);
    }
  }, [showDeleteIcon]);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleVerticalExpand = () => {
    onVerticalExpand?.();
  };

  return (
    <div className={getClassName('header')}>
      {/* Left: Action Icons */}
      <div className={getClassName('headerLeft')}>
        <MinimizeIcon
          onClick={onClose}
          size={18}
          useShadowDom={useShadowDom}
        />
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

      {/* Center: Heading Text */}
      <div className={getClassName('headerCenter')}>
        <span className={getClassName('headerHeading')}>
          {viewMode === 'contextual' ? 'CONTEXTUAL EXPLANATION' : 'TRANSLATION'}
        </span>
      </div>

      {/* Right: Action Icons */}
      {showRightIcons && (
        <div className={getClassName('headerRight')}>
          {/* Eye button - always show */}
          <button
            ref={eyeButtonRef}
            className={getClassName('headerIconButton')}
            onClick={onViewOriginal}
            aria-label="View original text"
            type="button"
          >
            <Eye size={18} />
          </button>
          {isMounted && eyeButtonRef.current && (
            <OnHoverMessage
              message="View original"
              targetRef={eyeButtonRef}
              position="bottom"
              offset={8}
            />
          )}
          {/* Bookmark button - always show */}
          <button
            ref={bookmarkButtonRef}
            className={`${getClassName('headerIconButton')} ${isBookmarked ? getClassName('bookmarked') : ''}`}
            onClick={onBookmark}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark text"}
            type="button"
          >
            <Bookmark size={18} fill={isBookmarked ? COLORS.PRIMARY : "none"} color={isBookmarked ? COLORS.PRIMARY : "currentColor"} />
          </button>
          {isMounted && bookmarkButtonRef.current && (
            <OnHoverMessage
              message={isBookmarked ? "Remove bookmark" : "Bookmark"}
              targetRef={bookmarkButtonRef}
              position="bottom"
              offset={8}
            />
          )}
          {/* Delete button - only show when there's content */}
          {showDeleteIcon && (
            <>
              <button
                ref={deleteButtonRef}
                className={getClassName('headerIconButton')}
                onClick={onRemove}
                aria-label="Remove explanation"
                type="button"
              >
                <Trash2 size={18} />
              </button>
              {isDeleteButtonMounted && deleteButtonRef.current && (
                <OnHoverMessage
                  message="Remove"
                  targetRef={deleteButtonRef}
                  position="bottom"
                  offset={8}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

TextExplanationHeader.displayName = 'TextExplanationHeader';
