import React from 'react';
import { Minus } from 'lucide-react';
import styles from './MinimizeIcon.module.css';

export interface MinimizeIconProps {
  onClick?: () => void;
  size?: number;
  className?: string;
  useShadowDom?: boolean;
}

export const MinimizeIcon: React.FC<MinimizeIconProps> = ({
  onClick,
  size = 18,
  className = '',
  useShadowDom = false,
}) => {
  const buttonClass = useShadowDom ? 'minimizeIcon' : styles.minimizeIcon;
  
  return (
    <button
      className={`${buttonClass} ${className}`}
      onClick={onClick}
      aria-label="Minimize"
      type="button"
    >
      <Minus size={size} strokeWidth={2} />
    </button>
  );
};
