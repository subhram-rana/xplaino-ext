// src/content/components/ContentActions/ActionButtonOptionsPopover.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Languages, Replace, ArrowLeftRight, Sparkles, BookOpen, Lightbulb,
  HelpCircle, AlertTriangle, GraduationCap, MessageSquare, PenLine,
  // Text selection icons
  FileText, ListOrdered, RefreshCw, Wand2, CheckCircle,
  Mic, LayoutList, Table2, GitBranch, Brain,
  Mail, MessageCircle, Linkedin, Twitter, Presentation,
} from 'lucide-react';
import { useEmergeAnimation } from '../../../hooks';

export interface ActionButtonOptionsPopoverProps {
  /** Whether the popover is visible */
  visible: boolean;
  /** Whether the current selection is a word (shows more options) */
  isWordSelection: boolean;
  /** Callback when Translate is clicked */
  onTranslate?: () => void;
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
  onTranslate,
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
  onHideButtonGroup,
  onPopoverMouseEnter,
  onPopoverMouseLeave,
}) => {
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
    transformOrigin: 'top center', // Animate from top-center (near the button above)
  });

  // Callback ref that sets BOTH element ref AND finds source button synchronously
  const setPopoverRef = useCallback((element: HTMLDivElement | null) => {
    // Set the element ref from the hook
    (elementRef as React.MutableRefObject<HTMLElement | null>).current = element;
    
    if (element) {
      // Set initial transform to scale(0) via inline style
      // This ensures the element is hidden BEFORE the animation starts
      element.style.transform = 'scale(0)';
      element.style.transformOrigin = 'top center';
      
      // Find and set source button IMMEDIATELY when element mounts
      const wrapper = element.closest('.optionsButtonWrapper');
      const button = wrapper?.querySelector('button.contentActionButton');

      if (button) {
        (sourceRef as React.MutableRefObject<HTMLElement | null>).current = button as HTMLElement;
      }
    }
  }, [elementRef, sourceRef]);

  // Handle visibility changes with animation
  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Opening
      wasVisible.current = true;
      // Use double RAF to ensure refs are set before animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          emerge();
        });
      });
    } else if (!visible && wasVisible.current) {
      // Closing
      wasVisible.current = false;
      shrink();
    }
  }, [visible, emerge, shrink]);

  const handleTranslateClick = useCallback(() => {
    onTranslate?.();
    onHideButtonGroup?.();
  }, [onTranslate, onHideButtonGroup]);

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

  const handleEtymologyClick = useCallback(() => {
    onEtymology?.();
    onHideButtonGroup?.();
  }, [onEtymology, onHideButtonGroup]);

  const handleMnemonicClick = useCallback(() => {
    onMnemonic?.();
    onHideButtonGroup?.();
  }, [onMnemonic, onHideButtonGroup]);

  const handleQuizClick = useCallback(() => {
    onQuiz?.();
    onHideButtonGroup?.();
  }, [onQuiz, onHideButtonGroup]);

  const handleCommonMistakesClick = useCallback(() => {
    onCommonMistakes?.();
    onHideButtonGroup?.();
  }, [onCommonMistakes, onHideButtonGroup]);

  const handleBetterFormalClick = useCallback(() => {
    onBetterFormal?.();
    onHideButtonGroup?.();
  }, [onBetterFormal, onHideButtonGroup]);

  const handleBetterCasualClick = useCallback(() => {
    onBetterCasual?.();
    onHideButtonGroup?.();
  }, [onBetterCasual, onHideButtonGroup]);

  const handleBetterAcademicClick = useCallback(() => {
    onBetterAcademic?.();
    onHideButtonGroup?.();
  }, [onBetterAcademic, onHideButtonGroup]);

  // --- Text selection handlers ---
  const handleTextAskAIClick = useCallback(() => {
    onTextAskAI?.();
    onHideButtonGroup?.();
  }, [onTextAskAI, onHideButtonGroup]);

  const handleSummarizeClick = useCallback(() => {
    onSummarize?.();
    onHideButtonGroup?.();
  }, [onSummarize, onHideButtonGroup]);

  const handleKeyPointsClick = useCallback(() => {
    onKeyPoints?.();
    onHideButtonGroup?.();
  }, [onKeyPoints, onHideButtonGroup]);

  const handleRewriteClick = useCallback(() => {
    onRewrite?.();
    onHideButtonGroup?.();
  }, [onRewrite, onHideButtonGroup]);

  const handleParaphraseClick = useCallback(() => {
    onParaphrase?.();
    onHideButtonGroup?.();
  }, [onParaphrase, onHideButtonGroup]);

  const handleImproveWritingClick = useCallback(() => {
    onImproveWriting?.();
    onHideButtonGroup?.();
  }, [onImproveWriting, onHideButtonGroup]);

  const handleFixGrammarClick = useCallback(() => {
    onFixGrammar?.();
    onHideButtonGroup?.();
  }, [onFixGrammar, onHideButtonGroup]);

  const handleToneClick = useCallback(() => {
    onTone?.();
    onHideButtonGroup?.();
  }, [onTone, onHideButtonGroup]);

  const handleConvertBulletsClick = useCallback(() => {
    onConvertBullets?.();
    onHideButtonGroup?.();
  }, [onConvertBullets, onHideButtonGroup]);

  const handleConvertTableClick = useCallback(() => {
    onConvertTable?.();
    onHideButtonGroup?.();
  }, [onConvertTable, onHideButtonGroup]);

  const handleConvertDiagramClick = useCallback(() => {
    onConvertDiagram?.();
    onHideButtonGroup?.();
  }, [onConvertDiagram, onHideButtonGroup]);

  const handleCreateMindMapClick = useCallback(() => {
    onCreateMindMap?.();
    onHideButtonGroup?.();
  }, [onCreateMindMap, onHideButtonGroup]);

  const handleConvertEmailClick = useCallback(() => {
    onConvertEmail?.();
    onHideButtonGroup?.();
  }, [onConvertEmail, onHideButtonGroup]);

  const handleConvertWhatsAppClick = useCallback(() => {
    onConvertWhatsApp?.();
    onHideButtonGroup?.();
  }, [onConvertWhatsApp, onHideButtonGroup]);

  const handleConvertLinkedInClick = useCallback(() => {
    onConvertLinkedIn?.();
    onHideButtonGroup?.();
  }, [onConvertLinkedIn, onHideButtonGroup]);

  const handleConvertTweetClick = useCallback(() => {
    onConvertTweet?.();
    onHideButtonGroup?.();
  }, [onConvertTweet, onHideButtonGroup]);

  const handleConvertPresentationClick = useCallback(() => {
    onConvertPresentation?.();
    onHideButtonGroup?.();
  }, [onConvertPresentation, onHideButtonGroup]);

  // Don't render if animation is complete and not visible
  if (!shouldRender && !visible) return null;

  return (
    <div
      ref={setPopoverRef}
      className={`actionButtonOptionsPopover ${animationState === 'shrinking' ? 'closing' : ''}`}
      style={animationStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onPopoverMouseEnter}
      onMouseLeave={onPopoverMouseLeave}
    >
      {/* Ask AI - only for word selection, at the top */}
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

      {/* Separator after Ask AI - only for word selection */}
      {isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Translate - always visible */}
      <button
        className="actionButtonOption"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleTranslateClick();
        }}
      >
        <Languages size={18} strokeWidth={2.5} />
        <span>Translate</span>
      </button>
      
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

      {/* Etymology - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleEtymologyClick();
          }}
        >
          <BookOpen size={18} strokeWidth={2.5} />
          <span>Etymology</span>
        </button>
      )}

      {/* Separator - Learning aids group */}
      {isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Mnemonic - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleMnemonicClick();
          }}
        >
          <Lightbulb size={18} strokeWidth={2.5} />
          <span>Memory trick (Mnemonic)</span>
        </button>
      )}

      {/* Quiz - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleQuizClick();
          }}
        >
          <HelpCircle size={18} strokeWidth={2.5} />
          <span>Quiz me on this word</span>
        </button>
      )}

      {/* Common Mistakes - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleCommonMistakesClick();
          }}
        >
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>Common mistakes</span>
        </button>
      )}

      {/* Separator - Better alternatives group */}
      {isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Better alternative (formal) - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleBetterFormalClick();
          }}
        >
          <PenLine size={18} strokeWidth={2.5} />
          <span>Better alternative (formal)</span>
        </button>
      )}

      {/* Better alternative (casual) - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleBetterCasualClick();
          }}
        >
          <MessageSquare size={18} strokeWidth={2.5} />
          <span>Better alternative (casual)</span>
        </button>
      )}

      {/* Better alternative (academic) - only for word selection */}
      {isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleBetterAcademicClick();
          }}
        >
          <GraduationCap size={18} strokeWidth={2.5} />
          <span>Better alternative (academic)</span>
        </button>
      )}

      {/* ========== TEXT SELECTION OPTIONS ========== */}

      {/* Ask AI - only for text selection, at the top */}
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

      {/* Separator after Ask AI - only for text selection */}
      {!isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Summarize - only for text selection (Translate is already rendered above for all) */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleSummarizeClick();
          }}
        >
          <FileText size={18} strokeWidth={2.5} />
          <span>Summarize</span>
        </button>
      )}

      {/* Key points - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleKeyPointsClick();
          }}
        >
          <ListOrdered size={18} strokeWidth={2.5} />
          <span>Key points</span>
        </button>
      )}

      {/* Rewrite (clearer) - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleRewriteClick();
          }}
        >
          <RefreshCw size={18} strokeWidth={2.5} />
          <span>Rewrite (clearer)</span>
        </button>
      )}

      {/* Paraphrase - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleParaphraseClick();
          }}
        >
          <Wand2 size={18} strokeWidth={2.5} />
          <span>Paraphrase</span>
        </button>
      )}

      {/* Improve writing - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleImproveWritingClick();
          }}
        >
          <PenLine size={18} strokeWidth={2.5} />
          <span>Improve writing</span>
        </button>
      )}

      {/* Fix grammar - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleFixGrammarClick();
          }}
        >
          <CheckCircle size={18} strokeWidth={2.5} />
          <span>Fix grammar</span>
        </button>
      )}

      {/* Separator - Analysis & conversion group */}
      {!isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* What is the tone - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleToneClick();
          }}
        >
          <Mic size={18} strokeWidth={2.5} />
          <span>What is the tone?</span>
        </button>
      )}

      {/* Convert to bullet points - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertBulletsClick();
          }}
        >
          <LayoutList size={18} strokeWidth={2.5} />
          <span>Convert to bullet points</span>
        </button>
      )}

      {/* Convert to table - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertTableClick();
          }}
        >
          <Table2 size={18} strokeWidth={2.5} />
          <span>Convert to table</span>
        </button>
      )}

      {/* Convert to diagram - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertDiagramClick();
          }}
        >
          <GitBranch size={18} strokeWidth={2.5} />
          <span>Convert to diagram</span>
        </button>
      )}

      {/* Create a mind map - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleCreateMindMapClick();
          }}
        >
          <Brain size={18} strokeWidth={2.5} />
          <span>Create a mind map</span>
        </button>
      )}

      {/* Separator - Practical use-cases group */}
      {!isWordSelection && <div className="optionsPopoverSeparator" />}

      {/* Convert to email - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertEmailClick();
          }}
        >
          <Mail size={18} strokeWidth={2.5} />
          <span>Convert to email</span>
        </button>
      )}

      {/* Convert to WhatsApp message - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertWhatsAppClick();
          }}
        >
          <MessageCircle size={18} strokeWidth={2.5} />
          <span>Convert to WhatsApp message</span>
        </button>
      )}

      {/* Convert to LinkedIn post - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertLinkedInClick();
          }}
        >
          <Linkedin size={18} strokeWidth={2.5} />
          <span>Convert to LinkedIn post</span>
        </button>
      )}

      {/* Convert to tweet - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertTweetClick();
          }}
        >
          <Twitter size={18} strokeWidth={2.5} />
          <span>Convert to tweet</span>
        </button>
      )}

      {/* Convert to presentation bullets - only for text selection */}
      {!isWordSelection && (
        <button
          className="actionButtonOption"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleConvertPresentationClick();
          }}
        >
          <Presentation size={18} strokeWidth={2.5} />
          <span>Convert to presentation bullets</span>
        </button>
      )}
    </div>
  );
};

ActionButtonOptionsPopover.displayName = 'ActionButtonOptionsPopover';
