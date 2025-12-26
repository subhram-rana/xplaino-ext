// src/content/components/TextExplanationSidePanel/TextExplanationHeader.tsx
import React from 'react';
import { Minus, Bookmark, Trash2, Eye } from 'lucide-react';
import styles from './TextExplanationHeader.module.css';

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
}) => {
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
        <button
          className={getClassName('headerIconButton')}
          onClick={onClose}
          aria-label="Minimize panel"
          type="button"
        >
          <Minus size={18} />
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

      {/* Center: Empty */}
      <div className={getClassName('headerCenter')}>
        {/* Empty space to maintain layout */}
      </div>

      {/* Right: Action Icons */}
      {showRightIcons && (
        <div className={getClassName('headerRight')}>
          {/* Eye button - always show */}
          <button
            className={getClassName('headerIconButton')}
            onClick={onViewOriginal}
            aria-label="View original text"
            title="View original text"
            type="button"
          >
            <Eye size={18} />
          </button>
          {/* Bookmark button - always show */}
          <button
            className={getClassName('headerIconButton')}
            onClick={onBookmark}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark text"}
            title={isBookmarked ? "Remove bookmark" : "Bookmark text"}
            type="button"
          >
            <Bookmark size={18} fill={isBookmarked ? "#9527F5" : "none"} color={isBookmarked ? "#9527F5" : "currentColor"} />
          </button>
          {/* Delete button - only show when there's content */}
          {showDeleteIcon && (
            <button
              className={getClassName('headerIconButton')}
              onClick={onRemove}
              aria-label="Remove explanation"
              title="Remove explanation"
              type="button"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

TextExplanationHeader.displayName = 'TextExplanationHeader';
