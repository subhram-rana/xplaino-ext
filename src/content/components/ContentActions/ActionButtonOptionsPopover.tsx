// src/content/components/ContentActions/ActionButtonOptionsPopover.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Replace, ArrowLeftRight, Sparkles,
  // Custom prompt icons
  BookMarked, Plus, ExternalLink,
} from 'lucide-react';
import { useSetAtom } from 'jotai';
import { useEmergeAnimation } from '../../../hooks';
import { CustomPromptService } from '@/api-services/CustomPromptService';
import type { CustomPromptResponse } from '@/api-services/dto/CustomPromptDTO';
import { ENV } from '@/config/env';
import { CreateCustomPromptModal } from '../CreateCustomPromptModal/CreateCustomPromptModal';
import { contentActionsModalOpenAtom } from '@/store/uiAtoms';

export interface ActionButtonOptionsPopoverProps {
  /** Whether the popover is visible */
  visible: boolean;
  /** Whether the current selection is a word (shows more options) */
  isWordSelection: boolean;
  /** Callback when Synonym is clicked */
  onSynonym?: () => void;
  /** Callback when Opposite is clicked */
  onOpposite?: () => void;
  /** Callback when Ask AI is clicked (word selection) */
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
  /** Callback when Ask AI is clicked (text selection) */
  onTextAskAI?: () => void;
  /** Callback when a custom prompt is clicked (word selection) */
  onWordCustomPromptClick?: (displayText: string, promptContent: string) => void;
  /** Callback when a custom prompt is clicked (text selection) */
  onTextCustomPromptClick?: (displayText: string, promptContent: string) => void;
  /** Callback to hide the action button group */
  onHideButtonGroup?: () => void;
  /** Callback when mouse enters popover (to cancel close timer) */
  onPopoverMouseEnter?: () => void;
  /** Callback when mouse leaves popover (to start close timer) */
  onPopoverMouseLeave?: (e: React.MouseEvent) => void;
}

