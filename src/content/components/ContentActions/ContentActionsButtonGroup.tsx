// src/content/components/ContentActions/ContentActionsButtonGroup.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ContentActionButton } from './ContentActionButton';
import { DisablePopover } from './DisablePopover';
import { ActionButtonOptionsPopover } from './ActionButtonOptionsPopover';

export interface ContentActionsButtonGroupProps {
  /** Whether the button group is visible */
  visible: boolean;
  /** Whether the current selection is a word (shows different options in popover) */
  isWordSelection: boolean;
  /** Callback when Explain is clicked */
  onExplain: () => void;
  /** Callback when Grammar is clicked */
  onGrammar: () => void;
  /** Callback when Translate is clicked */
  onTranslate: () => void;
  /** Callback when Bookmark is clicked */
  onBookmark: () => void;
  /** Callback when Synonym is clicked */
  onSynonym?: () => void;
  /** Callback when Opposite is clicked */
  onOpposite?: () => void;
  /** Callback when mouse enters (to keep container active) */
  onMouseEnter?: () => void;
  /** Callback when mouse leaves (to hide container) */
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Callback to force keep states active (e.g., when popover opens) */
  onKeepActive?: () => void;
  /** Callback to show disable notification modal */
  onShowModal?: () => void;
  /** Callback when action is complete (clear selection) */
  onActionComplete?: () => void;
}

