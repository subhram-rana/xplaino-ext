// src/content/components/FAB/FAB.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ActionButton } from './ActionButton';
import styles from './FAB.module.css';

export interface FABProps {
  /** Callback when Summarise is clicked */
  onSummarise?: () => void;
  /** Callback when Translate is clicked */
  onTranslate?: () => void;
  /** Callback when Options is clicked */
  onOptions?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

/**
 * Get the icon URL - handles both regular and Shadow DOM contexts
 */
function getIconUrl(useShadowDom: boolean): string {
  if (useShadowDom) {
    // In Shadow DOM, use chrome.runtime.getURL for extension assets
    return chrome.runtime.getURL('src/assets/icons/xplaino-purple-icon.ico');
  }
  // For regular React context, import would be used
  return '';
}

export const FAB: React.FC<FABProps> = ({
  onSummarise,
  onTranslate,
  onOptions,
  useShadowDom = false,
}) => {
  const [actionsVisible, setActionsVisible] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);

  // Get class names based on context
  const getClassName = useCallback((shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  }, [useShadowDom]);

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

  // Handle FAB button hover - shows actions
  const handleFabMouseEnter = useCallback(() => {
    clearHideTimeout();
    isHoveringRef.current = true;
    setActionsVisible(true);
  }, [clearHideTimeout]);

  // Handle parent container mouse enter - keeps actions visible
  const handleParentMouseEnter = useCallback(() => {
    clearHideTimeout();
    isHoveringRef.current = true;
  }, [clearHideTimeout]);

  // Handle parent container mouse leave - hides actions after delay
  const handleParentMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setActionsVisible(false);
      }
    }, 300); // Small delay before hiding
  }, [clearHideTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Action handlers
  const handleSummarise = useCallback(() => {
    console.log('[FAB] Summarise clicked');
    onSummarise?.();
  }, [onSummarise]);

  const handleTranslate = useCallback(() => {
    console.log('[FAB] Translate clicked');
    onTranslate?.();
  }, [onTranslate]);

  const handleOptions = useCallback(() => {
    console.log('[FAB] Options clicked');
    onOptions?.();
  }, [onOptions]);

  const iconUrl = getIconUrl(useShadowDom);

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
    `fabButton ${showPulse ? 'pulse' : ''}`,
    `${styles.fabButton} ${showPulse ? styles.pulse : ''}`
  );

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
          tooltip="Summarise Page"
          onClick={handleSummarise}
          className={actionButtonClass}
        />
        <ActionButton
          icon="translate"
          tooltip="Translate Page"
          onClick={handleTranslate}
          className={actionButtonClass}
        />
        <ActionButton
          icon="options"
          tooltip="Options"
          onClick={handleOptions}
          className={actionButtonClass}
        />
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
              width: '28px', 
              height: '28px',
              objectFit: 'contain'
            }}
          />
        </button>
      </div>
    </div>
  );
};

FAB.displayName = 'FAB';
