// src/content/components/ContentActions/DisablePopover.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Globe, Monitor } from 'lucide-react';
import { useEmergeAnimation } from '../../../hooks';

export interface DisablePopoverProps {
  /** Whether the popover is visible */
  visible: boolean;
  /** Callback after disable action is executed */
  onDisabled?: () => void;
  /** Callback when mouse enters (to keep container active) */
  onMouseEnter?: () => void;
  /** Callback when mouse leaves (to hide container) */
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Callback to show disable notification modal */
  onShowModal?: () => void;
}

/**
 * Extract domain from URL (same logic as content/index.ts)
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Update extension settings in chrome.storage.local
 */
async function updateExtensionSettings(
  updates: { globalDisabled?: boolean; domainStatus?: { domain: string; status: string } }
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('extension_settings', (result) => {
      const settings = result.extension_settings || {
        globalDisabled: false,
        domainSettings: {},
      };

      if (updates.globalDisabled !== undefined) {
        settings.globalDisabled = updates.globalDisabled;
      }

      if (updates.domainStatus) {
        settings.domainSettings[updates.domainStatus.domain] = updates.domainStatus.status;
      }

      chrome.storage.local.set({ extension_settings: settings }, () => {
        resolve();
      });
    });
  });
}

export const DisablePopover: React.FC<DisablePopoverProps> = ({
  visible,
  onDisabled,
  onMouseEnter,
  onMouseLeave,
  onShowModal,
}) => {
  const [currentDomain] = useState(() => extractDomain(window.location.href));
  const wasVisible = useRef(false);

  // Animation hook
  const {
    elementRef,
    sourceRef,
    emerge,
    shrink,
    shouldRender,
    style: animationStyle,
    animationState,
  } = useEmergeAnimation({
    duration: 300,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Slight overshoot for playful feel
    transformOrigin: 'top right', // Animate from top-right (near the button)
  });

  // Find the source button from DOM (parent button element)
  // This is more reliable than ref passing which has timing issues
  useEffect(() => {
    // The popover is rendered inside ContentActionButton's div wrapper
    // which contains the button as a sibling
    const popoverElement = elementRef.current;
    if (popoverElement) {
      // Find the closest button sibling or ancestor
      const wrapper = popoverElement.parentElement;
      const button = wrapper?.querySelector('button.contentActionButton');
      if (button) {
        (sourceRef as React.MutableRefObject<HTMLElement | null>).current = button as HTMLElement;
      }
    }
  }, [elementRef, sourceRef, shouldRender]); // Re-run when element renders

  // Handle visibility changes with animation
  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Opening
      wasVisible.current = true;
      emerge();
    } else if (!visible && wasVisible.current) {
      // Closing
      wasVisible.current = false;
      shrink();
    }
  }, [visible, emerge, shrink]);

  const handleDisableGlobally = useCallback(async () => {
    await updateExtensionSettings({ globalDisabled: true });
    console.log('[ContentActions] Disabled globally');
    onDisabled?.();
    onShowModal?.();
  }, [onDisabled, onShowModal]);

  const handleDisableOnSite = useCallback(async () => {
    if (!currentDomain) return;
    await updateExtensionSettings({
      domainStatus: { domain: currentDomain, status: 'DISABLED' },
    });
    console.log('[ContentActions] Disabled on:', currentDomain);
    onDisabled?.();
    onShowModal?.();
  }, [currentDomain, onDisabled, onShowModal]);

  // Don't render if animation is complete and not visible
  if (!shouldRender && !visible) return null;

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`disablePopover ${animationState === 'shrinking' ? 'closing' : ''}`}
      style={animationStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        className="disablePopoverOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleDisableGlobally();
        }}
      >
        <Globe size={14} strokeWidth={2.5} />
        <span>All sites</span>
      </button>
      <button
        className="disablePopoverOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleDisableOnSite();
        }}
      >
        <Monitor size={14} strokeWidth={2.5} />
        <span>This site</span>
      </button>
    </div>
  );
};

DisablePopover.displayName = 'DisablePopover';

