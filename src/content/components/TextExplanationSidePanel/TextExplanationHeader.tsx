// src/content/components/TextExplanationSidePanel/TextExplanationHeader.tsx
import React from 'react';
import { ChevronRight, Bookmark, X, Eye } from 'lucide-react';
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
  /** Slide out handler */
  onSlideOut?: () => void;
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
}

export const TextExplanationHeader: React.FC<TextExplanationHeaderProps> = ({
  onSlideOut,
  onVerticalExpand,
  onBookmark,
  onRemove,
  onViewOriginal,
  useShadowDom = false,
  isExpanded = false,
  showRightIcons = true,
}) => {
  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleSlideOut = () => {
    onSlideOut?.();
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

      {/* Center: Empty */}
      <div className={getClassName('headerCenter')}>
        {/* Empty space to maintain layout */}
      </div>

      {/* Right: Action Icons */}
      {showRightIcons && (
        <div className={getClassName('headerRight')}>
          <button
            className={getClassName('headerIconButton')}
            onClick={onViewOriginal}
            aria-label="View original text"
            title="View original text"
            type="button"
          >
            <Eye size={18} />
          </button>
          <button
            className={getClassName('headerIconButton')}
            onClick={onBookmark}
            aria-label="Bookmark text"
            title="Bookmark text"
            type="button"
          >
            <Bookmark size={18} />
          </button>
          <button
            className={getClassName('headerIconButton')}
            onClick={onRemove}
            aria-label="Unselect text"
            title="Unselect text"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

TextExplanationHeader.displayName = 'TextExplanationHeader';
