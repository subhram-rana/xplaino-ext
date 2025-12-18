// src/components/ui/Input/Input.tsx
import React from 'react';
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS } from '@/constants/styles';

interface InputProps {
  /** Input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number';
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Full width input */
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  error = false,
  fullWidth = false,
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        backgroundColor: COLORS.WHITE,
        color: COLORS.TEXT_PRIMARY,
        borderRadius: BORDER_RADIUS.MEDIUM,
        border: `1px solid ${error ? COLORS.BORDER_ERROR : COLORS.BORDER_DEFAULT}`,
        padding: '12px 16px',
        fontSize: '14px',
        width: fullWidth ? '100%' : 'auto',
        outline: 'none',
        transition: 'border-color 150ms ease',
      }}
    />
  );
};

Input.displayName = 'Input';

