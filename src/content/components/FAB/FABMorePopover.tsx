// src/content/components/FAB/FABMorePopover.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Lightbulb, Bug, Globe, Monitor } from 'lucide-react';
import { useEmergeAnimation } from '../../../hooks';

export interface FABMorePopoverProps {
  /** Whether the popover is visible */
  visible: boolean;
  /** Callback when Feature Request is clicked */
  onFeatureRequest?: () => void;
  /** Callback when Report Issue is clicked */
  onReportIssue?: () => void;
  /** Callback after disable action is executed */
  onDisabled?: () => void;
  /** Callback when mouse enters (to keep container active) */
  onMouseEnter?: () => void;
  /** Callback when mouse leaves (to hide popover) */
  onMouseLeave?: () => void;
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

export const FABMorePopover: React.FC<FABMorePopoverProps> = ({
  visible,
  onFeatureRequest,
  onReportIssue,
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
    duration: 200,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'right center',
    mode: 'simple',
  });

  // Find the source button from DOM (parent button element)
  useEffect(() => {
    const popoverElement = elementRef.current;
    if (popoverElement) {
      const wrapper = popoverElement.parentElement;
      const button = wrapper?.querySelector('button.actionButton') || wrapper?.querySelector('button');
      if (button) {
        (sourceRef as React.MutableRefObject<HTMLElement | null>).current = button as HTMLElement;
      }
    }
  }, [elementRef, sourceRef, shouldRender]);

  // Handle visibility changes with animation
  useEffect(() => {
    if (visible && !wasVisible.current) {
      wasVisible.current = true;
      emerge();
    } else if (!visible && wasVisible.current) {
      wasVisible.current = false;
      shrink();
    }
  }, [visible, emerge, shrink]);

  const handleFeatureRequest = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[FAB] Feature request clicked');
    onFeatureRequest?.();
  }, [onFeatureRequest]);

  const handleReportIssue = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[FAB] Report issue clicked');
    onReportIssue?.();
  }, [onReportIssue]);

  const handleDisableGlobally = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    onDisabled?.();
    onShowModal?.();
    await new Promise(resolve => setTimeout(resolve, 50));
    await updateExtensionSettings({ globalDisabled: true });
    console.log('[FAB] Disabled globally');
  }, [onDisabled, onShowModal]);

  const handleDisableOnSite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentDomain) return;
    onDisabled?.();
    onShowModal?.();
    await new Promise(resolve => setTimeout(resolve, 50));
    await updateExtensionSettings({
      domainStatus: { domain: currentDomain, status: 'DISABLED' },
    });
    console.log('[FAB] Disabled on:', currentDomain);
  }, [currentDomain, onDisabled, onShowModal]);

  const handleMouseLeave = useCallback(() => {
    onMouseLeave?.();
  }, [onMouseLeave]);

  // Don't render if animation is complete and not visible
  if (!shouldRender && !visible) return null;

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`fabMorePopover ${animationState === 'shrinking' ? 'closing' : ''}`}
      style={animationStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="fabMorePopoverOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleFeatureRequest}
      >
        <Lightbulb size={14} strokeWidth={2.5} />
        <span>Request a feature</span>
      </button>
      <button
        className="fabMorePopoverOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleReportIssue}
      >
        <Bug size={14} strokeWidth={2.5} />
        <span>Report issue</span>
      </button>
      <div className="fabMorePopoverDivider" />
      <button
        className="fabMorePopoverOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleDisableOnSite}
      >
        <Monitor size={14} strokeWidth={2.5} />
        <span>Disable on this site</span>
      </button>
      <button
        className="fabMorePopoverOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleDisableGlobally}
      >
        <Globe size={14} strokeWidth={2.5} />
        <span>Disable on all sites</span>
      </button>
    </div>
  );
};

FABMorePopover.displayName = 'FABMorePopover';
