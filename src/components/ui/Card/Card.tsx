// src/components/ui/Card/Card.tsx
import React from 'react';
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS, SHADOW } from '@/constants/styles';

interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Optional title */
  title?: string;
  /** Card padding */
  padding?: string;
  /** Optional click handler */
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  padding = '24px',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: COLORS.BACKGROUND_PRIMARY,
        borderRadius: BORDER_RADIUS.LARGE,
        padding,
        boxShadow: SHADOW.MD,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {title && (
        <h3
          style={{
            color: COLORS.TEXT_PRIMARY,
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

Card.displayName = 'Card';

