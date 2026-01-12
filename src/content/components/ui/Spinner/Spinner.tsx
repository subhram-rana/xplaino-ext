// src/content/components/ui/Spinner/Spinner.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Spinner.module.css';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Additional CSS class name */
  className?: string;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Custom color (defaults to primary purple) */
  color?: string;
}

// Size mapping in pixels
const sizeMap: Record<SpinnerSize, number> = {
  xs: 12, // image explanation icon
  sm: 14, // text explanation icon, word spinner
  md: 16, // button spinners
  lg: 18, // FAB, default
};

// Stroke width mapping for visual consistency at different sizes
const strokeWidthMap: Record<SpinnerSize, number> = {
  xs: 2.5,
  sm: 2.5,
  md: 2.5,
  lg: 2.5,
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'lg',
  className = '',
  useShadowDom = false,
  color,
}) => {
  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const pixelSize = sizeMap[size];
  const strokeWidth = strokeWidthMap[size];

  return (
    <Loader2
      size={pixelSize}
      strokeWidth={strokeWidth}
      className={`${getClassName('spinner')} ${className}`}
      style={color ? { color } : undefined}
    />
  );
};

Spinner.displayName = 'Spinner';