export const ActionButtonOptionsPopover: React.FC<ActionButtonOptionsPopoverProps> = ({
  visible,
  isWordSelection,
  onSynonym,
  onOpposite,
  onAskAI,
  onEtymology: _onEtymology,
  onMnemonic: _onMnemonic,
  onQuiz: _onQuiz,
  onCommonMistakes: _onCommonMistakes,
  onBetterFormal: _onBetterFormal,
  onBetterCasual: _onBetterCasual,
  onBetterAcademic: _onBetterAcademic,
  onTextAskAI,
  onWordCustomPromptClick,
  onTextCustomPromptClick,
  onHideButtonGroup,
  onPopoverMouseEnter,
  onPopoverMouseLeave,
}) => {
  const wasVisible = useRef(false);
  const [customPrompts, setCustomPrompts] = useState<CustomPromptResponse[]>([]);
  const [showCreatePromptModal, setShowCreatePromptModal] = useState(false);
  const setContentActionsModalOpen = useSetAtom(contentActionsModalOpenAtom);

  const openCreatePromptModal = useCallback(() => {
    setShowCreatePromptModal(true);
    setContentActionsModalOpen(true);
  }, [setContentActionsModalOpen]);

  const closeCreatePromptModal = useCallback(() => {
    setShowCreatePromptModal(false);
    setContentActionsModalOpen(false);
  }, [setContentActionsModalOpen]);

  useEffect(() => {
    CustomPromptService.listCustomPrompts()
      .then((res) => setCustomPrompts(res.prompts.filter((p) => !p.isHidden)))
      .catch(() => { /* user may not be logged in */ });
  }, []);

  // Animation hook — simple mode: immediate fade+scale, no source polling
  const {
    elementRef,
    emerge,
    shrink,
    shouldRender,
    style: animationStyle,
    animationState,
  } = useEmergeAnimation({
    duration: 180,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    transformOrigin: 'top center',
    mode: 'simple',
  });

  // Callback ref — set element ref and hide before first paint
  const setPopoverRef = useCallback((element: HTMLDivElement | null) => {
    (elementRef as React.MutableRefObject<HTMLElement | null>).current = element;
    if (element) {
      element.style.transform = 'scale(0)';
      element.style.opacity = '0';
      element.style.transformOrigin = 'top center';
    }
  }, [elementRef]);

  // Handle visibility changes with animation — no delay on either direction
  useEffect(() => {
    if (visible && !wasVisible.current) {
      wasVisible.current = true;
      requestAnimationFrame(() => emerge());
    } else if (!visible && wasVisible.current) {
      wasVisible.current = false;
      shrink();
    }
  }, [visible, emerge, shrink]);

  const handleSynonymClick = useCallback(() => {
    onSynonym?.();
    onHideButtonGroup?.();
  }, [onSynonym, onHideButtonGroup]);

  const handleOppositeClick = useCallback(() => {
    onOpposite?.();
    onHideButtonGroup?.();
  }, [onOpposite, onHideButtonGroup]);

  const handleAskAIClick = useCallback(() => {
    onAskAI?.();
    onHideButtonGroup?.();
  }, [onAskAI, onHideButtonGroup]);

  const handleWordCustomPromptClick = useCallback((displayText: string, promptContent: string) => {
    onWordCustomPromptClick?.(displayText, promptContent);
    onHideButtonGroup?.();
  }, [onWordCustomPromptClick, onHideButtonGroup]);

  const handleTextAskAIClick = useCallback(() => {
    onTextAskAI?.();
    onHideButtonGroup?.();
  }, [onTextAskAI, onHideButtonGroup]);

  const handleTextCustomPromptClick = useCallback((displayText: string, promptContent: string) => {
    onTextCustomPromptClick?.(displayText, promptContent);
    onHideButtonGroup?.();
  }, [onTextCustomPromptClick, onHideButtonGroup]);

  // Don't render if animation is complete and not visible
  // Keep mounted while modal is open so the portaled modal stays alive
  if (!shouldRender && !visible && !showCreatePromptModal) return null;

  return (
    <div
      ref={setPopoverRef}
      className={`actionButtonOptionsPopover ${animationState === 'shrinking' ? 'closing' : ''}`}
      style={animationStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onPopoverMouseEnter}
      onMouseLeave={onPopoverMouseLeave}
    >
      {/* ========== WORD SELECTION OPTIONS ========== */}

      {/* Ask AI - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleAskAIClick();
          }}
        >
          <Sparkles size={18} strokeWidth={2.5} />
          <span>Ask AI</span>
        </button>
      )}

      {isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Synonym - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleSynonymClick();
          }}
        >
          <Replace size={18} strokeWidth={2.5} />
          <span>Synonym</span>
        </button>
      )}

      {/* Opposite - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleOppositeClick();
          }}
        >
          <ArrowLeftRight size={18} strokeWidth={2.5} />
          <span>Opposite</span>
        </button>
      )}

      {/* Custom prompts - word selection */}
      {isWordSelection && customPrompts.length > 0 && (
        <>
          <div className="optionsPopoverSeparator" />
          {customPrompts.map((p) => (
            <button
              key={p.id}
              className="actionButtonOption"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const content = p.description
                  ? p.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
                  : p.title;
                handleWordCustomPromptClick(p.title, content);
              }}
            >
              <BookMarked size={18} strokeWidth={2.5} />
              <span>{p.title}</span>
            </button>
          ))}
        </>
      )}

      {/* Add / Manage custom prompts footer - word selection */}
      {isWordSelection && (
        <>
          <div className="optionsPopoverSeparator" />
          <button
            className="actionButtonOption"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openCreatePromptModal();
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add custom prompt</span>
          </button>
          <button
            className="actionButtonOption"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${ENV.XPLAINO_WEBSITE_BASE_URL}/user/account/custom-prompt`, '_blank');
              onHideButtonGroup?.();
            }}
          >
            <ExternalLink size={18} strokeWidth={2.5} />
            <span>Manage custom prompts</span>
          </button>
        </>
      )}

      {/* ========== TEXT SELECTION OPTIONS ========== */}

      {/* Ask AI - text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleTextAskAIClick();
          }}
        >
          <Sparkles size={18} strokeWidth={2.5} />
          <span>Ask AI</span>
        </button>
      )}

      {!isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Custom prompts - text selection */}
      {!isWordSelection && customPrompts.length > 0 && (
        <>
          {customPrompts.map((p) => (
            <button
              key={p.id}
              className="actionButtonOption"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const content = p.description
                  ? p.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
                  : p.title;
                handleTextCustomPromptClick(p.title, content);
              }}
            >
              <BookMarked size={18} strokeWidth={2.5} />
              <span>{p.title}</span>
            </button>
          ))}
          <div className="optionsPopoverSeparator" />
        </>
      )}

      {/* Add / Manage custom prompts footer - text selection */}
      {!isWordSelection && (
        <>
          {customPrompts.length === 0 && <div className="optionsPopoverSeparator" />}
          <button
            className="actionButtonOption"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openCreatePromptModal();
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add custom prompt</span>
          </button>
          <button
            className="actionButtonOption"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${ENV.XPLAINO_WEBSITE_BASE_URL}/user/account/custom-prompt`, '_blank');
              onHideButtonGroup?.();
            }}
          >
            <ExternalLink size={18} strokeWidth={2.5} />
            <span>Manage custom prompts</span>
          </button>
        </>
      )}

      {/* Create custom prompt modal — portals to document.body for full-page centering */}
      <CreateCustomPromptModal
        isOpen={showCreatePromptModal}
        onClose={closeCreatePromptModal}
        onCreated={(created) => {
          setCustomPrompts((prev) => [created, ...prev]);
          closeCreatePromptModal();
        }}
        useShadowDom={false}
      />
    </div>
  );
};

ActionButtonOptionsPopover.displayName = 'ActionButtonOptionsPopover';
