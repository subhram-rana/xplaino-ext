// src/content/components/ContentActions/ContentActionButton.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, SpellCheck, Languages, Bookmark, Power, MoreVertical } from 'lucide-react';
import { OnHoverMessage } from '../OnHoverMessage';

export interface ContentActionButtonProps {
  /** Icon type */
  icon: 'explain' | 'grammar' | 'translate' | 'bookmark' | 'power' | 'options';
  /** Tooltip text */
  tooltip: string;
  /** Click handler */
  onClick?: () => void;
  /** Animation delay index */
  delay?: number;
  /** Children to render (for popover) */
  children?: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Whether to hide the tooltip (e.g., when popover is open) */
  hideTooltip?: boolean;
  /** Custom mouse enter handler for the button */
  onButtonMouseEnter?: () => void;
  /** Custom mouse leave handler for the button */
  onButtonMouseLeave?: () => void;
}

const iconMap = {
  explain: Sparkles,
  grammar: SpellCheck,
  translate: Languages,
  bookmark: Bookmark,
  power: Power,
  options: MoreVertical,
};

export const ContentActionButton: React.FC<ContentActionButtonProps> = ({
  icon,
  tooltip,
  onClick,
  delay = 0,
  children,
  className = '',
  hideTooltip = false,
  onButtonMouseEnter,
  onButtonMouseLeave,
}) => {
  const IconComponent = iconMap[icon];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isButtonMounted, setIsButtonMounted] = useState(false);

  const handleMouseEnter = () => {
    onButtonMouseEnter?.();
  };
  const handleMouseLeave = () => {
    onButtonMouseLeave?.();
  };

  // Track when button is mounted for OnHoverMessage
  useEffect(() => {
    if (buttonRef.current) {
      const timer = setTimeout(() => {
        setIsButtonMounted(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsButtonMounted(false);
    }
  }, []);

  return (
    <div className={`contentActionButtonWrapper ${className}`}>
      <button
        ref={buttonRef}
        className={`contentActionButton ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={tooltip}
        style={{ animationDelay: `${delay * 120}ms` }} // Fallback delay, will be overridden by JavaScript
      >
        <IconComponent
          size={27}
          strokeWidth={2.5}
        />
      </button>
      {isButtonMounted && buttonRef.current && !hideTooltip && (
        <OnHoverMessage
          message={tooltip}
          targetRef={buttonRef}
          position="bottom"
          offset={8}
        />
      )}
      {children}
    </div>
  );
};

ContentActionButton.displayName = 'ContentActionButton';

