// src/content/components/FAB/FAB.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ActionButton } from './ActionButton';
import { FABDisablePopover } from './FABDisablePopover';
import { TranslationControlPopover } from './TranslationControlPopover';
import styles from './FAB.module.css';
import { ENV } from '@/config/env';
import { useAtomValue } from 'jotai';
import { currentThemeAtom } from '@/store/uiAtoms';

export interface FABProps {
  /** Callback when Summarise is clicked */
  onSummarise?: () => void;
  /** Callback when Translate is clicked (start translation) */
  onTranslate?: () => void;
  /** Callback when translation is stopped */
  onStopTranslation?: () => void;
  /** Callback when toggle view is clicked */
  onToggleView?: (mode: 'original' | 'translated') => void;
  /** Callback when clear translations is clicked */
  onClearTranslations?: () => void;
  /** Callback when Options is clicked */
  onOptions?: () => void;
  /** Callback when Save page link is clicked */
  onSaveUrl?: () => void;
  /** Callback when Feature Request is clicked */
  onFeatureRequest?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Whether summarise button is loading */
  isSummarising?: boolean;
  /** Whether a summary already exists */
  hasSummary?: boolean;
  /** Whether it's safe to hide actions (after first event received) */
  canHideActions?: boolean;
  /** Callback to show disable notification modal */
  onShowModal?: () => void;
  /** Whether any panel (side panel or text explanation panel) is open */
  isPanelOpen?: boolean;
  /** Translation state */
  translationState?: 'idle' | 'translating' | 'partially-translated' | 'fully-translated';
  /** View mode for translations */
  viewMode?: 'original' | 'translated';
  /** Whether the current page is bookmarked/saved */
  isBookmarked?: boolean;
}

