// src/content/components/FAB/FAB.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { FABMorePopover } from './FABMorePopover';
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
  /** Callback when Ask About Page is clicked */
  onAskAboutPage?: () => void;
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
  /** Whether to force-show the action buttons (e.g. from keyboard shortcut) */
  forceShowActions?: boolean;
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
  onAskAboutPage,
  useShadowDom = false,
  isSummarising = false,
  hasSummary = false,
  canHideActions = true,
  onShowModal,
  isPanelOpen = false,
  translationState = 'idle',
  viewMode = 'translated',
  isBookmarked = false,
  forceShowActions = false,
}) => {
  const [actionsVisible, setActionsVisible] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [showMorePopover, setShowMorePopover] = useState(false);
  const [showTranslationPopover, setShowTranslationPopover] = useState(false);
  const [iconUrl, setIconUrl] = useState<string>('');
  const parentRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);
  const isDisablingRef = useRef(false);
  const moreButtonClickedRef = useRef(false); // Track if more button was just clicked

  // Detect Mac vs Windows/Linux for keyboard shortcut labels
  const isMac = useMemo(() => /Mac|iPod|iPhone|iPad/.test(navigator.platform), []);
  const summariseShortcut = isMac ? '⌘M' : 'Ctrl+M';
  const askAboutPageShortcut = isMac ? '⌘b' : 'Ctrl+b';
  const translateShortcut = isMac ? '⌘K' : 'Ctrl+K';

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

  // Clear pulse animation after it plays (0.5s delay + 1s bounce animation + buffer)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPulse(false);
    }, 2000); // 0.5s slide-in delay + 1s scale bounce + 0.5s buffer
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
    // Don't hide if summarising, if actions shouldn't be hidden yet, if any popover is open, or if disable action is in progress
    if (isSummarising || !canHideActions || showMorePopover || showTranslationPopover || isDisablingRef.current) {
      return;
    }
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current && !isDisablingRef.current) {
        setActionsVisible(false);
      }
    }, 300); // Small delay before hiding
  }, [clearHideTimeout, isSummarising, canHideActions, showMorePopover, showTranslationPopover]);

  // Force-show actions when triggered externally (e.g. keyboard shortcut)
  useEffect(() => {
    if (forceShowActions) {
      setActionsVisible(true);
    }
  }, [forceShowActions]);

  // Hide actions immediately when any panel opens
  useEffect(() => {
    if (isPanelOpen) {
      setActionsVisible(false);
    }
  }, [isPanelOpen]);

  // Hide actions immediately when page translation starts
  useEffect(() => {
    if (translationState === 'translating') {
      setActionsVisible(false);
    }
  }, [translationState]);

  // Don't hide actions if any popover is visible
  useEffect(() => {
    if (showMorePopover || showTranslationPopover) {
      // Keep actions visible when popover is open
      clearHideTimeout();
      isHoveringRef.current = true;
      if (!actionsVisible) {
        setActionsVisible(true);
      }
    }
  }, [showMorePopover, showTranslationPopover, clearHideTimeout, actionsVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Close popovers when actions become hidden
  useEffect(() => {
    if (!actionsVisible) {
      setShowMorePopover(false);
      setShowTranslationPopover(false);
    }
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
        if (showMorePopover) {
          setShowMorePopover(false);
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
    if (actionsVisible || showMorePopover || showTranslationPopover) {
      // Use window to capture all clicks, including those in Shadow DOM
      window.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        window.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [actionsVisible, showMorePopover, showTranslationPopover, canHideActions, isSummarising, translationState]);

  // Action handlers
  const handleSummarise = useCallback(() => {
    console.log('[FAB] Summarise clicked');
    onSummarise?.();
  }, [onSummarise]);

  const handleAskAboutPage = useCallback(() => {
    console.log('[FAB] Ask about page clicked');
    onAskAboutPage?.();
  }, [onAskAboutPage]);

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

  const handleMoreButtonClick = useCallback(() => {
    // Set flag to prevent mouse leave from immediately closing the popover
    moreButtonClickedRef.current = true;
    setTimeout(() => {
      moreButtonClickedRef.current = false;
    }, 100); // Reset flag after a short delay
    
    setShowMorePopover((prev) => {
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
    setShowMorePopover(false);
    // Clear the disable flag after a delay to allow storage listener to process
    // The FAB will be removed by the storage listener, so this is just a safety measure
    setTimeout(() => {
      isDisablingRef.current = false;
    }, 500);
  }, [clearHideTimeout]);

  const handleMorePopoverMouseLeave = useCallback(() => {
    // Don't close popover if disable action is in progress
    if (isDisablingRef.current) {
      return;
    }
    // Don't close popover if the more button was just clicked (toggle action)
    if (moreButtonClickedRef.current) {
      return;
    }
    // Hide popover when mouse leaves
    setShowMorePopover(false);
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
    `actionsContainer ${actionsVisible ? 'visible' : ''}`,
    `${styles.actionsContainer} ${actionsVisible ? styles.visible : ''}`
  );
  const actionButtonClass = getClassName('actionButton', styles.actionButton);
  const fabContainerClass = getClassName('fabContainer', styles.fabContainer);
  const fabButtonClass = getClassName(
    `fabButton ${showPulse ? 'pulse' : ''} ${actionsVisible ? 'actionsVisible' : ''}`,
    `${styles.fabButton} ${showPulse ? styles.pulse : ''} ${actionsVisible ? styles.actionsVisible : ''}`
  );
  const translationSpinnerClass = getClassName('translationSpinner', styles.translationSpinner);

  return (
    <div
      ref={parentRef}
      className={fabParentClass}
      onMouseEnter={handleParentMouseEnter}
      onMouseLeave={handleParentMouseLeave}
    >
      {/* Actions Container - on the left */}
      <div className={actionsContainerClass}>
        <ActionButton
          icon="summarise"
          tooltip={hasSummary ? 'View summary' : 'Summarise page'}
          shortcut={summariseShortcut}
          onClick={handleSummarise}
          className={actionButtonClass}
          isLoading={isSummarising}
        />
        <ActionButton
          icon="askAboutPage"
          tooltip="Ask about page"
          shortcut={askAboutPageShortcut}
          onClick={handleAskAboutPage}
          className={actionButtonClass}
        />
        <div style={{ position: 'relative' }}>
          <ActionButton
            icon={translationState === 'translating' ? 'stop' : 'translate'}
            tooltip={
              translationState === 'idle' ? 'Translate Page' :
              translationState === 'translating' ? 'Stop Translation' :
              'Translation Controls'
            }
            shortcut={translateShortcut}
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
        <div style={{ position: 'relative' }}>
          <ActionButton
            icon="options"
            tooltip="More"
            onClick={handleMoreButtonClick}
            className={actionButtonClass}
            hideTooltip={showMorePopover}
          />
          <FABMorePopover
            visible={showMorePopover}
            onFeatureRequest={handleFeatureRequest}
            onReportIssue={handleReportIssue}
            onDisabled={handleDisabled}
            onMouseEnter={handleParentMouseEnter}
            onMouseLeave={handleMorePopoverMouseLeave}
            onShowModal={onShowModal}
          />
        </div>
      </div>

      {/* Translation Spinner - shown to the left of FAB when translating (hidden when actions are visible) */}
      {translationState === 'translating' && !actionsVisible && (
        <div className={translationSpinnerClass}>
          <Loader2 size={16} strokeWidth={2.5} />
        </div>
      )}

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