export const ContentActionsButtonGroup: React.FC<ContentActionsButtonGroupProps> = ({
  visible,
  isWordSelection,
  onExplain,
  onGrammar: _onGrammar, // Keep for backward compatibility but don't use
  onTranslate,
  onBookmark,
  onSynonym,
  onOpposite,
  onMouseEnter,
  onMouseLeave,
  onKeepActive,
  onShowModal,
  onActionComplete,
}) => {
  const [showDisablePopover, setShowDisablePopover] = useState(false);
  const [showOptionsPopover, setShowOptionsPopover] = useState(false);
  const [showDisableButton, setShowDisableButton] = useState(false);
  const [isDisableButtonHiding, setIsDisableButtonHiding] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false); // Track when width animation completes
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const powerButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPopoverShowingRef = useRef(false); // Debounce popover showing to prevent glitches
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  const handleDisableExtensionButtonClick = useCallback(() => {
    setShowDisablePopover((prev) => {
      const newValue = !prev;
      if (newValue) {
        // Popover is opening - ensure states stay active
        onKeepActive?.();
      }
      return newValue;
    });
  }, [onKeepActive]);

  const handleDisabled = useCallback(() => {
    setShowDisablePopover(false);
  }, []);

  const hideOptionsAndDisableButton = useCallback(() => {
    // Cancel any pending power button timeout
    if (powerButtonTimeoutRef.current) {
      clearTimeout(powerButtonTimeoutRef.current);
      powerButtonTimeoutRef.current = null;
    }
    // Reset debounce flag
    isPopoverShowingRef.current = false;
    // First hide the popover
    setShowOptionsPopover(false);
    // Close the disable popover if it's open
    setShowDisablePopover(false);
    // Hide disable button - width animation will handle the visual transition
    setShowDisableButton(false);
    setIsDisableButtonHiding(false);
  }, []);

  const handleOptionsButtonMouseEnter = useCallback(() => {
    // Cancel any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // Prevent re-triggering if already showing (fixes glitch on double-click)
    if (isPopoverShowingRef.current) return;
    isPopoverShowingRef.current = true;
    
    // Show popover immediately
    setShowOptionsPopover(true);
    setIsDisableButtonHiding(false);
    
    // Cancel any pending power button timeout
    if (powerButtonTimeoutRef.current) {
      clearTimeout(powerButtonTimeoutRef.current);
    }
    
    // Show power button immediately for smooth width animation
    setShowDisableButton(true);
    
    // Reset debounce flag after a short delay
    setTimeout(() => {
      isPopoverShowingRef.current = false;
    }, 300);
    
    onKeepActive?.();
  }, [onKeepActive]);

  const handleOptionsButtonMouseLeave = useCallback(() => {
    // Start timeout before hiding both popover and disable button
    hideTimeoutRef.current = setTimeout(() => {
      hideOptionsAndDisableButton();
    }, 250); // Increased delay for smoother UX
  }, [hideOptionsAndDisableButton]);

  const handleOptionsPopoverMouseEnter = useCallback(() => {
    // Cancel hide timeout when entering popover
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    // Make sure popover stays visible
    setShowOptionsPopover(true);
    onMouseEnter?.();
  }, [onMouseEnter]);

  const handleOptionsPopoverMouseLeave = useCallback((e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget;
    
    // Check if moving to power button
    const isMovingToPowerButton = relatedTarget && relatedTarget instanceof Node && (
      (relatedTarget as HTMLElement).classList?.contains('powerButton') ||
      (relatedTarget as HTMLElement).closest?.('.powerButtonWrapper')
    );
    
    // Don't hide if moving to power button
    if (!isMovingToPowerButton) {
      hideTimeoutRef.current = setTimeout(() => {
        hideOptionsAndDisableButton();
      }, 250);
    }
    
    onMouseLeave?.(e);
  }, [hideOptionsAndDisableButton, onMouseLeave]);

  const handleDisableButtonMouseEnter = useCallback(() => {
    // Cancel hide timeout when entering disable button
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    // Close the options popover when moving to disable button
    setShowOptionsPopover(false);
    onMouseEnter?.();
  }, [onMouseEnter]);

  const handleDisableButtonMouseLeave = useCallback((e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget;
    
    // Check if moving to options popover or back to button group
    const isMovingToPopover = relatedTarget && relatedTarget instanceof Node && (
      (relatedTarget as HTMLElement).classList?.contains('actionButtonOptionsPopover') ||
      (relatedTarget as HTMLElement).closest?.('.actionButtonOptionsPopover')
    );
    
    const isMovingToButtonGroup = relatedTarget && relatedTarget instanceof Node && (
      (relatedTarget as HTMLElement).classList?.contains('contentActionsButtonGroup') ||
      (relatedTarget as HTMLElement).classList?.contains('contentActionButton') ||
      (relatedTarget as HTMLElement).closest?.('.contentActionsButtonGroup')
    );
    
    // Only hide if truly leaving the area
    if (!isMovingToPopover && !isMovingToButtonGroup) {
      // Delay hiding to allow smooth transition
      hideTimeoutRef.current = setTimeout(() => {
        hideOptionsAndDisableButton();
      }, 200);
    }
    
    onMouseLeave?.(e);
  }, [hideOptionsAndDisableButton, onMouseLeave]);

  const handleHideButtonGroup = useCallback(() => {
    // Clear any pending timeouts
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    // Hide everything when an option is clicked
    setShowOptionsPopover(false);
    setShowDisableButton(false);
    setIsDisableButtonHiding(false);
    // Trigger action complete to clear selection
    onActionComplete?.();
  }, [onActionComplete]);

  // Measure actual content width and set it dynamically for smooth expansion animation
  // Also calculate button delays based on their positions for progressive reveal effect
  useEffect(() => {
    if (!buttonGroupRef.current) {
      return;
    }

    const element = buttonGroupRef.current;
    
    if (!visible) {
      // Reset CSS variable and animation state when hidden
      element.style.setProperty('--button-group-width', '0px');
      setAnimationComplete(false);
      // Clear any pending animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      return;
    }

    // Reset animation complete state when visibility changes
    setAnimationComplete(false);

    // Wait a frame to ensure visibility: visible is applied
    const rafId1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Get current width if it exists (for power button expansion)
        const currentWidthValue = element.style.getPropertyValue('--button-group-width');
        const currentWidth = currentWidthValue ? parseFloat(currentWidthValue) : 0;
        
        // Temporarily remove constraints to measure natural width
        const savedMaxWidth = element.style.maxWidth;
        element.style.maxWidth = 'none';
        element.style.width = 'auto';
        element.style.setProperty('--button-group-width', 'auto');
        
        // Force layout recalculation
        void element.offsetWidth;
        
        // Measure the natural width
        const naturalWidth = element.scrollWidth;
        
        const widthExpansionDuration = 400; // ms - time for button group to fully expand
        
        // Calculate width of first button only
        // 1.5px border + 3px padding + 2px margin + 18px button + 2px margin + 3px padding + 1.5px border = 30px
        const firstButtonWidth = 30;
        
        // Restore max-width first
        element.style.maxWidth = savedMaxWidth || '500px';
        element.style.width = ''; // Clear inline width, use CSS variable
        
        // If this is the initial appearance (currentWidth is 0), start from first button width
        if (currentWidth === 0) {
          // Initial appearance - show first button immediately, then grow to reveal others
          element.style.setProperty('--button-group-width', `${firstButtonWidth}px`);
          // Force layout to ensure first button width is applied
          void element.offsetWidth;
        }
        
        // Now trigger the width animation (in next frame to ensure initial styles are applied)
        requestAnimationFrame(() => {
          element.style.setProperty('--button-group-width', `${naturalWidth}px`);
          
          // Set animation complete after width animation finishes
          // This allows overflow: visible for tooltips
          animationTimeoutRef.current = setTimeout(() => {
            setAnimationComplete(true);
          }, widthExpansionDuration + 100);
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
  }, [visible, showDisableButton, isDisableButtonHiding]);

  return (
    <div
      ref={buttonGroupRef}
      className={`contentActionsButtonGroup ${visible ? 'visible' : ''} ${animationComplete ? 'animationComplete' : ''} ${!isWordSelection ? 'hasBookmark' : ''} ${showDisableButton ? 'hasPowerButton' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Explain button */}
      <ContentActionButton
        icon="explain"
        tooltip="AI explanation"
        onClick={onExplain}
        delay={0}
      />
      
      {/* Bookmark button - only show for text selections, hide for word selections */}
      {!isWordSelection && (
        <ContentActionButton
          icon="bookmark"
          tooltip="Bookmark"
          onClick={() => {
            onBookmark();
            handleHideButtonGroup();
          }}
          delay={1}
        />
      )}
      
      {/* Options button (3 dots) with options popover */}
      <div className="optionsButtonWrapper">
        <ContentActionButton
          icon="options"
          tooltip="Options"
          onClick={() => {}} // No-op, hover shows the popover
          delay={2}
          className="optionsButton"
          hideTooltip={showOptionsPopover}
          onButtonMouseEnter={handleOptionsButtonMouseEnter}
          onButtonMouseLeave={handleOptionsButtonMouseLeave}
        >
          <ActionButtonOptionsPopover
            visible={showOptionsPopover}
            isWordSelection={isWordSelection}
            onTranslate={onTranslate}
            onSynonym={onSynonym}
            onOpposite={onOpposite}
            onMouseEnter={handleOptionsPopoverMouseEnter}
            onMouseLeave={handleOptionsPopoverMouseLeave}
            onHideButtonGroup={handleHideButtonGroup}
          />
        </ContentActionButton>
      </div>
      
      {/* Power button with disable popover - conditionally visible */}
      {showDisableButton && (
        <div 
          className="powerButtonWrapper"
          onMouseEnter={handleDisableButtonMouseEnter}
          onMouseLeave={handleDisableButtonMouseLeave}
        >
          <ContentActionButton
            icon="power"
            tooltip="Disable extension"
            onClick={handleDisableExtensionButtonClick}
            delay={0}
            className="powerButton"
            hideTooltip={showDisablePopover}
          >
            <DisablePopover
              visible={showDisablePopover}
              onDisabled={handleDisabled}
              onMouseEnter={handleDisableButtonMouseEnter}
              onMouseLeave={handleDisableButtonMouseLeave}
              onShowModal={onShowModal}
            />
          </ContentActionButton>
        </div>
      )}
    </div>
  );
};

ContentActionsButtonGroup.displayName = 'ContentActionsButtonGroup';

