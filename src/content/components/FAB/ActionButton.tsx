// src/content/components/FAB/ActionButton.tsx
import React, { useRef } from 'react';
import { FileText, Languages, Settings } from 'lucide-react';
import { OnHoverMessage } from '../OnHoverMessage';

export interface ActionButtonProps {
  /** Tooltip text shown on hover */
  tooltip: string;
  /** Click handler */
  onClick: () => void;
  /** Icon to display */
  icon: 'summarise' | 'translate' | 'options';
  /** Additional class name */
  className?: string;
  /** Whether to show loading spinner instead of icon */
  isLoading?: boolean;
}

const iconMap = {
  summarise: FileText,
  translate: Languages,
  options: Settings,
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  tooltip,
  onClick,
  icon,
  className = '',
  isLoading = false,
}) => {
  const IconComponent = iconMap[icon];
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
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
              display: 'block',
              width: '18px',
              height: '18px',
              minWidth: '18px',
              minHeight: '18px',
              border: '2px solid rgba(149, 39, 245, 0.2)',
              borderTopColor: '#9527F5',
              borderRadius: '50%',
              animation: 'spinSpinner 0.8s linear infinite',
              transform: 'rotate(0deg)',
              transformOrigin: 'center center',
              boxSizing: 'border-box',
              margin: '0 auto',
            }}
          />
        ) : (
          <IconComponent
            size={18}
            strokeWidth={2.5}
          />
        )}
      </button>
      <OnHoverMessage
        message={tooltip}
        targetRef={buttonRef}
        position="left"
        offset={10}
      />
    </>
  );
};

ActionButton.displayName = 'ActionButton';
