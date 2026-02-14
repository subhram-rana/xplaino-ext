// src/content/components/FeatureDiscoveryTooltip/FeatureDiscoveryTooltip.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import { shouldShowTextFeatureAtom, shouldShowWordFeatureAtom, currentThemeAtom } from '@/store/uiAtoms';
import onHoverMessageStyles from '../../styles/onHoverMessage.shadow.css?inline';
import { FAB_COLOR_VARIABLES } from '../../../constants/colors.css';

/**
 * Known text-centric HTML tags that inherently contain readable text.
 * When the cursor is over one of these, the tooltip should show.
 */
const TEXT_TAGS = new Set([
  'p', 'span', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'td', 'th', 'label', 'blockquote', 'pre', 'code',
  'em', 'strong', 'b', 'i', 'u', 'small', 'mark', 'del',
  'ins', 'sub', 'sup', 'abbr', 'cite', 'q', 'figcaption',
  'dt', 'dd', 'legend', 'caption',
]);

/**
 * Non-text elements that should always be excluded.
 */
const EXCLUDED_TAGS = new Set([
  'img', 'video', 'audio', 'canvas', 'svg', 'input',
  'textarea', 'select', 'button', 'iframe', 'object', 'embed',
]);

/**
 * FeatureDiscoveryTooltip - A cursor-following tooltip that teaches users
 * about text selection and word double-click features.
 *
 * Uses the same OnHoverMessage CSS classes with the featureDiscovery variant
 * for a white/dark theme-aware appearance with neutral shadow.
 *
 * Shows when hovering over text content on the page. The tooltip follows
 * the mouse cursor and displays one or both messages:
 * - "Select text to explain" (when shouldShowTextFeatureAtom is true)
 * - "Double-click a word to explain" (when shouldShowWordFeatureAtom is true)
 *
 * The tooltip is dismissed when the user performs the corresponding action.
 */
export const FeatureDiscoveryTooltip: React.FC = () => {
  const shouldShowText = useAtomValue(shouldShowTextFeatureAtom);
  const shouldShowWord = useAtomValue(shouldShowWordFeatureAtom);
  const currentTheme = useAtomValue(currentThemeAtom);

  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const styleInjectedRef = useRef(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isDark = currentTheme === 'dark';

  // Inject onHoverMessage styles into document.head (reuses the same styles as OnHoverMessage)
  useEffect(() => {
    if (styleInjectedRef.current) return;

    const existingStyle = document.getElementById('onhovermessage-styles');
    if (existingStyle) {
      styleInjectedRef.current = true;
      return;
    }

    // Inject CSS variables with :root selector
    const existingColorStyle = document.getElementById('onhovermessage-color-variables');
    if (!existingColorStyle) {
      const colorStyle = document.createElement('style');
      colorStyle.id = 'onhovermessage-color-variables';
      colorStyle.textContent = FAB_COLOR_VARIABLES.replace(/:host/g, ':root');
      document.head.appendChild(colorStyle);
    }

    // Inject component styles (same as OnHoverMessage)
    const componentStyle = document.createElement('style');
    componentStyle.id = 'onhovermessage-styles';
    componentStyle.textContent = onHoverMessageStyles;
    document.head.appendChild(componentStyle);

    styleInjectedRef.current = true;
  }, []);

  /**
   * Check if an element has direct text node children with non-whitespace content.
   * This ensures we only match elements that themselves contain text, not just
   * container elements whose descendants contain text.
   */
  const hasDirectTextContent = useCallback((element: HTMLElement): boolean => {
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text && text.length > 0) {
          return true;
        }
      }
    }
    return false;
  }, []);

  /**
   * Check if a mouse target is over text content that should trigger the tooltip.
   * Uses a tag allowlist for known text elements and a direct text node check
   * for generic containers (div, section, article, etc.).
   * Excludes images, inputs, xplaino UI elements, and other non-text elements.
   */
  const isOverTextContent = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();

    // Exclude non-text elements
    if (EXCLUDED_TAGS.has(tagName)) {
      return false;
    }

    // Exclude xplaino UI elements
    if (target.id?.startsWith('xplaino-') || target.closest('[id^="xplaino-"]')) {
      return false;
    }

    // If it's a known text tag, check it has meaningful text
    if (TEXT_TAGS.has(tagName)) {
      const text = target.innerText?.trim();
      return !!(text && text.length > 0);
    }

    // For generic containers (div, section, article, etc.),
    // only match if the element itself has direct text node children
    return hasDirectTextContent(target);
  }, [hasDirectTextContent]);

  // Handle mouse movement
  useEffect(() => {
    if (!shouldShowText && !shouldShowWord) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isOverTextContent(e.target)) {
        setIsVisible(true);
        // Offset tooltip 12px right and 16px below cursor
        setPosition({
          x: e.clientX + 12,
          y: e.clientY + 16,
        });
      } else {
        setIsVisible(false);
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    // Hide tooltip when user starts selecting text or interacting
    const handleMouseDown = () => {
      setIsVisible(false);
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [shouldShowText, shouldShowWord, isOverTextContent]);

  // Don't render anything if both flags are false
  if (!shouldShowText && !shouldShowWord) {
    return null;
  }

  // Theme-aware brand icon URL (purple for light, turquoise for dark)
  const brandIconUrl = (() => {
    const iconName = isDark
      ? 'xplaino-turquoise-icon.ico'
      : 'xplaino-purple-icon.ico';
    return chrome.runtime.getURL(`src/assets/icons/${iconName}`);
  })();

  // Theme-aware separator color
  const separatorColor = isDark ? 'rgba(224, 224, 224, 0.15)' : 'rgba(13, 128, 112, 0.15)';

  // Icon style shared between single and dual layouts
  const iconImgStyle: React.CSSProperties = {
    width: '14px',
    height: '14px',
    flexShrink: 0,
    borderRadius: '2px',
  };

  // Keep tooltip within viewport
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    // Override OnHoverMessage transforms since we're using cursor-following positioning
    transform: 'none',
    // Allow wrapping for multi-line content
    whiteSpace: 'normal',
    maxWidth: '280px',
  };

  // Adjust position to keep tooltip in viewport (when visible)
  if (isVisible && tooltipRef.current) {
    const rect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (position.x + rect.width > viewportWidth) {
      tooltipStyle.left = `${position.x - rect.width - 24}px`;
    }
    if (position.y + rect.height > viewportHeight) {
      tooltipStyle.top = `${position.y - rect.height - 24}px`;
    }
  }

  const showBoth = shouldShowText && shouldShowWord;

  // Build the message text
  const messages: string[] = [];
  if (shouldShowText) messages.push('Select text to explain');
  if (shouldShowWord) messages.push('Double-click a word to explain');

  // Build className with featureDiscovery variant and theme
  const tooltipClassName = [
    'onHoverMessage',
    isVisible ? 'visible' : '',
    'featureDiscovery',
    isDark ? 'dark' : '',
  ].filter(Boolean).join(' ');

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={tooltipClassName}
      style={tooltipStyle}
      role="tooltip"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img
          src={brandIconUrl}
          alt="Xplaino"
          style={iconImgStyle}
        />
        {showBoth ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>Select text to explain</span>
            <div style={{
              height: '1px', background: separatorColor,
              margin: '0',
            }} />
            <span>Double-click a word to explain</span>
          </div>
        ) : (
          <span>{messages[0]}</span>
        )}
      </div>
    </div>
  );

  // Render outside Shadow DOM using portal to document.body
  return createPortal(tooltipContent, document.body);
};

FeatureDiscoveryTooltip.displayName = 'FeatureDiscoveryTooltip';
