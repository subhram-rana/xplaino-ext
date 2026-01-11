// src/content/components/SidePanel/Dropdown.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './Dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  /** Options list */
  options: DropdownOption[];
  /** Selected value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Whether to use Shadow DOM styling */
  useShadowDom?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  label,
  useShadowDom = false,
}) => {
  const getClassName = useCallback((baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    return styles[baseClass as keyof typeof styles] || baseClass;
  }, [useShadowDom]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canOpenRef = useRef<boolean>(false);
  // Track if dropdown has ever been opened (to prevent animation on initial mount)
  const hasBeenOpenedRef = useRef<boolean>(false);

  const selectedOption = options.find((opt) => opt.value === value);

  // Prevent dropdown from opening immediately after mount (prevents auto-open glitch)
  useEffect(() => {
    const timer = setTimeout(() => {
      canOpenRef.current = true;
    }, 150); // Small delay to prevent click events from tab switches
    return () => clearTimeout(timer);
  }, []);

  // Handle animation state - only animate when actually transitioning
  useEffect(() => {
    if (isOpen) {
      hasBeenOpenedRef.current = true;
      setIsAnimating(true);
      // Small delay to trigger opening animation
      const timeoutId = setTimeout(() => {
        setIsAnimating(false);
      }, 10);
      return () => clearTimeout(timeoutId);
    } else if (hasBeenOpenedRef.current) {
      // Only animate closing if it was previously opened
      setIsAnimating(true);
      // Delay for closing animation
      const timeoutId = setTimeout(() => {
        setIsAnimating(false);
      }, 300); // Match CSS transition duration
      return () => clearTimeout(timeoutId);
    }
    // Don't animate on initial mount when isOpen is false
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // More defensive check - ensure dropdown ref exists and event target is a Node
      if (!dropdownRef.current || !event.target) {
        return;
      }
      
      const target = event.target as Node;
      // Check if click is outside the dropdown container
      if (!dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use a small delay to ensure the menu is fully rendered and event handlers are attached
      // Use click event in bubble phase so item handlers fire first
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, false);
      }, 10);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside, false);
      };
    }

    return undefined;
  }, [isOpen]);

  const handleSelect = (optionValue: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    onChange?.(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={getClassName('dropdownContainer')}>
      {label && <label className={getClassName('label')}>{label}</label>}
      <div className={getClassName('dropdown')} ref={dropdownRef}>
        <button
          className={`${getClassName('dropdownButton')} ${isOpen ? getClassName('open') : ''}`}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Prevent opening immediately after mount to avoid auto-open glitch
            if (!canOpenRef.current) {
              return;
            }
            setIsOpen(!isOpen);
          }}
          type="button"
        >
          <span className={getClassName('dropdownValue')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className={`${getClassName('chevron')} ${isOpen ? getClassName('chevronOpen') : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {(isOpen || isAnimating) && (
          <div 
            ref={menuRef}
            className={`${getClassName('dropdownMenu')} ${isOpen ? getClassName('menuOpen') : getClassName('menuClosed')}`}
          >
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <div
                  key={option.value}
                  className={`${getClassName('dropdownItem')} ${
                    isSelected ? getClassName('selected') : ''
                  }`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleSelect(option.value, e);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {option.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

Dropdown.displayName = 'Dropdown';
