// src/content/components/FAB/ActionButton.tsx
import React, { useRef } from 'react';
import { FileText, Languages, MoreVertical, Power } from 'lucide-react';
import { OnHoverMessage } from '../OnHoverMessage';

export interface ActionButtonProps {
  /** Tooltip text shown on hover */
  tooltip: string;
  /** Click handler */
  onClick: () => void;
  /** Icon to display */
  icon: 'summarise' | 'translate' | 'options' | 'disable';
  /** Additional class name */
  className?: string;
  /** Whether to show loading spinner instead of icon */
  isLoading?: boolean;
  /** Children to render (for popover) */
  children?: React.ReactNode;
  /** Whether to hide the tooltip (e.g., when popover is open) */
  hideTooltip?: boolean;
}

const iconMap = {
  summarise: FileText,
  translate: Languages,
  options: MoreVertical,
  disable: Power,
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  tooltip,
  onClick,
  icon,
  className = '',
  isLoading = false,
  children,
  hideTooltip = false,
}) => {
  const IconComponent = iconMap[icon];
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="actionButtonWrapper">
      <button
        ref={buttonRef}
        className={`${className} ${isLoading ? 'isLoading' : ''}`}
        onClick={onClick}
        aria-label={tooltip}
        disabled={isLoading}
      >
        {isLoading ? (
          <span 
            className="loadingSpinner"
            style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              minWidth: '20px',
              minHeight: '20px',
              border: '3px solid rgba(149, 39, 245, 0.2)',
              borderTopColor: '#9527F5',
              borderRadius: '50%',
              animation: 'spinSpinner 0.65s linear infinite',
              boxSizing: 'border-box',
            }}
            role="status"
            aria-label="Loading"
          />
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
