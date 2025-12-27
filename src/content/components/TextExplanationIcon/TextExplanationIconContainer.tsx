// src/content/components/TextExplanationIcon/TextExplanationIconContainer.tsx
import React from 'react';
import { Bookmark } from 'lucide-react';
import { TextExplanationIcon } from './TextExplanationIcon';
import styles from './TextExplanationIconContainer.module.css';

export interface TextExplanationIconData {
  id: string;
  position: { x: number; y: number };
  selectionRange: Range | null;
  isSpinning: boolean;
  onTogglePanel: () => void;
  iconRef?: (element: HTMLElement | null) => void;
  isPanelOpen?: boolean;
  isBookmarked?: boolean;
  onBookmarkClick?: () => void;
}

export interface TextExplanationIconContainerProps {
  /** Array of icon data to display */
  icons: TextExplanationIconData[];
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
}

export const TextExplanationIconContainer: React.FC<TextExplanationIconContainerProps> = ({
  icons,
  useShadowDom = false,
}) => {
  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  if (icons.length === 0) {
    return null;
  }

  return (
    <div className={getClassName('iconContainer')}>
      {icons.map((icon) => {
        // If bookmarked, show both icons in a container
        if (icon.isBookmarked) {
          console.log('[TextExplanationIconContainer] Rendering bookmarked icon container:', {
            id: icon.id,
            isSpinning: icon.isSpinning,
            position: icon.position,
          });
          return (
            <div
              key={icon.id}
              className={getClassName('bookmarkedIconContainer')}
              style={{
                position: 'fixed',
                left: `${icon.position.x}px`,
                top: `${icon.position.y}px`,
                zIndex: 2147483647,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <TextExplanationIcon
                position={{ x: 0, y: 0 }}
                isSpinning={icon.isSpinning}
                onTogglePanel={icon.onTogglePanel}
                useShadowDom={useShadowDom}
                iconRef={icon.iconRef}
                isPanelOpen={icon.isPanelOpen}
                selectionRange={icon.selectionRange}
                useFixedPosition={false}
                key={`${icon.id}-green`}
              />
              <button
                className={getClassName('bookmarkButton')}
                onClick={(e) => {
                  e.stopPropagation();
                  icon.onBookmarkClick?.();
                }}
                aria-label="Remove bookmark"
                title="Remove bookmark"
                type="button"
              >
                <Bookmark size={16} fill="#9527F5" color="#9527F5" />
              </button>
            </div>
          );
        }
        
        // Otherwise, show just the green icon
        return (
          <TextExplanationIcon
            key={icon.id}
            position={icon.position}
            isSpinning={icon.isSpinning}
            onTogglePanel={icon.onTogglePanel}
            useShadowDom={useShadowDom}
            iconRef={icon.iconRef}
            isPanelOpen={icon.isPanelOpen}
            selectionRange={icon.selectionRange}
          />
        );
      })}
    </div>
  );
};

TextExplanationIconContainer.displayName = 'TextExplanationIconContainer';

