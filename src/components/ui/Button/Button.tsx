// src/components/ui/Button/Button.tsx
import React from 'react';
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
  variant = 'primary',
  size = 'medium',
  onClick,
  disabled = false,
  fullWidth = false,
  type = 'button',
}) => {
  const getBackgroundColor = () => {
    if (disabled) return COLORS.GRAY_400;
    switch (variant) {
      case 'primary':
        return COLORS.PRIMARY;
      case 'secondary':
        return COLORS.SECONDARY;
      case 'danger':
        return COLORS.ERROR;
      case 'ghost':
        return 'transparent';
      default:
        return COLORS.PRIMARY;
    }
  };

  const getTextColor = () => {
    if (variant === 'ghost') return COLORS.PRIMARY;
    return COLORS.WHITE;
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
      style={{
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        borderRadius: BORDER_RADIUS.MEDIUM,
        padding: getPadding(),
        border: variant === 'ghost' ? `1px solid ${COLORS.PRIMARY}` : 'none',
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

