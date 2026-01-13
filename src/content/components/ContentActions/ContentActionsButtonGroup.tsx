// src/content/components/ContentActions/ContentActionsButtonGroup.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ContentActionButton } from './ContentActionButton';
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
  onShowModal: _onShowModal, // Keep for backward compatibility but don't use
  onActionComplete,
}) => {
  const [showOptionsPopover, setShowOptionsPopover] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false); // Track when width animation completes
  const [isClosing, setIsClosing] = useState(false); // Track closing animation state
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null);
  const lastMeasuredWidth = useRef<number>(0); // Store the last measured width for closing animation

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
    };
  }, []);

  // Handle click on 3-dot options button - toggle popover
  const handleOptionsButtonClick = useCallback(() => {
    setShowOptionsPopover((prev) => {
      const newValue = !prev;
      if (newValue) {
        // Popover is opening - ensure states stay active
        onKeepActive?.();
      }
      return newValue;
    });
  }, [onKeepActive]);

  const handleHideButtonGroup = useCallback(() => {
    // Hide popover when an option is clicked
    setShowOptionsPopover(false);
    // Trigger action complete to clear selection
    onActionComplete?.();
  }, [onActionComplete]);

  // Measure actual content width and set it dynamically for smooth expansion/collapse animation
  useEffect(() => {
    if (!buttonGroupRef.current) {
      return;
    }

    const element = buttonGroupRef.current;
    const widthAnimationDuration = 400; // ms
    
    if (!visible) {
      // CLOSING: Animate width from current size to 0
      setAnimationComplete(false);
      setShowOptionsPopover(false); // Close any open popovers
      
      // Clear any pending animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      
      // Start from the last measured width (or current width)
      const currentWidthValue = element.style.getPropertyValue('--button-group-width');
      const currentWidth = currentWidthValue ? parseFloat(currentWidthValue) : lastMeasuredWidth.current;
      
      if (currentWidth > 0) {
        // Set closing state to keep element visible during animation
        setIsClosing(true);
        
        // Set current width first to ensure smooth transition
        element.style.setProperty('--button-group-width', `${currentWidth}px`);
        void element.offsetWidth; // Force reflow
        
        // Then animate to 0
        requestAnimationFrame(() => {
          element.style.setProperty('--button-group-width', '0px');
        });
        
        // Clear closing state after animation completes
        closingTimeoutRef.current = setTimeout(() => {
          setIsClosing(false);
        }, widthAnimationDuration + 50);
      } else {
        element.style.setProperty('--button-group-width', '0px');
        setIsClosing(false);
      }
      
      return;
    }

    // OPENING: Animate width from 0 to natural size
    setAnimationComplete(false);
    setIsClosing(false);

    // Wait for DOM to be ready
    const rafId1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!element) return;
        
        // Get current width if it exists
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
        lastMeasuredWidth.current = naturalWidth; // Store for closing animation
        
        const firstButtonWidth = 30;
        
        // Restore max-width
        element.style.maxWidth = savedMaxWidth || '500px';
        element.style.width = '';
        
        // If initial appearance, start from first button width
        if (currentWidth === 0) {
          element.style.setProperty('--button-group-width', `${firstButtonWidth}px`);
          void element.offsetWidth;
        }
        
        // Trigger width animation to expand
        requestAnimationFrame(() => {
          if (!element) return;
          element.style.setProperty('--button-group-width', `${naturalWidth}px`);
          
          animationTimeoutRef.current = setTimeout(() => {
            setAnimationComplete(true);
          }, widthAnimationDuration + 100);
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
  }, [visible]);

  return (
    <div
      ref={buttonGroupRef}
      className={`contentActionsButtonGroup ${visible ? 'visible' : ''} ${isClosing ? 'closing' : ''} ${animationComplete ? 'animationComplete' : ''} ${!isWordSelection ? 'hasBookmark' : ''}`}
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
      
      {/* Options button (3 dots) with options popover - CLICK to toggle */}
      <div className="optionsButtonWrapper">
        <ContentActionButton
          icon="options"
          tooltip="More options"
          onClick={handleOptionsButtonClick}
          delay={2}
          className="optionsButton"
          hideTooltip={showOptionsPopover}
        >
          <ActionButtonOptionsPopover
            visible={showOptionsPopover}
            isWordSelection={isWordSelection}
            onTranslate={onTranslate}
            onSynonym={onSynonym}
            onOpposite={onOpposite}
            onHideButtonGroup={handleHideButtonGroup}
          />
        </ContentActionButton>
      </div>
    </div>
  );
};

ContentActionsButtonGroup.displayName = 'ContentActionsButtonGroup';

