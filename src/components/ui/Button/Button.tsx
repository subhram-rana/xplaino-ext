// src/components/ui/Button/Button.tsx
import React, { useState } from 'react';
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS } from '@/constants/styles';

interface ButtonProps {
  /** Button content */
  children: React.ReactNode;
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant: _variant = 'primary', // Kept for backward compatibility but unused in dark theme
  size = 'medium',
  onClick,
  disabled = false,
  fullWidth = false,
  type = 'button',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getBackgroundColor = () => {
    if (disabled) return COLORS.GRAY_400;
    
    // Dark theme: transparent background for all variants except when hovered
    if (isHovered && !disabled) {
      // On hover, use the primary-light color (theme-aware)
      return 'var(--color-primary-light, #14a08a)';
    }
    
    // Default: transparent background
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return COLORS.WHITE;
    
    // On hover: white text
    if (isHovered && !disabled) {
      return 'var(--color-white, #FFFFFF)';
    }
    
    // Default: theme-aware primary light color
    return 'var(--color-primary-light, #14a08a)';
  };

  const getBorder = () => {
    if (disabled) return 'none';
    
    // Dark theme: medium teal border for all variants
    return '1.5px solid var(--color-primary-light, #14a08a)';
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return '8px 16px';
      case 'medium':
        return '12px 24px';
      case 'large':
        return '16px 32px';
      default:
        return '12px 24px';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        borderRadius: BORDER_RADIUS.MEDIUM,
        padding: getPadding(),
        border: getBorder(),
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'all 150ms ease',
      }}
    >
      {children}
    </button>
  );
};

Button.displayName = 'Button';

