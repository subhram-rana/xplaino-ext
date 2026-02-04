// src/content/components/TextExplanationIcon/TextExplanationIconContainer.tsx
import React from 'react';
import { TextExplanationIcon } from './TextExplanationIcon';
import styles from './TextExplanationIconContainer.module.css';

export interface TextExplanationIconData {
  id: string;
  position: { x: number; y: number };
  selectionRange: Range | null;
  /** Wrapper element for scroll tracking (preferred over selectionRange) */
  wrapperElement?: HTMLElement | null;
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
      {icons.map((icon) => (
        <TextExplanationIcon
          key={icon.id}
          position={icon.position}
          isSpinning={icon.isSpinning}
          onTogglePanel={icon.onTogglePanel}
          useShadowDom={useShadowDom}
          iconRef={icon.iconRef}
          isPanelOpen={icon.isPanelOpen}
          selectionRange={icon.selectionRange}
          wrapperElement={icon.wrapperElement}
          isBookmarked={icon.isBookmarked}
          onBookmarkClick={icon.onBookmarkClick}
        />
      ))}
    </div>
  );
};

TextExplanationIconContainer.displayName = 'TextExplanationIconContainer';
