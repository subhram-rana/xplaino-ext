// src/content/components/OnHoverMessage/OnHoverMessage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import { currentThemeAtom } from '@/store/uiAtoms';
import onHoverMessageStyles from '../../styles/onHoverMessage.shadow.css?inline';
import { FAB_COLOR_VARIABLES } from '../../../constants/colors.css';
import { getOrCreatePortalContainer, getPortalShadowRoot } from '../../utils/portalRoot';

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

  // Inject styles into the portal's shadow root (not document.head)
  useEffect(() => {
    if (styleInjectedRef.current) return;

    const shadow = getPortalShadowRoot();

    if (shadow.querySelector('[data-xplaino-onhover-styles]')) {
      styleInjectedRef.current = true;
      return;
    }

    const colorStyle = document.createElement('style');
    colorStyle.setAttribute('data-xplaino-onhover-vars', '');
    colorStyle.textContent = FAB_COLOR_VARIABLES;
    shadow.appendChild(colorStyle);

    const componentStyle = document.createElement('style');
    componentStyle.setAttribute('data-xplaino-onhover-styles', '');
    componentStyle.textContent = onHoverMessageStyles;
    shadow.appendChild(componentStyle);

    styleInjectedRef.current = true;
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

  // Auto-show tooltip when forceShow is true, fade out when it turns false
  useEffect(() => {
    if (forceShow) {
      // Calculate position first while still invisible, then reveal.
      // The element is in the DOM with opacity:0/visibility:hidden so
      // getBoundingClientRect() returns correct dimensions.
      requestAnimationFrame(() => {
        updatePosition();
        setIsVisible(true);
      });
    } else {
      // When forceShow turns off, trigger CSS fade-out transition
      setIsVisible(false);
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

  // Render into dedicated portal container so CSS variables don't leak to page
  return createPortal(tooltipContent, getOrCreatePortalContainer());
};

OnHoverMessage.displayName = 'OnHoverMessage';

