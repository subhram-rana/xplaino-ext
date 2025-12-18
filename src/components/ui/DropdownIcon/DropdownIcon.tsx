import React from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './DropdownIcon.module.css';

interface DropdownIconProps {
  isOpen?: boolean;
  className?: string;
  size?: number;
}

/**
 * DropdownIcon - Reusable dropdown chevron icon component
 * Uses lucide-react (ChevronDown) for a modern, professional look
 * 
 * @param isOpen - Whether the dropdown is open (rotates icon if true)
 * @param className - Additional CSS classes
 * @param size - Icon size in pixels (default: 20)
 * @returns JSX element
 */
export const DropdownIcon: React.FC<DropdownIconProps> = ({ 
  isOpen = false, 
  className = '',
  size = 20
}) => {
  return (
    <ChevronDown 
      className={`${styles.dropdownIcon} ${isOpen ? styles.dropdownIconOpen : ''} ${className}`}
      size={size}
      aria-hidden="true"
    />
  );
};

DropdownIcon.displayName = 'DropdownIcon';

