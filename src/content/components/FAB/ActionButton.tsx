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
}) => {
  const IconComponent = iconMap[icon];
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        className={className}
        onClick={onClick}
        aria-label={tooltip}
      >
        <IconComponent
          size={18}
          strokeWidth={2.5}
        />
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
