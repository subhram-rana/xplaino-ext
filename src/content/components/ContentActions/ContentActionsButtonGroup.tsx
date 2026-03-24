// src/content/components/ContentActions/ContentActionsButtonGroup.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ContentActionButton } from './ContentActionButton';
import { ActionButtonOptionsPopover } from './ActionButtonOptionsPopover';
import { OnHoverMessage } from '../OnHoverMessage';
import type { HighlightColour } from '@/api-services/HighlightColourService';

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
  /** Callback when Bookmark is clicked (kept for side-panel / other flows) */
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
  // --- Highlight color picker ---
  /** Available highlight colours from GET /api/highlight/colours */
  highlightColours?: HighlightColour[];
  /** ID of the currently selected highlight colour */
  selectedHighlightColourId?: string | null;
  /** Called with the hexcode of the chosen colour to save the highlight */
  onHighlightWithColor?: (hexcode: string) => void;
  /** Callback when Add a note is clicked (text selection) */
  onNote?: () => void;
}

const DEFAULT_HIGHLIGHT_HEXCODE = '#fbbf24'; // amber/yellow fallback

export const ContentActionsButtonGroup: React.FC<ContentActionsButtonGroupProps> = ({
  visible,
  isWordSelection,
  onExplain,
  onGrammar: _onGrammar, // Keep for backward compatibility but don't use
  onTranslate,
  onBookmark: _onBookmark, // Kept for API compatibility but not shown in the button group
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
  // Highlight color picker
  highlightColours = [],
  selectedHighlightColourId = null,
  onHighlightWithColor,
  onNote,
}) => {
  const [showOptionsPopover, setShowOptionsPopover] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false); // Track when width animation completes
  const [isClosing, setIsClosing] = useState(false); // Track closing animation state
  const [isHighlightButtonMounted, setIsHighlightButtonMounted] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null);
  const highlightButtonRef = useRef<HTMLButtonElement>(null);
  const lastMeasuredWidth = useRef<number>(0); // Store the last measured width for closing animation
  const isPopoverOpeningRef = useRef(false); // Track if popover is in opening phase to prevent premature close
  const openingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track opening timeout
  const colorPickerHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the active hexcode from the selected colour id
  const activeHexcode =
    highlightColours.find((c) => c.id === selectedHighlightColourId)?.hexcode ??
    highlightColours[0]?.hexcode ??
    DEFAULT_HIGHLIGHT_HEXCODE;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      if (closingTimeoutRef.current) clearTimeout(closingTimeoutRef.current);
      if (openingTimeoutRef.current) clearTimeout(openingTimeoutRef.current);
      if (colorPickerHoverTimeoutRef.current) clearTimeout(colorPickerHoverTimeoutRef.current);
    };
  }, []);

  // Track when highlight button is mounted for OnHoverMessage
  useEffect(() => {
    if (highlightButtonRef.current) {
      const timer = setTimeout(() => setIsHighlightButtonMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsHighlightButtonMounted(false);
    }
  }, [isWordSelection]);

  // ---- Options popover hover handlers ----

  const handleOptionsMouseEnter = useCallback(() => {
    if (openingTimeoutRef.current) clearTimeout(openingTimeoutRef.current);
    isPopoverOpeningRef.current = true;
    setShowOptionsPopover(true);
    onKeepActive?.();
    openingTimeoutRef.current = setTimeout(() => {
      isPopoverOpeningRef.current = false;
    }, 350);
  }, [onKeepActive]);

  const handleOptionsMouseLeave = useCallback((e: React.MouseEvent) => {
    if (isPopoverOpeningRef.current) return;
    const relatedTarget = e.relatedTarget;
    const wrapper = e.currentTarget as HTMLElement;
    // If moving into the popover (a DOM child of this wrapper) don't close
    const isMovingToChild = relatedTarget instanceof Node && wrapper.contains(relatedTarget);
    if (isMovingToChild) return;
    // Close immediately so the shrink animation starts without any extra delay
    setShowOptionsPopover(false);
  }, []);

  const handlePopoverMouseLeave = useCallback((e: React.MouseEvent) => {
    if (isPopoverOpeningRef.current) return;
    const relatedTarget = e.relatedTarget;
    const popover = e.currentTarget as HTMLElement;
    const wrapper = popover.closest('.optionsButtonWrapper');
    // If moving back to the button wrapper don't close
    const isMovingToWrapper = relatedTarget instanceof Node && wrapper && wrapper.contains(relatedTarget);
    if (isMovingToWrapper) return;
    // Close immediately so the shrink animation starts without any extra delay
    setShowOptionsPopover(false);
  }, []);

  // ---- Highlight color picker hover handlers ----

  const handleHighlightMouseEnter = useCallback(() => {
    if (colorPickerHoverTimeoutRef.current) {
      clearTimeout(colorPickerHoverTimeoutRef.current);
      colorPickerHoverTimeoutRef.current = null;
    }
    if (highlightColours.length > 0) {
      setShowColorPicker(true);
      onKeepActive?.();
    }
  }, [highlightColours.length, onKeepActive]);

  const handleHighlightMouseLeave = useCallback((e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget;
    const wrapper = e.currentTarget as HTMLElement;
    const isMovingToChild = relatedTarget instanceof Node && wrapper.contains(relatedTarget);
    if (isMovingToChild) return;
    colorPickerHoverTimeoutRef.current = setTimeout(() => {
      setShowColorPicker(false);
    }, 300);
  }, []);

  const handleHideButtonGroup = useCallback(() => {
    setShowOptionsPopover(false);
    setShowColorPicker(false);
    onActionComplete?.();
  }, [onActionComplete]);

  // Measure actual content width and set it dynamically for smooth expansion/collapse animation
  useEffect(() => {
    if (!buttonGroupRef.current) return;

    const element = buttonGroupRef.current;
    const widthAnimationDuration = 400; // ms

    if (!visible) {
      setAnimationComplete(false);
      setShowOptionsPopover(false);
      setShowColorPicker(false);

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }

      const currentWidthValue = element.style.getPropertyValue('--button-group-width');
      const currentWidth = currentWidthValue ? parseFloat(currentWidthValue) : lastMeasuredWidth.current;

      if (currentWidth > 0) {
        setIsClosing(true);
        element.style.setProperty('--button-group-width', `${currentWidth}px`);
        void element.offsetWidth;
        requestAnimationFrame(() => {
          element.style.setProperty('--button-group-width', '0px');
        });
        closingTimeoutRef.current = setTimeout(() => {
          setIsClosing(false);
        }, widthAnimationDuration + 50);
      } else {
        element.style.setProperty('--button-group-width', '0px');
        setIsClosing(false);
      }
      return;
    }

    setAnimationComplete(false);
    setIsClosing(false);

    const rafId1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!element) return;

        const currentWidthValue = element.style.getPropertyValue('--button-group-width');
        const currentWidth = currentWidthValue ? parseFloat(currentWidthValue) : 0;

        const savedMaxWidth = element.style.maxWidth;
        element.style.maxWidth = 'none';
        element.style.width = 'auto';
        element.style.setProperty('--button-group-width', 'auto');

        void element.offsetWidth;

        const naturalWidth = element.scrollWidth;
        lastMeasuredWidth.current = naturalWidth;

        const firstButtonWidth = 38;

        element.style.maxWidth = savedMaxWidth || '600px';
        element.style.width = '';

        if (currentWidth === 0) {
          element.style.setProperty('--button-group-width', `${firstButtonWidth}px`);
          void element.offsetWidth;
        }

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
      className={`contentActionsButtonGroup ${visible ? 'visible' : ''} ${isClosing ? 'closing' : ''} ${animationComplete ? 'animationComplete' : ''} ${!isWordSelection ? 'hasHighlight' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Explain button */}
      <ContentActionButton
        icon="explain"
        tooltip="Simplify"
        onClick={onExplain}
        delay={0}
      />

      {/* Highlight button — colored circle + color-picker popover on hover (text selections only) */}
      {!isWordSelection && (
        <div
          className="highlightColorButtonWrapper"
          onMouseEnter={handleHighlightMouseEnter}
          onMouseLeave={handleHighlightMouseLeave}
        >
          <button
            ref={highlightButtonRef}
            className="contentActionButton highlightColorButton"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onHighlightWithColor?.(activeHexcode);
              handleHideButtonGroup();
            }}
            aria-label="Highlight selected text"
            style={{ animationDelay: '120ms' }}
          >
            <span
              className="highlightColorCircle"
              style={{ background: activeHexcode }}
            />
          </button>

          {/* Tooltip — positioned above the button like other action buttons */}
          {isHighlightButtonMounted && highlightButtonRef.current && !showColorPicker && (
            <OnHoverMessage
              message="Highlight"
              targetRef={highlightButtonRef as React.RefObject<HTMLElement>}
              position="top"
              offset={8}
            />
          )}

          {/* Color picker popover — shown on hover */}
          {showColorPicker && highlightColours.length > 0 && (
            <div
              className="highlightColorPickerPopover"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={handleHighlightMouseEnter}
              onMouseLeave={handleHighlightMouseLeave}
            >
              {highlightColours.map((c) => (
                <button
                  key={c.id}
                  className={`highlightColourDot${c.id === selectedHighlightColourId ? ' highlightColourDotSelected' : ''}`}
                  style={{ background: c.hexcode }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHighlightWithColor?.(c.hexcode);
                    handleHideButtonGroup();
                  }}
                  aria-label={`Highlight with color ${c.hexcode}`}
                >
                  {c.id === selectedHighlightColourId && (
                    <span className="highlightColourCheck" aria-hidden="true">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note button — only for text (non-word) selections */}
      {!isWordSelection && (
        <ContentActionButton
          icon="note"
          tooltip="Add a note"
          onClick={() => {
            onNote?.();
            handleHideButtonGroup();
          }}
          delay={2}
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
          delay={3}
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
