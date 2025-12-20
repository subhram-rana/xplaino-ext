// src/components/ui/IconTabGroup/IconTabGroup.tsx
import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import styles from './IconTabGroup.module.css';

export interface IconTab {
  id: string;
  icon: LucideIcon;
  label?: string; // Optional for accessibility/tooltips
}

export interface IconTabGroupProps {
  /** Array of tab configurations */
  tabs: IconTab[];
  /** Currently active tab ID */
  activeTabId: string;
  /** Handler called when a tab is clicked */
  onTabChange: (tabId: string) => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Icon size in pixels */
  iconSize?: number;
  /** Icon stroke width (thickness) */
  strokeWidth?: number;
  /** Tab size in pixels (applies to both height and width) */
  tabSize?: number;
  /** Distance between consecutive tabs in pixels */
  tabGap?: number;
}

export const IconTabGroup: React.FC<IconTabGroupProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  useShadowDom = false,
  iconSize = 24,
  strokeWidth = 2.0,
  tabSize = 32,
  tabGap = 0,
}) => {
  const tabGroupRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tooltipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const isInitialMount = useRef(true);
  const lastActiveTabId = useRef<string>(activeTabId);
  const clickedTabId = useRef<string | null>(null);

  // Initialize tab refs array
  useEffect(() => {
    tabRefs.current = tabs.map(() => null);
    wrapperRefs.current = tabs.map(() => null);
    tooltipRefs.current = tabs.map(() => null);
  }, [tabs]);

  // Calculate tooltip position to prevent overflow
  const updateTooltipPosition = useCallback((tabId: string, index: number) => {
    const wrapper = wrapperRefs.current[index];
    const tooltip = tooltipRefs.current[index];
    if (!wrapper || !tooltip) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 8; // Minimum distance from viewport edge

    // Calculate centered position
    const centerX = wrapperRect.left + wrapperRect.width / 2;
    const tooltipLeft = centerX - tooltipRect.width / 2;
    const tooltipRight = centerX + tooltipRect.width / 2;

    let position: 'left' | 'center' | 'right' = 'center';

    // Check if tooltip would overflow on the right
    if (tooltipRight > viewportWidth - margin) {
      // Position tooltip to align right edge with viewport margin
      position = 'right';
    }
    // Check if tooltip would overflow on the left
    else if (tooltipLeft < margin) {
      // Position tooltip to align left edge with viewport margin
      position = 'left';
    }

    setTooltipPosition((prev) => ({ ...prev, [tabId]: position }));
  }, []);

  // Update tooltip position when hovered
  useEffect(() => {
    if (!hoveredTabId) return;

    const index = tabs.findIndex((tab) => tab.id === hoveredTabId);
    if (index === -1) return;

    // Small delay to ensure tooltip is rendered
    const timeoutId = setTimeout(() => {
      updateTooltipPosition(hoveredTabId, index);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [hoveredTabId, tabs, updateTooltipPosition]);

  const updateSliderPosition = useCallback((animate: boolean = false) => {
    if (!sliderRef.current || !tabGroupRef.current) return false;

    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (activeIndex === -1) return false;

    // Use wrapper's offsetLeft since button is now inside wrapper
    const activeWrapper = wrapperRefs.current[activeIndex];
    if (!activeWrapper) return false;

    // Apply animated class directly to element if needed
    if (sliderRef.current) {
      if (useShadowDom) {
        // Shadow DOM - use plain class name
        if (animate) {
          sliderRef.current.classList.add('animated');
        } else {
          sliderRef.current.classList.remove('animated');
        }
      } else {
        // CSS Modules - use hashed class name
        const animatedClass = styles.animated;
        if (animatedClass) {
          if (animate) {
            sliderRef.current.classList.add(animatedClass);
          } else {
            sliderRef.current.classList.remove(animatedClass);
          }
        }
      }
    }

    // Use offsetLeft which gives position relative to offset parent (tabGroup)
    // This properly accounts for padding and layout
    const offsetX = activeWrapper.offsetLeft;
    // Use tabSize prop to ensure slider matches button size exactly (square)
    const size = tabSize;

    sliderRef.current.style.transform = `translateX(${offsetX}px)`;
    sliderRef.current.style.width = `${size}px`;
    sliderRef.current.style.height = `${size}px`;
    return true;
  }, [activeTabId, tabs, useShadowDom, styles, tabSize]);

  // Use layout effect for initial mount to ensure slider is positioned before paint
  useLayoutEffect(() => {
    updateSliderPosition(false); // No animation on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastActiveTabId.current = activeTabId;
    }
  }, [updateSliderPosition]);

  // Also use a regular effect as a fallback for initial mount with retry
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    
    const tryUpdate = () => {
      const success = updateSliderPosition();
      if (!success && retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryUpdate, 20 * retryCount); // Exponential backoff
      }
    };

    // Initial attempt after a small delay
    const timeoutId = setTimeout(tryUpdate, 10);

    return () => clearTimeout(timeoutId);
  }, []); // Only run on mount

  // Update slider position when activeTabId changes
  useEffect(() => {
    // Skip if this is the initial mount (handled by useLayoutEffect)
    if (isInitialMount.current) {
      return;
    }

    // Check if activeTabId actually changed
    if (lastActiveTabId.current === activeTabId) {
      return;
    }

    // Check if this change matches a user click
    const wasUserClick = clickedTabId.current === activeTabId;
    
    // Clear the clicked tab ID after checking
    clickedTabId.current = null;
    
    if (wasUserClick) {
      // User interaction - animate the transition
      // Use double RAF to ensure animated class is applied before position update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateSliderPosition(true);
        });
      });
    } else {
      // Prop change from parent - update position without animation
      updateSliderPosition(false);
    }
    
    lastActiveTabId.current = activeTabId;
  }, [activeTabId, updateSliderPosition]);

  // Handle window resize to recalculate slider position
  useEffect(() => {
    const handleResize = () => {
      updateSliderPosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateSliderPosition]);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  return (
    <div 
      className={getClassName('tabGroup')} 
      ref={tabGroupRef}
      style={{ gap: `${tabGap}px` }}
    >
      <div 
        className={getClassName('tabSlider')}
        ref={sliderRef} 
      />
      {tabs.map((tab, index) => {
        const IconComponent = tab.icon;
        const isActive = activeTabId === tab.id;
        const showTooltip = hoveredTabId === tab.id && tab.label;

        const tabClassName = useShadowDom
          ? `tab ${isActive ? 'active' : ''}`
          : `${styles.tab} ${isActive ? styles.active : ''}`;

        return (
          <div
            key={tab.id}
            ref={(el) => {
              wrapperRefs.current[index] = el;
            }}
            className={getClassName('tabWrapper')}
            onMouseEnter={() => tab.label && setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
          >
            <button
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              className={tabClassName}
              style={{ width: `${tabSize}px`, height: `${tabSize}px`, minWidth: `${tabSize}px`, minHeight: `${tabSize}px`, maxWidth: `${tabSize}px`, maxHeight: `${tabSize}px` }}
              onClick={() => {
                // Mark this tab as clicked so we know to animate
                clickedTabId.current = tab.id;
                onTabChange(tab.id);
              }}
              aria-label={tab.label || tab.id}
              type="button"
            >
              <IconComponent size={iconSize} strokeWidth={strokeWidth} />
            </button>
            {showTooltip && (
              <div
                ref={(el) => {
                  tooltipRefs.current[index] = el;
                }}
                className={`${getClassName('tabTooltip')} ${tooltipPosition[tab.id] || 'center'}`}
              >
                {tab.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

IconTabGroup.displayName = 'IconTabGroup';