export const FAB: React.FC<FABProps> = ({
  onSummarise,
  onTranslate,
  onStopTranslation,
  onToggleView,
  onClearTranslations,
  onOptions,
  onSaveUrl,
  onFeatureRequest,
  useShadowDom = false,
  isSummarising = false,
  hasSummary = false,
  canHideActions = true,
  onShowModal,
  isPanelOpen = false,
  translationState = 'idle',
  viewMode = 'translated',
  isBookmarked = false,
}) => {
  const [actionsVisible, setActionsVisible] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [showDisablePopover, setShowDisablePopover] = useState(false);
  const [showTranslationPopover, setShowTranslationPopover] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false); // Track when height animation completes
  const [isClosing, setIsClosing] = useState(false); // Track closing animation state
  const [iconUrl, setIconUrl] = useState<string>('');
  const parentRef = useRef<HTMLDivElement>(null);
  const actionsContainerRef = useRef<HTMLDivElement>(null); // Ref for height animation
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track animation timeout
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track closing animation timeout
  const lastMeasuredHeight = useRef<number>(0); // Store the last measured height for closing animation
  const isHoveringRef = useRef(false);
  const isDisablingRef = useRef(false);
  const disableButtonClickedRef = useRef(false); // Track if disable button was just clicked

  // Get class names based on context
  const getClassName = useCallback((shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  }, [useShadowDom]);

  // Subscribe to theme changes
  const currentTheme = useAtomValue(currentThemeAtom);

  // Load icon URL based on theme
  useEffect(() => {
    if (useShadowDom) {
      const iconName = currentTheme === 'dark' 
        ? 'xplaino-turquoise-icon.ico' 
        : 'xplaino-purple-icon.ico';
      const url = chrome.runtime.getURL(`src/assets/icons/${iconName}`);
      setIconUrl(url);
    } else {
      setIconUrl('');
    }
  }, [useShadowDom, currentTheme]);

  // Clear pulse animation after it plays
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPulse(false);
    }, 6000); // 3 pulses * 2s each
    return () => clearTimeout(timer);
  }, []);

  // Clear any pending hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Handle FAB button hover - shows actions (unless a panel is open)
  const handleFabMouseEnter = useCallback(() => {
    clearHideTimeout();
    isHoveringRef.current = true;
    // Don't show actions if any panel is open
    if (!isPanelOpen) {
      setActionsVisible(true);
    }
  }, [clearHideTimeout, isPanelOpen]);

  // Handle parent container mouse enter - keeps actions visible
  const handleParentMouseEnter = useCallback(() => {
    clearHideTimeout();
    isHoveringRef.current = true;
  }, [clearHideTimeout]);

  // Handle parent container mouse leave - hides actions after delay
  const handleParentMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    // Don't hide if summarising, translating, if actions shouldn't be hidden yet, if any popover is open, or if disable action is in progress
    const isTranslating = translationState === 'translating';
    if (isSummarising || isTranslating || !canHideActions || showDisablePopover || showTranslationPopover || isDisablingRef.current) {
      return;
    }
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current && !isDisablingRef.current) {
        setActionsVisible(false);
      }
    }, 300); // Small delay before hiding
  }, [clearHideTimeout, isSummarising, translationState, canHideActions, showDisablePopover, showTranslationPopover]);

  // Hide actions immediately when any panel opens
  useEffect(() => {
    if (isPanelOpen) {
      setActionsVisible(false);
    }
  }, [isPanelOpen]);

  // Don't hide actions if any popover is visible
  useEffect(() => {
    if (showDisablePopover || showTranslationPopover) {
      // Keep actions visible when popover is open
      clearHideTimeout();
      isHoveringRef.current = true;
      if (!actionsVisible) {
        setActionsVisible(true);
      }
    }
  }, [showDisablePopover, showTranslationPopover, clearHideTimeout, actionsVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
    };
  }, []);

  // Height animation for actions container (similar to ContentActionsButtonGroup width animation)
  useEffect(() => {
    if (!actionsContainerRef.current) {
      return;
    }

    const element = actionsContainerRef.current;
    const heightAnimationDuration = 400; // ms

    if (!actionsVisible) {
      // CLOSING: Animate height from current size to 0
      setAnimationComplete(false);
      setShowDisablePopover(false); // Close any open popovers
      setShowTranslationPopover(false);

      // Clear any pending animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }

      // Start from the last measured height (or current height)
      const currentHeightValue = element.style.getPropertyValue('--button-group-height');
      const currentHeight = currentHeightValue ? parseFloat(currentHeightValue) : lastMeasuredHeight.current;

      if (currentHeight > 0) {
        // Set closing state to keep element visible during animation
        setIsClosing(true);

        // Set current height first to ensure smooth transition
        element.style.setProperty('--button-group-height', `${currentHeight}px`);
        void element.offsetHeight; // Force reflow

        // Then animate to 0
        requestAnimationFrame(() => {
          element.style.setProperty('--button-group-height', '0px');
        });

        // Clear closing state after animation completes
        closingTimeoutRef.current = setTimeout(() => {
          setIsClosing(false);
        }, heightAnimationDuration + 50);
      } else {
        element.style.setProperty('--button-group-height', '0px');
        setIsClosing(false);
      }

      return;
    }

    // OPENING: Animate height from 0 to natural size
    setAnimationComplete(false);
    setIsClosing(false);

    // Wait for DOM to be ready
    const rafId1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!element) return;

        // Get current height if it exists
        const currentHeightValue = element.style.getPropertyValue('--button-group-height');
        const currentHeight = currentHeightValue ? parseFloat(currentHeightValue) : 0;

        // Temporarily remove constraints to measure natural height
        const savedMaxHeight = element.style.maxHeight;
        element.style.maxHeight = 'none';
        element.style.height = 'auto';
        element.style.setProperty('--button-group-height', 'auto');

        // Force layout recalculation
        void element.offsetHeight;

        // Measure the natural height
        const naturalHeight = element.scrollHeight;
        lastMeasuredHeight.current = naturalHeight; // Store for closing animation

        const firstButtonHeight = 38; // Approximate height of first button

        // Restore max-height
        element.style.maxHeight = savedMaxHeight || '500px';
        element.style.height = '';

        // If initial appearance, start from first button height
        if (currentHeight === 0) {
          element.style.setProperty('--button-group-height', `${firstButtonHeight}px`);
          void element.offsetHeight;
        }

        // Trigger height animation to expand
        requestAnimationFrame(() => {
          if (!element) return;
          element.style.setProperty('--button-group-height', `${naturalHeight}px`);

          animationTimeoutRef.current = setTimeout(() => {
            setAnimationComplete(true);
          }, heightAnimationDuration + 100);
        });
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [actionsVisible]);

  // Click outside handler - close popovers and hide actions when clicking outside
  // Uses composedPath() to correctly handle Shadow DOM boundaries
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Use composedPath() to get all elements in the event path, including through Shadow DOM
      const path = event.composedPath();
      
      // Check if any element in the path is our FAB parent container
      const isClickInside = path.some((element) => element === parentRef.current);
      
      if (!isClickInside) {
        // Click was outside - close popover and hide actions
        if (showDisablePopover) {
          setShowDisablePopover(false);
        }
        if (showTranslationPopover) {
          setShowTranslationPopover(false);
        }
        // Hide actions if they're visible and can be hidden
        if (actionsVisible && canHideActions && !isSummarising && translationState !== 'translating') {
          setActionsVisible(false);
        }
      }
    };

    // Only add listener if actions are visible or a popover is open
    if (actionsVisible || showDisablePopover || showTranslationPopover) {
      // Use window to capture all clicks, including those in Shadow DOM
      window.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        window.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [actionsVisible, showDisablePopover, showTranslationPopover, canHideActions, isSummarising, translationState]);

  // Action handlers
  const handleSummarise = useCallback(() => {
    console.log('[FAB] Summarise clicked');
    onSummarise?.();
  }, [onSummarise]);

  const handleTranslate = useCallback(() => {
    if (translationState === 'translating') {
      // Stop translation
      console.log('[FAB] Stop translation clicked');
      onStopTranslation?.();
    } else if (translationState === 'idle') {
      // Start translation (only allowed when idle)
      console.log('[FAB] Start translation clicked');
      onTranslate?.();
    } else if (translationState === 'partially-translated' || translationState === 'fully-translated') {
      // Toggle popover when button is disabled (has translations)
      console.log('[FAB] Toggling translation popover');
      setShowTranslationPopover(prev => !prev);
    }
  }, [translationState, onTranslate, onStopTranslation]);

  const handleToggleView = useCallback((mode: 'original' | 'translated') => {
    console.log('[FAB] Toggle view clicked:', mode);
    onToggleView?.(mode);
  }, [onToggleView]);

  const handleClearTranslations = useCallback(() => {
    console.log('[FAB] Clear translations clicked');
    setShowTranslationPopover(false);
    onClearTranslations?.();
  }, [onClearTranslations]);

  const handleTranslatePopoverMouseLeave = useCallback(() => {
    // Hide popover when mouse leaves (if it was shown)
    setShowTranslationPopover(false);
  }, []);

  const handleOptions = useCallback(() => {
    console.log('[FAB] Options clicked');
    onOptions?.();
  }, [onOptions]);

  const handleSaveUrl = useCallback(() => {
    console.log('[FAB] Save page link clicked');
    onSaveUrl?.();
  }, [onSaveUrl]);

  const handleDisableExtensionButtonClick = useCallback(() => {
    // Set flag to prevent mouse leave from immediately closing the popover
    disableButtonClickedRef.current = true;
    setTimeout(() => {
      disableButtonClickedRef.current = false;
    }, 100); // Reset flag after a short delay
    
    setShowDisablePopover((prev) => {
      const newValue = !prev;
      if (newValue) {
        // Popover is opening - ensure actions stay visible
        clearHideTimeout();
        isHoveringRef.current = true;
        setActionsVisible(true);
      }
      return newValue;
    });
  }, [clearHideTimeout]);

  const handleDisabled = useCallback(() => {
    // Set disable flag to prevent actions from hiding
    isDisablingRef.current = true;
    // Keep actions visible during disable process
    clearHideTimeout();
    isHoveringRef.current = true;
    setActionsVisible(true);
    // Close the popover
    setShowDisablePopover(false);
    // Clear the disable flag after a delay to allow storage listener to process
    // The FAB will be removed by the storage listener, so this is just a safety measure
    setTimeout(() => {
      isDisablingRef.current = false;
    }, 500);
  }, [clearHideTimeout]);

  const handleDisablePopoverMouseLeave = useCallback(() => {
    // Don't close popover if disable action is in progress
    if (isDisablingRef.current) {
      return;
    }
    // Don't close popover if the disable button was just clicked (toggle action)
    if (disableButtonClickedRef.current) {
      return;
    }
    // Hide popover when mouse leaves
    setShowDisablePopover(false);
  }, []);

  const handleGoToWebsite = useCallback(() => {
    console.log('[FAB] My dashboard clicked');
    window.open(`${ENV.XPLAINO_WEBSITE_BASE_URL}/user/dashboard`, '_blank');
  }, []);

  const handleFeatureRequest = useCallback(() => {
    console.log('[FAB] Feature request clicked');
    onFeatureRequest?.();
  }, [onFeatureRequest]);

  const handleReportIssue = useCallback(() => {
    console.log('[FAB] Report issue clicked');
    window.open(`${ENV.XPLAINO_WEBSITE_BASE_URL}/report-issue`, '_blank');
  }, []);

  // Class names for Shadow DOM vs CSS Modules
  const fabParentClass = getClassName(
    'fabParent',
    styles.fabParent
  );
  const actionsContainerClass = getClassName(
    `actionsContainer ${actionsVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''} ${animationComplete ? 'animationComplete' : ''}`,
    `${styles.actionsContainer} ${actionsVisible ? styles.visible : ''} ${isClosing ? styles.closing : ''} ${animationComplete ? styles.animationComplete : ''}`
  );
  const actionButtonClass = getClassName('actionButton', styles.actionButton);
  const fabContainerClass = getClassName('fabContainer', styles.fabContainer);
  const fabButtonClass = getClassName(
    `fabButton ${showPulse ? 'pulse' : ''} ${actionsVisible ? 'actionsVisible' : ''}`,
    `${styles.fabButton} ${showPulse ? styles.pulse : ''} ${actionsVisible ? styles.actionsVisible : ''}`
  );

  return (
    <div
      ref={parentRef}
      className={fabParentClass}
      onMouseEnter={handleParentMouseEnter}
      onMouseLeave={handleParentMouseLeave}
    >
      {/* Actions Container - on the left */}
      <div ref={actionsContainerRef} className={actionsContainerClass}>
        <ActionButton
          icon="summarise"
          tooltip={hasSummary ? 'View summary' : 'Summarise page'}
          onClick={handleSummarise}
          className={actionButtonClass}
          isLoading={isSummarising}
        />
        <div style={{ position: 'relative' }}>
          <ActionButton
            icon={translationState === 'translating' ? 'stop' : 'translate'}
            tooltip={
              translationState === 'idle' ? 'Translate Page' :
              translationState === 'translating' ? 'Stop Translation' :
              'Translation Controls'
            }
            onClick={handleTranslate}
            className={`${actionButtonClass} ${translationState === 'translating' ? 'stopTranslating' : ''}`}
            disabled={false}
            hideTooltip={showTranslationPopover}
          />
          <TranslationControlPopover
            viewMode={viewMode}
            onToggleView={handleToggleView}
            onClear={handleClearTranslations}
            visible={showTranslationPopover}
            useShadowDom={useShadowDom}
            onMouseLeave={handleTranslatePopoverMouseLeave}
          />
        </div>
        <ActionButton
          icon="bookmark"
          tooltip={isBookmarked ? "Remove saved link" : "Save page link"}
          onClick={handleSaveUrl}
          className={actionButtonClass}
          isBookmarked={isBookmarked}
        />
        <ActionButton
          icon="settings"
          tooltip="Settings"
          onClick={handleOptions}
          className={actionButtonClass}
        />
        <ActionButton
          icon="dashboard"
          tooltip="My dashboard"
          onClick={handleGoToWebsite}
          className={actionButtonClass}
        />
        <ActionButton
          icon="featureRequest"
          tooltip="Feature request"
          onClick={handleFeatureRequest}
          className={actionButtonClass}
        />
        <ActionButton
          icon="reportIssue"
          tooltip="Report issue"
          onClick={handleReportIssue}
          className={actionButtonClass}
        />
        <div style={{ position: 'relative' }}>
          <ActionButton
            icon="disable"
            tooltip="Disable extension"
            onClick={handleDisableExtensionButtonClick}
            className={actionButtonClass}
            hideTooltip={showDisablePopover}
          />
          <FABDisablePopover
            visible={showDisablePopover}
            onDisabled={handleDisabled}
            onMouseEnter={handleParentMouseEnter}
            onMouseLeave={handleDisablePopoverMouseLeave}
            onShowModal={onShowModal}
          />
        </div>
      </div>

      {/* FAB Container - on the right */}
      <div className={fabContainerClass}>
        <button
          className={fabButtonClass}
          onMouseEnter={handleFabMouseEnter}
          aria-label="Xplaino Actions"
        >
          <img
            src={iconUrl}
            alt="Xplaino"
            style={{ 
              width: '27px', 
              height: '27px',
              objectFit: 'contain'
            }}
          />
        </button>
      </div>
    </div>
  );
};

FAB.displayName = 'FAB';
