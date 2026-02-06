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
  /** Callback when Ask AI is clicked */
  onAskAI?: () => void;
  /** Callback when Etymology is clicked */
  onEtymology?: () => void;
  /** Callback when Mnemonic is clicked */
  onMnemonic?: () => void;
  /** Callback when Quiz is clicked */
  onQuiz?: () => void;
  /** Callback when Common Mistakes is clicked */
  onCommonMistakes?: () => void;
  /** Callback when Better Alternative (formal) is clicked */
  onBetterFormal?: () => void;
  /** Callback when Better Alternative (casual) is clicked */
  onBetterCasual?: () => void;
  /** Callback when Better Alternative (academic) is clicked */
  onBetterAcademic?: () => void;
  // --- Text selection callbacks ---
  /** Callback when Ask AI is clicked (text selection) */
  onTextAskAI?: () => void;
  /** Callback when Summarize is clicked */
  onSummarize?: () => void;
  /** Callback when Key Points is clicked */
  onKeyPoints?: () => void;
  /** Callback when Rewrite is clicked */
  onRewrite?: () => void;
  /** Callback when Paraphrase is clicked */
  onParaphrase?: () => void;
  /** Callback when Improve Writing is clicked */
  onImproveWriting?: () => void;
  /** Callback when Fix Grammar is clicked */
  onFixGrammar?: () => void;
  /** Callback when Tone is clicked */
  onTone?: () => void;
  /** Callback when Convert to Bullets is clicked */
  onConvertBullets?: () => void;
  /** Callback when Convert to Table is clicked */
  onConvertTable?: () => void;
  /** Callback when Convert to Diagram is clicked */
  onConvertDiagram?: () => void;
  /** Callback when Create Mind Map is clicked */
  onCreateMindMap?: () => void;
  /** Callback when Convert to Email is clicked */
  onConvertEmail?: () => void;
  /** Callback when Convert to WhatsApp is clicked */
  onConvertWhatsApp?: () => void;
  /** Callback when Convert to LinkedIn is clicked */
  onConvertLinkedIn?: () => void;
  /** Callback when Convert to Tweet is clicked */
  onConvertTweet?: () => void;
  /** Callback when Convert to Presentation is clicked */
  onConvertPresentation?: () => void;
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
  onAskAI,
  onEtymology,
  onMnemonic,
  onQuiz,
  onCommonMistakes,
  onBetterFormal,
  onBetterCasual,
  onBetterAcademic,
  // Text selection props
  onTextAskAI,
  onSummarize,
  onKeyPoints,
  onRewrite,
  onParaphrase,
  onImproveWriting,
  onFixGrammar,
  onTone,
  onConvertBullets,
  onConvertTable,
  onConvertDiagram,
  onCreateMindMap,
  onConvertEmail,
  onConvertWhatsApp,
  onConvertLinkedIn,
  onConvertTweet,
  onConvertPresentation,
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
  const optionsHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track 500ms close delay for options popover
  const isPopoverOpeningRef = useRef(false); // Track if popover is in opening phase to prevent premature close
  const openingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track opening timeout

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
      if (optionsHoverTimeoutRef.current) {
        clearTimeout(optionsHoverTimeoutRef.current);
      }
      if (openingTimeoutRef.current) {
        clearTimeout(openingTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse enter on options button - show popover
  const handleOptionsMouseEnter = useCallback(() => {
    // Clear any pending close timeout
    if (optionsHoverTimeoutRef.current) {
      clearTimeout(optionsHoverTimeoutRef.current);
      optionsHoverTimeoutRef.current = null;
    }
    
    // Clear any previous opening timeout
    if (openingTimeoutRef.current) {
      clearTimeout(openingTimeoutRef.current);
    }
    
    // Mark as opening to prevent premature close during animation
    isPopoverOpeningRef.current = true;
    setShowOptionsPopover(true);
    onKeepActive?.();
    
    // Clear opening flag after animation completes (300ms animation + 50ms buffer)
    openingTimeoutRef.current = setTimeout(() => {
      isPopoverOpeningRef.current = false;
    }, 350);
  }, [onKeepActive]);

  // Handle mouse leave from options button wrapper - start 500ms close timer
  // Check if moving to a child element (like the popover) before starting timer
  const handleOptionsMouseLeave = useCallback((e: React.MouseEvent) => {
    // Don't start close timer if popover is still in opening phase
    if (isPopoverOpeningRef.current) {
      return;
    }
    
    const relatedTarget = e.relatedTarget;
    const wrapper = e.currentTarget as HTMLElement;
    
    // Check if moving to a child element (like the popover which is a DOM descendant)
    // relatedTarget must be a valid Node for contains() to work
    const isMovingToChild = relatedTarget instanceof Node && wrapper.contains(relatedTarget);
    
    // Don't start close timer if moving to a child element
    if (isMovingToChild) {
      return;
    }
    
    optionsHoverTimeoutRef.current = setTimeout(() => {
      setShowOptionsPopover(false);
    }, 500);
  }, []);

  // Handle mouse leave from popover - start 500ms close timer
  // Check if moving back to the wrapper before starting timer
  const handlePopoverMouseLeave = useCallback((e: React.MouseEvent) => {
    // Don't start close timer if popover is still in opening phase
    if (isPopoverOpeningRef.current) {
      return;
    }
    
    const relatedTarget = e.relatedTarget;
    const popover = e.currentTarget as HTMLElement;
    
    // Find the wrapper (parent of the popover's ancestor)
    const wrapper = popover.closest('.optionsButtonWrapper');
    
    // Check if moving back to the wrapper or any of its children
    // relatedTarget must be a valid Node for contains() to work
    const isMovingToWrapper = relatedTarget instanceof Node && wrapper && wrapper.contains(relatedTarget);
    
    // Don't start close timer if moving back to the wrapper
    if (isMovingToWrapper) {
      return;
    }
    
    optionsHoverTimeoutRef.current = setTimeout(() => {
      setShowOptionsPopover(false);
    }, 500);
  }, []);

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
      
      {/* Options button (3 dots) with options popover - HOVER to show */}
      <div 
        className="optionsButtonWrapper"
        onMouseEnter={handleOptionsMouseEnter}
        onMouseLeave={handleOptionsMouseLeave}
      >
        <ContentActionButton
          icon="options"
          tooltip="More options"
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
            onAskAI={onAskAI}
            onEtymology={onEtymology}
            onMnemonic={onMnemonic}
            onQuiz={onQuiz}
            onCommonMistakes={onCommonMistakes}
            onBetterFormal={onBetterFormal}
            onBetterCasual={onBetterCasual}
            onBetterAcademic={onBetterAcademic}
            onTextAskAI={onTextAskAI}
            onSummarize={onSummarize}
            onKeyPoints={onKeyPoints}
            onRewrite={onRewrite}
            onParaphrase={onParaphrase}
            onImproveWriting={onImproveWriting}
            onFixGrammar={onFixGrammar}
            onTone={onTone}
            onConvertBullets={onConvertBullets}
            onConvertTable={onConvertTable}
            onConvertDiagram={onConvertDiagram}
            onCreateMindMap={onCreateMindMap}
            onConvertEmail={onConvertEmail}
            onConvertWhatsApp={onConvertWhatsApp}
            onConvertLinkedIn={onConvertLinkedIn}
            onConvertTweet={onConvertTweet}
            onConvertPresentation={onConvertPresentation}
            onHideButtonGroup={handleHideButtonGroup}
            onPopoverMouseEnter={handleOptionsMouseEnter}
            onPopoverMouseLeave={handlePopoverMouseLeave}
          />
        </ContentActionButton>
      </div>
    </div>
  );
};

ContentActionsButtonGroup.displayName = 'ContentActionsButtonGroup';

