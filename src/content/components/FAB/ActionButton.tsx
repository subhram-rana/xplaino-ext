// src/content/components/FAB/ActionButton.tsx
import React, { useRef } from 'react';
import { FileText, Languages, MoreVertical, Power, Loader2, StopCircle, Bookmark, Globe, LayoutDashboard, Settings } from 'lucide-react';
import { OnHoverMessage } from '../OnHoverMessage';

export interface ActionButtonProps {
  /** Tooltip text shown on hover */
  tooltip: string;
  /** Click handler */
  onClick: () => void;
  /** Icon to display */
  icon: 'summarise' | 'translate' | 'options' | 'settings' | 'disable' | 'stop' | 'bookmark' | 'globe' | 'dashboard';
  /** Additional class name */
  className?: string;
  /** Whether to show loading spinner instead of icon */
  isLoading?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Children to render (for popover) */
  children?: React.ReactNode;
  /** Whether to hide the tooltip (e.g., when popover is open) */
  hideTooltip?: boolean;
  /** Optional custom text to show instead of icon */
  customText?: string;
  /** Whether the bookmark icon is filled (saved) */
  isBookmarked?: boolean;
}

const iconMap = {
  summarise: FileText,
  translate: Languages,
  options: MoreVertical,
  settings: Settings,
  disable: Power,
  stop: StopCircle,
  bookmark: Bookmark,
  globe: Globe,
  dashboard: LayoutDashboard,
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  tooltip,
  onClick,
  icon,
  className = '',
  isLoading = false,
  disabled = false,
  children,
  hideTooltip = false,
  customText,
  isBookmarked = false,
}) => {
  const IconComponent = iconMap[icon];
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="actionButtonWrapper">
      <button
        ref={buttonRef}
        className={`${className} ${isLoading ? 'isLoading' : ''} ${customText ? 'hasCustomText' : ''} ${disabled ? 'disabled' : ''} ${isBookmarked ? 'bookmarked' : ''}`}
        onClick={disabled ? undefined : onClick}
        disabled={disabled || isLoading}
        aria-label={tooltip}
      >
        {isLoading ? (
          <Loader2
            size={18}
            className="loadingSpinner"
            strokeWidth={2.5}
          />
        ) : customText ? (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              padding: '0 4px',
            }}
          >
            {customText}
          </span>
        ) : (
          <IconComponent
            size={18}
            strokeWidth={2.5}
          />
        )}
      </button>
      {!hideTooltip && (
        <OnHoverMessage
          message={tooltip}
          targetRef={buttonRef}
          position="left"
          offset={10}
        />
      )}
      {children}
    </div>
  );
};

ActionButton.displayName = 'ActionButton';
