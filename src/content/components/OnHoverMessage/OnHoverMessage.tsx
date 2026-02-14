// src/content/components/OnHoverMessage/OnHoverMessage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import { currentThemeAtom } from '@/store/uiAtoms';
import onHoverMessageStyles from '../../styles/onHoverMessage.shadow.css?inline';
import { FAB_COLOR_VARIABLES } from '../../../constants/colors.css';

export interface OnHoverMessageProps {
  /** The message text to display */
  message: string;
  /** Optional keyboard shortcut text shown below the message */
  shortcut?: string;
  /** Reference to the target element to show tooltip for */
  targetRef: React.RefObject<HTMLElement>;
  /** Position relative to target element */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Distance from target element in pixels */
  offset?: number;
  /** Additional CSS class name */
  className?: string;
  /** When true, show the tooltip immediately on mount without waiting for mouseenter */
  forceShow?: boolean;
  /** Visual variant. 'featureDiscovery' uses white/dark bg with neutral shadow instead of teal */
  variant?: 'default' | 'featureDiscovery';
}

export const OnHoverMessage: React.FC<OnHoverMessageProps> = ({
  message,
  shortcut,
  targetRef,
  position = 'top',
  offset = 8,
  className = '',
  forceShow = false,
  variant = 'default',
}) => {
  const currentTheme = useAtomValue(currentThemeAtom);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const styleInjectedRef = useRef(false);

  // Inject styles into document.head on first mount
  useEffect(() => {
    if (styleInjectedRef.current) return;
    
    // Check if styles already injected
    const existingStyle = document.getElementById('onhovermessage-styles');
    if (existingStyle) {
      styleInjectedRef.current = true;
      return;
    }

    // Inject CSS variables with :root selector (not :host) since OnHoverMessage renders outside Shadow DOM
    const colorStyle = document.createElement('style');
    colorStyle.id = 'onhovermessage-color-variables';
    // Replace :host with :root for document.body rendering
    colorStyle.textContent = FAB_COLOR_VARIABLES.replace(/:host/g, ':root');
    document.head.appendChild(colorStyle);

    // Inject component styles
    const componentStyle = document.createElement('style');
    componentStyle.id = 'onhovermessage-styles';
    componentStyle.textContent = onHoverMessageStyles;
    document.head.appendChild(componentStyle);

    styleInjectedRef.current = true;

    return () => {
      // Cleanup on unmount (only if this is the last instance)
      // Note: In a real app, you might want to track instances
    };
  }, []);

  // Calculate tooltip position
  const updatePosition = useCallback(() => {
    if (!targetRef.current || !tooltipRef.current) return;

    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - offset;
        left = targetRect.left + (targetRect.width / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + (targetRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2);
        left = targetRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2);
        left = targetRect.right + offset;
        break;
    }

    // Keep tooltip within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 0) {
      left = 8;
    } else if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - 8;
    }

    if (top < 0) {
      top = 8;
    } else if (top + tooltipRect.height > viewportHeight) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
    });
  }, [targetRef, position, offset]);

  // Auto-show tooltip when forceShow is true
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      // Small delay to ensure tooltip is rendered before calculating position
      setTimeout(() => {
        updatePosition();
      }, 50);
    }
  }, [forceShow, updatePosition]);

  // Handle mouse enter/leave on target element
  useEffect(() => {
    const targetElement = targetRef.current;
    if (!targetElement) return;

    const updatePositionWithDelay = () => {
      setIsVisible(true);
      // Small delay to ensure tooltip is rendered before calculating position
      setTimeout(() => {
        updatePosition();
      }, 0);
    };

    const handleMouseEnter = () => {
      updatePositionWithDelay();
    };

    const handleMouseLeave = () => {
      // When forceShow is active, don't hide on mouse leave
      if (!forceShow) {
        setIsVisible(false);
      }
    };

    targetElement.addEventListener('mouseenter', handleMouseEnter);
    targetElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      targetElement.removeEventListener('mouseenter', handleMouseEnter);
      targetElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [targetRef, position, offset, updatePosition, forceShow]);

  // Update position on scroll and resize
  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, updatePosition]);

  // Recalculate position when tooltip becomes visible
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      updatePosition();
    }
  }, [isVisible, message, updatePosition]);

  // Always render the component to allow smooth CSS transitions
  // Don't return null - let CSS handle visibility
  if (!message) {
    return null;
  }

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={`onHoverMessage ${isVisible ? 'visible' : ''} ${position} ${shortcut ? 'hasShortcut' : ''} ${variant === 'featureDiscovery' ? 'featureDiscovery' : ''} ${variant === 'featureDiscovery' && currentTheme === 'dark' ? 'dark' : ''} ${className}`}
      style={tooltipStyle}
      role="tooltip"
      aria-live="polite"
    >
      {message}
      {shortcut && (
        <span className="onHoverMessageShortcut">{shortcut}</span>
      )}
    </div>
  );

  // Render outside Shadow DOM using portal to document.body
  return createPortal(tooltipContent, document.body);
};

OnHoverMessage.displayName = 'OnHoverMessage';

