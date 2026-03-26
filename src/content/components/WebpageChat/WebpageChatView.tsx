// src/content/components/WebpageChat/WebpageChatView.tsx
// Multi-session "Chat with Webpage" component.
// Orchestrates: session tabs → classify (skipped for annotated) → branch → chunk/embed/search → answer (SSE) → render with citations.

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { ArrowUp, Square, Trash2, Plus, X, Quote, BookMarked, MoreHorizontal, Pencil, EyeOff, Share2, ExternalLink, Loader2 } from 'lucide-react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import styles from './WebpageChatView.module.css';
import { OnHoverMessage } from '../OnHoverMessage/OnHoverMessage';
import { CreateCustomPromptModal } from '../CreateCustomPromptModal/CreateCustomPromptModal';
import { CustomPromptService } from '@/api-services/CustomPromptService';
import type { CustomPromptResponse } from '@/api-services/dto/CustomPromptDTO';

import { WebpageChatService, CitationDetail, ConversationMessage, stripCiteMarkers } from '@/api-services/WebpageChatService';
import { WebpageChatImageService } from '@/api-services/WebpageChatImageService';
import { ENV } from '@/config/env';
import { getLanguageCode } from '@/api-services/TranslateService';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { chunkPage, extractFullPageText } from '@/content/utils/pageChunker';
import { embedText, embedTexts, cosineSimilarity } from '@/content/utils/embeddingClient';
import { getVectorIndex, putVectorIndex } from '@/content/utils/vectorStore';
import { hashPageUrl, hashPageContent } from '@/content/utils/urlHasher';
import { bm25Rerank } from '@/content/utils/bm25Reranker';
import {
  activateCitation,
  deactivateCitation,
  removeAllHighlights,
  parseAnswerCitations,
  locateAndPulsateText,
  ParsedCitation,
} from '@/content/utils/citationManager';
import { LoadingDots } from '../SidePanel/LoadingDots';

import {
  webpageChatSessionsAtom,
  webpageChatActiveSessionIdAtom,
  webpageChatActiveSessionAtom,
  webpageChatNextSessionCounterAtom,
  webpageChatPendingAnnotationAtom,
  webpageChatPendingImageQuestionAtom,
  webpageChatAutoSubmitQuestionAtom,
  webpageChatStateAtom,
  webpageChatStreamingAnswerAtom,
  webpageChatErrorAtom,
  webpageChatLastQuestionAtom,
  webpageChatIndexingIndicatorAtom,
  webpageChatIsLoadingAtom,
  ChatSession,
  RenderedMessage,
  AnnotationData,
  makeSessionId,
} from '@/store/webpageChatAtoms';

/** Shared prompt used by the FAB Summarise button, Ctrl+M, and the built-in pill. */
const SUMMARISE_PAGE_QUESTION = 'Summarise this page';

import { showLoginModalAtom } from '@/store/uiAtoms';

// ============================================================
// Constants
// ============================================================

const CLASSIFY_HISTORY_TURNS = 3;
const ANSWER_HISTORY_TURNS = 8;
const TOP_COSINE = 20;
const TOP_AFTER_RERANK = 7;
const ANNOTATION_TRUNCATE = 200;

// ============================================================
// Helpers
// ============================================================

function trimHistory(history: ConversationMessage[], turns: number): ConversationMessage[] {
  const maxEntries = turns * 2;
  const slice = history.slice(-maxEntries);
  return slice.map((m) => ({
    role: m.role,
    content: m.role === 'assistant' ? stripCiteMarkers(m.content) : m.content,
  }));
}

function makeMsgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Update a single session inside the sessions array by id */
function updateSession(
  sessions: ChatSession[],
  id: string,
  updater: (s: ChatSession) => ChatSession
): ChatSession[] {
  return sessions.map((s) => (s.id === id ? updater({ ...s }) : s));
}

// ============================================================
// CitationChip sub-component
// ============================================================

interface CitationChipProps {
  number: number;
  chunkIds: string[];
  citationMap: Record<string, CitationDetail>;
  activeCitations: Set<string>;
  setActiveCitations: (updater: (prev: string[]) => string[]) => void;
  sessionId: string;
  setSessions: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  useShadowDom?: boolean;
  isStreaming?: boolean;
  shouldPulsate?: boolean;
}

const CitationChip: React.FC<CitationChipProps> = ({
  number,
  chunkIds,
  citationMap,
  activeCitations,
  setActiveCitations,
  sessionId,
  setSessions,
  useShadowDom,
  isStreaming,
  shouldPulsate,
}) => {
  const cn = useCallback(
    (base: string) => (useShadowDom ? base : (styles[base as keyof typeof styles] ?? base)),
    [useShadowDom]
  );

  const isActive = chunkIds.some((id) => activeCitations.has(id));
  const hasData = chunkIds.some((id) => citationMap[id]);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [pulsating, setPulsating] = useState(shouldPulsate ?? false);

  const handleClick = () => {
    setPulsating(false);
    if (!hasData) {
      setTooltipVisible(true);
      setTimeout(() => setTooltipVisible(false), 2500);
      return;
    }

    if (isActive) {
      for (const id of chunkIds) deactivateCitation(id);
      const removed = new Set(chunkIds);
      setActiveCitations((prev) => prev.filter((id) => !removed.has(id)));
      setSessions((prev) =>
        updateSession(prev, sessionId, (s) => ({
          ...s,
          activeCitations: s.activeCitations.filter((id) => !removed.has(id)),
        }))
      );
    } else {
      // Deactivate all currently active citations first (single-selection behaviour)
      setActiveCitations((prev) => {
        for (const id of prev) deactivateCitation(id);
        return [];
      });

      const activated: string[] = [];
      for (const id of chunkIds) {
        const detail = citationMap[id];
        if (detail && activateCitation(id, detail)) activated.push(id);
      }
      setActiveCitations(() => activated);
      setSessions((prev) =>
        updateSession(prev, sessionId, (s) => ({
          ...s,
          activeCitations: activated,
        }))
      );
    }
  };

  let chipClass = cn('citationChip');
  if (isActive) chipClass += ' ' + cn('citationChipActive');
  if (!hasData) chipClass += ' ' + cn('citationChipDimmed');
  if (pulsating) chipClass += ' ' + cn('citationChipPulsating');

  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <button
        className={chipClass}
        onClick={handleClick}
        type="button"
        disabled={isStreaming}
        aria-label={`Citation ${number}`}
        title={hasData ? undefined : 'Could not locate this reference on the page'}
      >
        {number}
      </button>
      {tooltipVisible && !hasData && (
        <span
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          Could not locate this reference on the page
        </span>
      )}
    </span>
  );
};

// ============================================================
// AssistantMessage sub-component
// ============================================================

interface AssistantMessageProps {
  content: string;
  citationMap: Record<string, CitationDetail>;
  activeCitations: Set<string>;
  setActiveCitations: (updater: (prev: string[]) => string[]) => void;
  sessionId: string;
  setSessions: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  useShadowDom?: boolean;
  isStreaming?: boolean;
  shouldPulsate?: boolean;
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content,
  citationMap,
  activeCitations,
  setActiveCitations,
  sessionId,
  setSessions,
  useShadowDom,
  isStreaming,
  shouldPulsate,
}) => {
  const { parsedText, citations } = parseAnswerCitations(content);

  const cn = useCallback(
    (base: string) => (useShadowDom ? base : (styles[base as keyof typeof styles] ?? base)),
    [useShadowDom]
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        p: ({ children }) => <p className={cn('markdownP')}>{children}</p>,
        h1: ({ children }) => <h1 className={cn('markdownH1')}>{children}</h1>,
        h2: ({ children }) => <h2 className={cn('markdownH2')}>{children}</h2>,
        h3: ({ children }) => <h3 className={cn('markdownH3')}>{children}</h3>,
        ul: ({ children }) => <ul className={cn('markdownUl')}>{children}</ul>,
        ol: ({ children }) => <ol className={cn('markdownOl')}>{children}</ol>,
        li: ({ children }) => <li className={cn('markdownLi')}>{children}</li>,
        strong: ({ children }) => <strong className={cn('markdownStrong')}>{children}</strong>,
        em: ({ children }) => <em className={cn('markdownEm')}>{children}</em>,
        code: ({ children }) => {
          const text = String(children);
          const match = text.match(/^CITE_(\d+)_PLACEHOLDER$/);
          if (match) {
            const idx = parseInt(match[1], 10) - 1;
            const citation: ParsedCitation | undefined = citations[idx];
            if (!citation) return null;
            return (
              <CitationChip
                number={idx + 1}
                chunkIds={citation.chunkIds}
                citationMap={citationMap}
                activeCitations={activeCitations}
                setActiveCitations={setActiveCitations}
                sessionId={sessionId}
                setSessions={setSessions}
                useShadowDom={useShadowDom}
                isStreaming={isStreaming}
                shouldPulsate={shouldPulsate}
              />
            );
          }
          return <code className={cn('markdownCode')}>{children}</code>;
        },
      }}
    >
      {parsedText}
    </ReactMarkdown>
  );
};

// ============================================================
// AnnotationPreview sub-component
// ============================================================

interface AnnotationPreviewProps {
  annotation: AnnotationData;
  onDismiss: () => void;
  useShadowDom?: boolean;
}

const AnnotationPreview: React.FC<AnnotationPreviewProps> = ({ annotation, onDismiss, useShadowDom }) => {
  const cn = (base: string) => (useShadowDom ? base : (styles[base as keyof typeof styles] ?? base));

  const displayText =
    annotation.selectedText.length > ANNOTATION_TRUNCATE
      ? annotation.selectedText.slice(0, ANNOTATION_TRUNCATE) + '…'
      : annotation.selectedText;

  const handleClick = () => {
    locateAndPulsateText(annotation.textSnippetStart, annotation.textSnippetEnd);
  };

  return (
    <div className={cn('annotationCardWrap')}>
      <button
        className={cn('annotationCard')}
        onClick={handleClick}
        type="button"
        title="Click to locate this text on the page"
      >
        <Quote size={13} className={cn('annotationIcon')} />
        <span className={cn('annotationText')}>{displayText}</span>
      </button>
      <button
        className={cn('annotationDismissBtn')}
        onClick={onDismiss}
        type="button"
        title="Remove"
        aria-label="Remove annotation"
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ============================================================
// Props
// ============================================================

export interface WebpageChatViewProps {
  useShadowDom?: boolean;
  isOpen?: boolean;
}

// ============================================================
// Main component
// ============================================================

export const WebpageChatView: React.FC<WebpageChatViewProps> = ({
  useShadowDom = false,
  isOpen = true,
}) => {
  // ── Atoms ──────────────────────────────────────────────────
  const [sessions, setSessions] = useAtom(webpageChatSessionsAtom);
  const [activeSessionId, setActiveSessionId] = useAtom(webpageChatActiveSessionIdAtom);
  const activeSession = useAtomValue(webpageChatActiveSessionAtom);
  const nextCounter = useAtomValue(webpageChatNextSessionCounterAtom);
  const [pendingAnnotation, setPendingAnnotation] = useAtom(webpageChatPendingAnnotationAtom);
  const [pendingImageQuestion, setPendingImageQuestion] = useAtom(webpageChatPendingImageQuestionAtom);
  const [autoSubmitQuestion, setAutoSubmitQuestion] = useAtom(webpageChatAutoSubmitQuestionAtom);

  const [chatState, setChatState] = useAtom(webpageChatStateAtom);
  const [streamingAnswer, setStreamingAnswer] = useAtom(webpageChatStreamingAnswerAtom);
  const [errorMsg, setErrorMsg] = useAtom(webpageChatErrorAtom);
  const [lastQuestion, setLastQuestion] = useAtom(webpageChatLastQuestionAtom);
  const [isIndexing, setIsIndexing] = useAtom(webpageChatIndexingIndicatorAtom);
  const isLoading = useAtomValue(webpageChatIsLoadingAtom);
  const setShowLoginModal = useSetAtom(showLoginModalAtom);

  // ── Local UI state ─────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [dotCount, setDotCount] = useState(1);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Keyboard shortcut label for the Summarise pill (Mac vs Windows/Linux)
  const isMac = useMemo(() => /Mac|iPod|iPhone|iPad/.test(navigator.platform), []);

  // Image attachment pending — set when "Ask AI about this image" is clicked.
  // Shown as a preview strip above the input bar; included in the submission.
  const [pendingImageAttachment, setPendingImageAttachment] = useState<{
    imageUrl: string;
    imageFile: File | Blob;
    imageExplanationId: string;
  } | null>(null);

  // Per-component active citations mirror (for render performance)
  const [activeCitationsLocal, setActiveCitationsLocal] = useState<string[]>(
    activeSession?.activeCitations ?? []
  );

  // Tracks the most recently committed assistant message for the pulsate animation
  const [justCommittedMsgId, setJustCommittedMsgId] = useState<string | null>(null);
  const activeCitations = new Set(activeCitationsLocal);

  // ── Custom prompt state ────────────────────────────────────
  const [customPrompts, setCustomPrompts] = useState<CustomPromptResponse[]>([]);
  const [customPromptMenuOpen, setCustomPromptMenuOpen] = useState(false);
  const [customPromptActionMenuId, setCustomPromptActionMenuId] = useState<string | null>(null);
  const [customPromptActionMenuPos, setCustomPromptActionMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<CustomPromptResponse | null>(null);
  const [showCreatePromptModal, setShowCreatePromptModal] = useState(false);
  const [confirmDeletePromptId, setConfirmDeletePromptId] = useState<string | null>(null);
  const [sharingPrompt, setSharingPrompt] = useState<CustomPromptResponse | null>(null);
  const [shareUserId, setShareUserId] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const customPromptMenuRef = useRef<HTMLDivElement>(null);
  const summarisePillRef = useRef<HTMLButtonElement>(null);
  // Tracks which session ID owns the currently in-flight SSE stream.
  // Used to scope streaming UI (dots, answer) and input disabling to the
  // correct session when the user switches tabs mid-stream.
  const streamingSessionIdRef = useRef<string | null>(null);

  const cn = useCallback(
    (base: string) => (useShadowDom ? base : (styles[base as keyof typeof styles] ?? base)),
    [useShadowDom]
  );

  // ── Fetch custom prompts on mount ───────────────────────────
  useEffect(() => {
    CustomPromptService.listCustomPrompts()
      .then((res) => setCustomPrompts(res.prompts.filter((p) => !p.isHidden)))
      .catch(() => { /* silently ignore — user may not be logged in */ });
  }, []);

  // ── Outside-click to close custom prompt dropdown ───────────
  // Use composedPath() instead of e.target so clicks inside the shadow DOM
  // are correctly identified — e.target is retargeted to the shadow host at
  // the document level, making every shadow-DOM click appear as an "outside" click.
  useEffect(() => {
    if (!customPromptMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        customPromptMenuRef.current &&
        !e.composedPath().includes(customPromptMenuRef.current as EventTarget)
      ) {
        setCustomPromptMenuOpen(false);
        setCustomPromptActionMenuId(null);
        setCustomPromptActionMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [customPromptMenuOpen]);

  // ── Sync local activeCitations when session changes ─────────
  useEffect(() => {
    setActiveCitationsLocal(activeSession?.activeCitations ?? []);
  }, [activeSessionId, activeSession]);

  // ── Loading dot animation ───────────────────────────────────
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setDotCount((p) => (p % 3) + 1), 400);
    return () => clearInterval(id);
  }, [isLoading]);

  // ── Auto-scroll ─────────────────────────────────────────────
  const SCROLL_THRESHOLD = 5;
  const checkAtBottom = useCallback((el: HTMLDivElement) => {
    return el.scrollTop >= el.scrollHeight - el.clientHeight - SCROLL_THRESHOLD;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => setShouldAutoScroll(checkAtBottom(el));
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [checkAtBottom]);

  const messages = activeSession?.messages ?? [];
  const citationMap = activeSession?.citationMap ?? {};

  useEffect(() => {
    if (containerRef.current && shouldAutoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingAnswer, shouldAutoScroll]);

  // ── Cleanup highlights when sidebar closes ──────────────────
  useEffect(() => {
    if (!isOpen) {
      removeAllHighlights();
      setSessions((prev) =>
        prev.map((s) => ({ ...s, activeCitations: [] }))
      );
      setActiveCitationsLocal([]);
    }
  }, [isOpen, setSessions]);

  // ── Consume pending annotation from content/index.ts ───────
  useEffect(() => {
    if (!pendingAnnotation) return;
    const annotation = pendingAnnotation;
    setPendingAnnotation(null);

    if (annotation.focusInput && !annotation.question) {
      // "Ask AI" path: immediately render the annotation card so the user can see
      // what text they selected, then focus the input for them to type their question.
      const annoMsgId = makeMsgId();
      setSessions((prev) =>
        updateSession(prev, activeSessionId, (s) => ({
          ...s,
          pendingAnnotation: annotation,
          messages: [
            ...s.messages,
            { id: annoMsgId, type: 'annotation' as const, annotation: { ...annotation } },
          ],
        }))
      );
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      // Preset-question path ("Simplify", "Summarize", etc.):
      // Store annotation; submitQuestion will add the card together with the user message.
      setSessions((prev) =>
        updateSession(prev, activeSessionId, (s) => ({
          ...s,
          pendingAnnotation: annotation,
        }))
      );
      if (annotation.question) {
        setInputValue(annotation.question);
      }
    }
  }, [pendingAnnotation, setPendingAnnotation, activeSessionId, setSessions]);

  // ── Auto-submit for preset annotation questions ─────────────
  // When a preset question arrives via annotation, auto-send it
  const pendingAutoSubmitRef = useRef<string | null>(null);
  const pendingAutoSubmitDisplayRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!pendingAnnotation) return; // already cleared above
    if (pendingAnnotation.question) {
      pendingAutoSubmitRef.current = pendingAnnotation.question;
      pendingAutoSubmitDisplayRef.current = pendingAnnotation.displayQuestion;
    }
  }, [pendingAnnotation]);

  // After input is set, auto-submit if flagged
  useEffect(() => {
    if (pendingAutoSubmitRef.current && inputValue === pendingAutoSubmitRef.current && !isLoading) {
      const q = pendingAutoSubmitRef.current;
      const displayQ = pendingAutoSubmitDisplayRef.current;
      pendingAutoSubmitRef.current = null;
      pendingAutoSubmitDisplayRef.current = undefined;
      // Small delay so the annotation card renders first
      setTimeout(() => submitQuestion(q, displayQ), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // ── Consume autoSubmitQuestion from content/index.ts (FAB Summarise / Ctrl+M) ──
  useEffect(() => {
    if (!autoSubmitQuestion) return;
    const q = autoSubmitQuestion;
    setAutoSubmitQuestion(null);
    // Small delay so the fresh session and panel are rendered before submitting
    setTimeout(() => submitQuestion(q), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitQuestion]);

  // ── Consume pending image question from content/index.ts ─────
  // Set by the image hover button group (Simplify, custom prompt, Ask AI)
  const pendingImageQuestionRef = useRef<typeof pendingImageQuestion>(null);
  useEffect(() => {
    if (!pendingImageQuestion) return;
    const payload = pendingImageQuestion;
    setPendingImageQuestion(null);

    if (payload.focusInput) {
      // "Ask AI" path: show image preview, focus input, no auto-submit yet
      setPendingImageAttachment({
        imageUrl: payload.imageUrl,
        imageFile: payload.imageFile,
        imageExplanationId: payload.imageExplanationId,
      });
      setTimeout(() => inputRef.current?.focus(), 150);
      return;
    }

    // Auto-submit image question
    pendingImageQuestionRef.current = payload;
    // Trigger via a small timeout so the panel is rendered first
    setTimeout(() => {
      const p = pendingImageQuestionRef.current;
      if (p) {
        pendingImageQuestionRef.current = null;
        submitImageQuestion(p).catch(console.error);
      }
    }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImageQuestion]);

  // ============================================================
  // Session management
  // ============================================================

  const handleAddSession = () => {
    const newId = makeSessionId();
    const newSession: ChatSession = {
      id: newId,
      name: `Session ${nextCounter}`,
      messages: [],
      history: [],
      citationMap: {},
      activeCitations: [],
      pendingAnnotation: null,
    };

    // Abort in-flight and clean up current session highlights
    abortRef.current?.abort();
    abortRef.current = null;
    removeAllHighlights();

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newId);
    setActiveCitationsLocal([]);
    setChatState('idle');
    setStreamingAnswer('');
    setErrorMsg('');
    setInputValue('');
  };

  const handleSwitchSession = (id: string) => {
    if (id === activeSessionId) return;

    // Do NOT abort an in-flight stream — let it complete in the background and
    // commit its result to the originating session. The streaming UI is scoped
    // to streamingSessionIdRef, so it won't bleed into other session views.
    removeAllHighlights();
    setActiveSessionId(id);
    setErrorMsg('');

    const target = sessions.find((s) => s.id === id);
    setActiveCitationsLocal(target?.activeCitations ?? []);
  };

  const handleCloseSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) return; // always keep at least one

    if (id === activeSessionId) {
      // Abort in-flight
      abortRef.current?.abort();
      abortRef.current = null;
      setChatState('idle');
      setStreamingAnswer('');
      setErrorMsg('');
    }

    // Remove highlights for the closed session
    const closing = sessions.find((s) => s.id === id);
    if (closing) {
      for (const chunkId of closing.activeCitations) deactivateCitation(chunkId);
    }

    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);

    if (id === activeSessionId) {
      const newActive = remaining[remaining.length - 1];
      setActiveSessionId(newActive.id);
      setActiveCitationsLocal(newActive.activeCitations);
    }
  };

  const handleClear = () => {
    abortRef.current?.abort();
    abortRef.current = null;

    // Remove highlights for active session
    for (const chunkId of (activeSession?.activeCitations ?? [])) {
      deactivateCitation(chunkId);
    }

    setSessions((prev) =>
      updateSession(prev, activeSessionId, (s) => ({
        ...s,
        messages: [],
        history: [],
        citationMap: {},
        activeCitations: [],
        pendingAnnotation: null,
      }))
    );
    setActiveCitationsLocal([]);
    setStreamingAnswer('');
    setErrorMsg('');
    setLastQuestion('');
    setChatState('idle');
    setInputValue('');
  };

  // ============================================================
  // Core: submit question
  // ============================================================

  const submitQuestion = useCallback(
    async (question: string, displayText?: string) => {
      if (!question.trim()) return;
      // Block only if THIS session already owns an in-flight stream, not others
      if (isLoading && streamingSessionIdRef.current === activeSessionId) return;
      const q = question.trim();
      const displayQ = displayText?.trim() ?? q;

      // Grab the pending annotation from the session at call time
      const currentSession = sessions.find((s) => s.id === activeSessionId);
      const annotation = currentSession?.pendingAnnotation ?? null;

      // Add user message + (if annotation) annotation card immediately
      const userMsgId = makeMsgId();
      const annoMsgId = makeMsgId();

      setSessions((prev) =>
        updateSession(prev, activeSessionId, (s) => {
          // If the annotation card was already pre-rendered (focusInput "Ask AI" path),
          // don't add it again — only append the user message.
          const lastMsg = s.messages[s.messages.length - 1];
          const annotationAlreadyShown = lastMsg?.type === 'annotation';

          const newMessages: RenderedMessage[] = annotation && !annotationAlreadyShown
            ? [
                ...s.messages,
                { id: annoMsgId, type: 'annotation', annotation: { ...annotation } },
                { id: userMsgId, type: 'user', content: displayQ },
              ]
            : [...s.messages, { id: userMsgId, type: 'user', content: displayQ }];
          return {
            ...s,
            messages: newMessages,
            pendingAnnotation: null, // consume
          };
        })
      );

      setInputValue('');
      setErrorMsg('');
      setLastQuestion(q);

      let classifyResult: { type: 'broad' | 'contextual'; reply: string } = {
        type: 'contextual',
        reply: '',
      };

      // Mark this session as the owner of the upcoming stream
      streamingSessionIdRef.current = activeSessionId;

      if (!annotation) {
        // Stage 1: Classify (only when no annotation)
        setChatState('classifying');
        setStreamingAnswer('');

        try {
          const result = await WebpageChatService.classify(
            {
              question: q,
              conversationHistory: trimHistory(currentSession?.history ?? [], CLASSIFY_HISTORY_TURNS),
            },
            () => {
              setShowLoginModal(true);
              setChatState('idle');
            }
          );

          if (result.type === 'greeting') {
            const reply = result.reply || 'Hello! How can I help you with this page?';
            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                messages: [
                  ...s.messages,
                  { id: makeMsgId(), type: 'assistant', content: reply },
                ],
                history: [
                  ...s.history,
                  { role: 'user', content: q },
                  { role: 'assistant', content: reply },
                ],
              }))
            );
            streamingSessionIdRef.current = null;
            setChatState('idle');
            return;
          }

          classifyResult = { type: result.type, reply: result.reply };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          if (msg === 'LOGIN_REQUIRED' || msg === 'TOKEN_REFRESH_FAILED') {
            streamingSessionIdRef.current = null;
            setChatState('idle');
            return;
          }
          streamingSessionIdRef.current = null;
          setChatState('error');
          setSessions((prev) =>
            updateSession(prev, activeSessionId, (s) => ({
              ...s,
              messages: [
                ...s.messages,
                { id: makeMsgId(), type: 'error', errorQuestion: q },
              ],
            }))
          );
          setErrorMsg("Couldn't process your question.");
          return;
        }
      }

      // Stage 2: Build chunks
      const answerHistory = trimHistory(currentSession?.history ?? [], ANSWER_HISTORY_TURNS);
      let chunks: ReturnType<typeof chunkPage> = [];

      if (classifyResult.type === 'contextual' || annotation) {
        try {
          chunks = await buildContextualChunks(q, () => setIsIndexing(true));
        } catch (err) {
          console.warn('[WebpageChatView] Vector path failed, falling back to broad:', err);
          chunks = chunkPage();
        } finally {
          setIsIndexing(false);
        }
      } else {
        chunks = chunkPage();
      }

      if (chunks.length === 0) {
        // Last-resort fallback: use raw body text so structured pages that defeat
        // the DOM chunker still get a useful response instead of an error
        const fallbackText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
        if (fallbackText.length > 50) {
          const clipped = fallbackText.slice(0, 12000);
          chunks = [{
            chunkId: 'fallback_0',
            text: clipped,
            metadata: {
              startXPath: '/html/body',
              endXPath: '/html/body',
              startOffset: 0,
              endOffset: clipped.length,
              cssSelector: 'body',
              textSnippetStart: clipped.slice(0, 60),
              textSnippetEnd: clipped.slice(-60),
            },
          }];
        }
      }

      if (chunks.length === 0) {
        streamingSessionIdRef.current = null;
        setChatState('error');
        setSessions((prev) =>
          updateSession(prev, activeSessionId, (s) => ({
            ...s,
            messages: [
              ...s.messages,
              { id: makeMsgId(), type: 'error', errorQuestion: q },
            ],
          }))
        );
        setErrorMsg('No page content available to answer this question.');
        return;
      }

      // Stage 3: Answer (SSE)
      setChatState('answering');
      setStreamingAnswer('');
      const abort = new AbortController();
      abortRef.current = abort;

      const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;

      const msgCitationMap: Record<string, CitationDetail> = {};

      await WebpageChatService.answer(
        {
          question: q,
          questionType: classifyResult.type,
          pageUrl: window.location.href,
          pageTitle: document.title || undefined,
          languageCode,
          selectedText: annotation?.selectedText,
          chunks,
          conversationHistory: answerHistory,
        },
        {
          onChunk: (_chunk, _accumulated, progressiveAnswer) => {
            setStreamingAnswer(progressiveAnswer);
          },
          onInlineCitation: (_citationNumber, _chunkIds, citations) => {
            for (const c of citations) {
              msgCitationMap[c.chunkId] = c;
            }
            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                citationMap: { ...s.citationMap, ...msgCitationMap },
              }))
            );
          },
          onCitations: (answer, citeMap, possibleQuestions) => {
            Object.assign(msgCitationMap, citeMap);
            const asstMsgId = makeMsgId();

            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: asstMsgId,
                    type: 'assistant',
                    content: answer,
                    citationMap: { ...msgCitationMap },
                    possibleQuestions: possibleQuestions.length > 0 ? possibleQuestions : undefined,
                  },
                ],
                citationMap: { ...s.citationMap, ...msgCitationMap },
                history: [
                  ...s.history,
                  { role: 'user', content: q },
                  { role: 'assistant', content: answer },
                ],
              }))
            );
            setJustCommittedMsgId(asstMsgId);
            setTimeout(() => setJustCommittedMsgId(null), 1500);
            streamingSessionIdRef.current = null;
            setStreamingAnswer('');
            setChatState('idle');
          },
          onError: (code, msg) => {
            if (abort.signal.aborted) return;
            streamingSessionIdRef.current = null;
            setStreamingAnswer('');
            setChatState('error');
            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                messages: [
                  ...s.messages,
                  { id: makeMsgId(), type: 'error', errorQuestion: q },
                ],
              }))
            );
            setErrorMsg(
              code === 'ANSWER_FAILED' || code === 'INTERNAL_ERROR'
                ? 'Something went wrong generating a response. Please try again.'
                : `Error: ${msg}`
            );
          },
          onLoginRequired: () => {
            streamingSessionIdRef.current = null;
            setShowLoginModal(true);
            setStreamingAnswer('');
            setChatState('idle');
          },
        },
        abort
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoading,
      sessions,
      activeSessionId,
      setSessions,
      setChatState,
      setStreamingAnswer,
      setErrorMsg,
      setLastQuestion,
      setIsIndexing,
      setShowLoginModal,
    ]
  );

  // ── Submit image question (from image hover button group) ───
  // Calls /api/webpage-chat/answer-with-image (multipart SSE) instead of /answer.
  // Skips classify — always treated as 'contextual'.
  const submitImageQuestion = useCallback(
    async (payload: NonNullable<typeof pendingImageQuestion>) => {
      if (isLoading) return;
      const { question, displayText, imageFile, imageUrl, imageExplanationId } = payload;
      const displayQ = displayText.trim() || question.trim();

      const currentSession = sessions.find((s) => s.id === activeSessionId);
      const userMsgId = makeMsgId();

      setSessions((prev) =>
        updateSession(prev, activeSessionId, (s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: userMsgId,
              type: 'user',
              content: displayQ,
              imageContext: { imageUrl, imageExplanationId },
            },
          ],
        }))
      );

      setErrorMsg('');
      setLastQuestion(question);

      // Build contextual chunks
      setChatState('indexing');
      let chunks: ReturnType<typeof chunkPage> = [];
      try {
        chunks = await buildContextualChunks(question || displayQ, () => setIsIndexing(true));
      } catch {
        chunks = chunkPage();
      } finally {
        setIsIndexing(false);
      }

      if (chunks.length === 0) {
        // Last-resort fallback: use raw body text so structured pages that defeat
        // the DOM chunker still get a useful response instead of an error
        const fallbackText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
        if (fallbackText.length > 50) {
          const clipped = fallbackText.slice(0, 12000);
          chunks = [{
            chunkId: 'fallback_0',
            text: clipped,
            metadata: {
              startXPath: '/html/body',
              endXPath: '/html/body',
              startOffset: 0,
              endOffset: clipped.length,
              cssSelector: 'body',
              textSnippetStart: clipped.slice(0, 60),
              textSnippetEnd: clipped.slice(-60),
            },
          }];
        }
      }

      if (chunks.length === 0) {
        setChatState('error');
        setSessions((prev) =>
          updateSession(prev, activeSessionId, (s) => ({
            ...s,
            messages: [...s.messages, { id: makeMsgId(), type: 'error', errorQuestion: question }],
          }))
        );
        setErrorMsg('No page content available to answer this question.');
        return;
      }

      // SSE stream
      setChatState('answering');
      setStreamingAnswer('');
      const abort = new AbortController();
      abortRef.current = abort;

      const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;
      const answerHistory = trimHistory(currentSession?.history ?? [], ANSWER_HISTORY_TURNS);
      const msgCitationMap: Record<string, CitationDetail> = {};

      await WebpageChatImageService.answerWithImage(
        imageFile,
        question || displayQ,
        'contextual',
        chunks,
        answerHistory,
        window.location.href,
        document.title || undefined,
        languageCode,
        {
          onChunk: (_chunk, _accumulated, progressiveAnswer) => {
            setStreamingAnswer(progressiveAnswer);
          },
          onInlineCitation: (_citationNumber, _chunkIds, citations) => {
            for (const c of citations) {
              msgCitationMap[c.chunkId] = c;
            }
            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                citationMap: { ...s.citationMap, ...msgCitationMap },
              }))
            );
          },
          onCitations: (answer, citeMap, _possibleQuestions) => {
            Object.assign(msgCitationMap, citeMap);
            const asstMsgId = makeMsgId();
            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: asstMsgId,
                    type: 'assistant',
                    content: answer,
                    citationMap: { ...msgCitationMap },
                  },
                ],
                citationMap: { ...s.citationMap, ...msgCitationMap },
                history: [
                  ...s.history,
                  { role: 'user', content: question || displayQ },
                  { role: 'assistant', content: answer },
                ],
              }))
            );
            setJustCommittedMsgId(asstMsgId);
            setTimeout(() => setJustCommittedMsgId(null), 1500);
            setStreamingAnswer('');
            setChatState('idle');
          },
          onError: (code, msg) => {
            if (abort.signal.aborted) return;
            setStreamingAnswer('');
            setChatState('error');
            setSessions((prev) =>
              updateSession(prev, activeSessionId, (s) => ({
                ...s,
                messages: [...s.messages, { id: makeMsgId(), type: 'error', errorQuestion: question }],
              }))
            );
            setErrorMsg(
              code === 'ANSWER_FAILED' || code === 'INTERNAL_ERROR'
                ? 'Something went wrong generating a response. Please try again.'
                : `Error: ${msg}`
            );
          },
          onLoginRequired: () => {
            setShowLoginModal(true);
            setStreamingAnswer('');
            setChatState('idle');
          },
        },
        abort
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, sessions, activeSessionId, setSessions, setChatState, setStreamingAnswer, setErrorMsg, setLastQuestion, setIsIndexing, setShowLoginModal]
  );

  // ── Stop ────────────────────────────────────────────────────
  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingSessionIdRef.current = null;

    if (streamingAnswer) {
      setSessions((prev) =>
        updateSession(prev, activeSessionId, (s) => ({
          ...s,
          messages: [
            ...s.messages,
            { id: makeMsgId(), type: 'assistant', content: streamingAnswer },
          ],
          history: [
            ...s.history,
            { role: 'user', content: lastQuestion },
            { role: 'assistant', content: streamingAnswer },
          ],
        }))
      );
    }
    setStreamingAnswer('');
    setChatState('idle');
  };

  // ── Custom prompt helpers ────────────────────────────────────
  const stripHtml = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent ?? tmp.innerText ?? '').replace(/\s+/g, ' ').trim();
  };

  const handlePromptClick = useCallback(
    (displayText: string, apiContent?: string) => {
      submitQuestion(apiContent ?? displayText, displayText);
      setCustomPromptMenuOpen(false);
    },
    [submitQuestion]
  );

  const closeActionMenu = () => {
    setCustomPromptActionMenuId(null);
    setCustomPromptActionMenuPos(null);
  };

  // ── Send ────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (pendingImageAttachment) {
      const attachment = pendingImageAttachment;
      setPendingImageAttachment(null);
      setInputValue('');
      submitImageQuestion({
        question: trimmed,
        displayText: trimmed,
        imageFile: attachment.imageFile,
        imageUrl: attachment.imageUrl,
        imageExplanationId: attachment.imageExplanationId,
      }).catch(console.error);
      return;
    }

    submitQuestion(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // True only when the active session owns the current in-flight stream.
  // Guards streaming UI (dots, answer text, stop button, disabled input) so
  // switching to another session tab doesn't show or disrupt another session's stream.
  const isCurrentSessionStreaming = streamingSessionIdRef.current === activeSessionId && isLoading;

  const hasContent = messages.length > 0 || (!!streamingAnswer && isCurrentSessionStreaming);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className={cn('chatView')}>
      {/* Session tabs */}
      <div className={cn('sessionTabStrip')}>
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={
              cn('sessionTab') +
              (session.id === activeSessionId ? ' ' + cn('sessionTabActive') : '')
            }
            onClick={() => handleSwitchSession(session.id)}
          >
            <span className={cn('sessionTabName')}>{session.name}</span>
            {sessions.length > 1 && (
              <span
                className={cn('sessionTabClose')}
                onClick={(e) => handleCloseSession(session.id, e)}
                role="button"
                aria-label={`Close ${session.name}`}
              >
                <X size={10} />
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className={cn('sessionTabAdd')}
          onClick={handleAddSession}
          aria-label="New session"
          title="New session"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Message list */}
      <div className={cn('messageList')} ref={containerRef}>
        {!hasContent && chatState === 'idle' && !errorMsg && (
          <div className={cn('emptyState')}>
            <p>Ask anything about this page.<br />I'll find the most relevant answers.</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'annotation' && msg.annotation) {
            return (
              <AnnotationPreview
                key={msg.id}
                annotation={msg.annotation}
                useShadowDom={useShadowDom}
                onDismiss={() => {
                  setSessions((prev) =>
                    updateSession(prev, activeSessionId, (s) => ({
                      ...s,
                      messages: s.messages.filter((m) => m.id !== msg.id),
                      pendingAnnotation: null,
                    }))
                  );
                }}
              />
            );
          }

          if (msg.type === 'error') {
            return (
              <div key={msg.id} className={cn('errorMessage')}>
                <span>{errorMsg || "Couldn't process your question."}</span>
                {msg.errorQuestion && (
                  <button
                    className={cn('retryButton')}
                    onClick={() => msg.errorQuestion && submitQuestion(msg.errorQuestion)}
                    type="button"
                  >
                    Tap to retry
                  </button>
                )}
              </div>
            );
          }

          if (msg.type === 'user') {
            return (
              <div
                key={msg.id}
                className={`${cn('message')} ${cn('userMessage')}`}
              >
                {msg.imageContext && (
                  <button
                    type="button"
                    className={cn('imageThumbnailBtn')}
                    title="Click to scroll to the image on the page"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('xplaino-scroll-to-image', {
                          detail: { id: msg.imageContext!.imageExplanationId },
                        })
                      )
                    }
                  >
                    <img
                      src={msg.imageContext.imageUrl}
                      alt="Image context"
                      className={cn('imageChatThumbnail')}
                    />
                  </button>
                )}
                {msg.content}
              </div>
            );
          }

          // assistant
          return (
            <React.Fragment key={msg.id}>
              <div
                className={`${cn('message')} ${cn('assistantMessage')}`}
              >
                <AssistantMessage
                  content={msg.content ?? ''}
                  citationMap={msg.citationMap ?? citationMap}
                  activeCitations={activeCitations}
                  setActiveCitations={setActiveCitationsLocal}
                  sessionId={activeSessionId}
                  setSessions={setSessions}
                  useShadowDom={useShadowDom}
                  shouldPulsate={msg.id === justCommittedMsgId}
                />
              </div>
              {msg.possibleQuestions && msg.possibleQuestions.length > 0 && (
                <div className={cn('suggestedQuestions')}>
                  {msg.possibleQuestions.map((q, i) => (
                    <button
                      key={i}
                      className={cn('questionItem')}
                      disabled={isCurrentSessionStreaming}
                      onClick={() => submitQuestion(q)}
                    >
                      <Plus size={14} className={cn('questionIcon')} />
                      <span className={cn('questionText')}>{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Indexing indicator */}
        {isIndexing && (
          <div className={cn('indexingIndicator')}>
            <span className={cn('indexingDot')} />
            Indexing page…
          </div>
        )}

        {/* Loading dots before first chunk — only for the session that owns the stream */}
        {isCurrentSessionStreaming && (chatState === 'classifying' || (chatState === 'answering' && !streamingAnswer)) && (
          <div className={cn('loadingContainer')}>
            <LoadingDots dotCount={dotCount} getClassName={cn} />
          </div>
        )}

        {/* Streaming assistant response — only for the session that owns the stream */}
        {isCurrentSessionStreaming && streamingAnswer && (
          <div className={`${cn('message')} ${cn('assistantMessage')}`}>
            <AssistantMessage
              content={streamingAnswer}
              citationMap={citationMap}
              activeCitations={activeCitations}
              setActiveCitations={setActiveCitationsLocal}
              sessionId={activeSessionId}
              setSessions={setSessions}
              useShadowDom={useShadowDom}
              isStreaming={true}
            />
            <span className={cn('cursor')} />
          </div>
        )}
      </div>

      {/* Prompt row */}
      <div className={cn('promptRow')}>
        {/* + create prompt button */}
        <div className={cn('tooltipWrap')}>
          <button
            type="button"
            className={cn('promptAddBtn')}
            onClick={() => setShowCreatePromptModal(true)}
            aria-label="Create prompt"
          >
            <Plus size={13} />
          </button>
          <span className={`${cn('tooltip')} ${cn('tooltipAbove')}`}>Create prompt</span>
        </div>

        {/* ... custom prompts button */}
        {customPrompts.length > 0 && (
          <div className={cn('customPromptMenuWrap')} ref={customPromptMenuRef}>
            <div className={cn('tooltipWrap')}>
              <button
                type="button"
                className={`${cn('promptAddBtn')}${customPromptMenuOpen ? ` ${cn('promptAddBtnActive')}` : ''}`}
                onClick={() => {
                  setCustomPromptMenuOpen((v) => !v);
                  setCustomPromptActionMenuId(null);
                  setCustomPromptActionMenuPos(null);
                }}
                aria-label="Custom prompts"
              >
                <MoreHorizontal size={13} />
              </button>
              <span className={`${cn('tooltip')} ${cn('tooltipAbove')}`}>Custom prompts</span>
            </div>

            <div className={`${cn('customPromptDropdown')}${customPromptMenuOpen ? ` ${cn('customPromptDropdownOpen')}` : ''}`}>
              <div className={cn('customPromptDropdownList')}>
                {customPrompts.map((p) => (
                  <div key={p.id} className={cn('customPromptItem')}>
                    <button
                      type="button"
                      className={cn('customPromptItemTitle')}
                      onClick={() => handlePromptClick(p.title, p.description ? stripHtml(p.description) : p.title)}
                    >
                      <BookMarked size={13} />
                      <span className={cn('customPromptItemTitleText')}>{p.title}</span>
                    </button>
                    <button
                      type="button"
                      className={cn('customPromptItemMenuBtn')}
                      aria-label="Prompt options"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isOpening = customPromptActionMenuId !== p.id;
                        setCustomPromptActionMenuId(isOpening ? p.id : null);
                        setCustomPromptActionMenuPos(
                          isOpening
                            ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
                            : null
                        );
                      }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={cn('customPromptDropdownFooter')}>
                <button
                  type="button"
                  className={cn('customPromptFooterBtn')}
                  onClick={() => { setShowCreatePromptModal(true); setCustomPromptMenuOpen(false); }}
                >
                  <Plus size={13} />
                  <span>Add prompt</span>
                </button>
                <button
                  type="button"
                  className={cn('customPromptFooterBtn')}
                  onClick={() => {
                    setCustomPromptMenuOpen(false);
                    window.open(`${ENV.XPLAINO_WEBSITE_BASE_URL}/user/account/custom-prompt`, '_blank');
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Manage custom prompts</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          ref={summarisePillRef}
          type="button"
          className={cn('promptPill')}
          disabled={isCurrentSessionStreaming}
          onClick={() => submitQuestion(SUMMARISE_PAGE_QUESTION)}
        >
          Summarise
        </button>
        <OnHoverMessage
          message="Summarise page"
          shortcut={isMac ? '⌘M' : 'Ctrl+M'}
          targetRef={summarisePillRef}
          position="top"
          offset={8}
        />
        <button
          type="button"
          className={cn('promptPill')}
          disabled={isCurrentSessionStreaming}
          onClick={() => submitQuestion('What are the key takeaways from this page?')}
        >
          Key takeaways
        </button>
      </div>

      {/* Image attachment preview — shown when "Ask AI about this image" is clicked */}
      {pendingImageAttachment && (
        <div className={cn('imageAttachmentPreview')}>
          <div className={cn('imageAttachmentThumbWrap')}>
            <img
              src={pendingImageAttachment.imageUrl}
              alt="Attached image"
              className={cn('imageAttachmentThumb')}
            />
            <button
              type="button"
              className={cn('imageAttachmentDismiss')}
              onClick={() => setPendingImageAttachment(null)}
              title="Remove image"
            >
              <X size={10} />
            </button>
          </div>
          <span className={cn('imageAttachmentHint')}>Ask about the attached image</span>
        </div>
      )}

      {/* Input bar */}
      <div className={cn('inputBar')}>
        <div className={cn('inputWrapper')}>
          <input
            ref={inputRef}
            type="text"
            className={cn('input')}
            placeholder="Ask about this page…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCurrentSessionStreaming && chatState !== 'answering'}
          />
        </div>

        {isCurrentSessionStreaming && chatState === 'answering' ? (
          <button
            className={cn('stopButton')}
            onClick={handleStop}
            type="button"
            aria-label="Stop"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            className={cn('sendButton')}
            onClick={handleSend}
            disabled={!inputValue.trim() || isCurrentSessionStreaming}
            type="button"
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        )}

        {hasContent && (
          <button
            className={cn('clearButton')}
            onClick={handleClear}
            type="button"
            aria-label="Clear chat"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Per-prompt action menu (fixed position, rendered inline for shadow DOM compat) */}
      {customPromptActionMenuId && customPromptActionMenuPos && (() => {
        const activePrompt = customPrompts.find((p) => p.id === customPromptActionMenuId);
        if (!activePrompt) return null;
        return (
          <div
            className={cn('customPromptActionMenu')}
            style={{ top: customPromptActionMenuPos.top, right: customPromptActionMenuPos.right }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={cn('customPromptActionItem')}
              onClick={() => { setEditingPrompt(activePrompt); closeActionMenu(); }}
            >
              <Pencil size={13} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className={cn('customPromptActionItem')}
              onClick={async () => {
                try {
                  await CustomPromptService.setCustomPromptHidden(activePrompt.id, true);
                  setCustomPrompts((prev) => prev.filter((x) => x.id !== activePrompt.id));
                } catch { /* noop */ }
                closeActionMenu();
              }}
            >
              <EyeOff size={13} />
              <span>Hide</span>
            </button>
            <button
              type="button"
              className={cn('customPromptActionItem')}
              onClick={() => {
                setSharingPrompt(activePrompt);
                setShareUserId('');
                setShareError(null);
                closeActionMenu();
              }}
            >
              <Share2 size={13} />
              <span>Share</span>
            </button>
            <button
              type="button"
              className={`${cn('customPromptActionItem')} ${cn('customPromptActionItemDanger')}`}
              onClick={() => { setConfirmDeletePromptId(activePrompt.id); closeActionMenu(); }}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        );
      })()}

      {/* Share prompt dialog */}
      {sharingPrompt && (
        <div
          className={cn('confirmOverlay')}
          onMouseDown={() => { setSharingPrompt(null); setShareUserId(''); setShareError(null); }}
        >
          <div className={cn('confirmDialog')} onMouseDown={(e) => e.stopPropagation()}>
            <p className={cn('confirmTitle')}>Share &ldquo;{sharingPrompt.title}&rdquo;</p>
            <p className={cn('confirmBody')}>Enter the user ID of the person you want to share this prompt with.</p>
            <input
              className={cn('confirmInput')}
              type="text"
              placeholder="Enter email to share with"
              value={shareUserId}
              onChange={(e) => setShareUserId(e.target.value)}
              autoFocus
            />
            {shareError && <p className={cn('confirmError')}>{shareError}</p>}
            <div className={cn('confirmActions')}>
              <button
                type="button"
                className={cn('confirmCancelBtn')}
                onClick={() => { setSharingPrompt(null); setShareUserId(''); setShareError(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cn('confirmPrimaryBtn')}
                disabled={!shareUserId.trim() || shareLoading}
                onClick={async () => {
                  if (!shareUserId.trim()) return;
                  try {
                    setShareLoading(true);
                    setShareError(null);
                    await CustomPromptService.shareCustomPrompt(sharingPrompt.id, { sharedToUserId: shareUserId.trim() });
                    setSharingPrompt(null);
                    setShareUserId('');
                  } catch (err) {
                    setShareError(err instanceof Error ? err.message : 'Failed to share prompt');
                  } finally {
                    setShareLoading(false);
                  }
                }}
              >
                {shareLoading && <Loader2 size={13} className={cn('spin')} />}
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete prompt confirmation */}
      {confirmDeletePromptId && (
        <div
          className={cn('confirmOverlay')}
          onMouseDown={() => setConfirmDeletePromptId(null)}
        >
          <div className={cn('confirmDialog')} onMouseDown={(e) => e.stopPropagation()}>
            <p className={cn('confirmTitle')}>Delete prompt?</p>
            <p className={cn('confirmBody')}>This action cannot be undone.</p>
            <div className={cn('confirmActions')}>
              <button
                type="button"
                className={cn('confirmCancelBtn')}
                onClick={() => setConfirmDeletePromptId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cn('confirmDangerBtn')}
                onClick={async () => {
                  try {
                    await CustomPromptService.deleteCustomPrompt(confirmDeletePromptId);
                    setCustomPrompts((prev) => prev.filter((x) => x.id !== confirmDeletePromptId));
                  } catch { /* noop */ }
                  setConfirmDeletePromptId(null);
                }}
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit prompt modal */}
      <CreateCustomPromptModal
        isOpen={showCreatePromptModal || !!editingPrompt}
        existingPrompt={editingPrompt}
        onClose={() => { setShowCreatePromptModal(false); setEditingPrompt(null); }}
        onCreated={(created) => {
          setCustomPrompts((prev) => [created, ...prev]);
          setShowCreatePromptModal(false);
        }}
        onUpdated={(updated) => {
          setCustomPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setEditingPrompt(null);
        }}
        useShadowDom={useShadowDom}
      />
    </div>
  );
};

WebpageChatView.displayName = 'WebpageChatView';

// ============================================================
// Contextual path: build vector-searched chunk set
// ============================================================

async function buildContextualChunks(
  question: string,
  onIndexingStart: () => void
): Promise<ReturnType<typeof chunkPage>> {
  const pageUrl = window.location.href;
  const urlHash = await hashPageUrl(pageUrl);

  const fullText = extractFullPageText();
  const contentHash = await hashPageContent(fullText);

  let storedIndex = await getVectorIndex(urlHash);

  if (!storedIndex || storedIndex.pageContentHash !== contentHash) {
    onIndexingStart();

    const freshChunks = chunkPage();
    if (freshChunks.length === 0) throw new Error('No chunks to index');

    const texts = freshChunks.map((c) => c.text);
    const vectors = await embedTexts(texts);

    await putVectorIndex({
      pageUrlHash: urlHash,
      pageContentHash: contentHash,
      indexedAt: new Date().toISOString(),
      chunks: freshChunks.map((c, i) => ({
        chunkId: c.chunkId,
        text: c.text,
        vector: vectors[i],
        metadata: c.metadata,
      })),
    });

    storedIndex = await getVectorIndex(urlHash);
  }

  if (!storedIndex || storedIndex.chunks.length === 0) {
    throw new Error('Vector index unavailable');
  }

  const questionVector = await embedText(question);

  const scored = storedIndex.chunks
    .map((c) => ({
      chunkId: c.chunkId,
      text: c.text,
      cosineScore: cosineSimilarity(questionVector, c.vector),
      metadata: c.metadata,
    }))
    .sort((a, b) => b.cosineScore - a.cosineScore)
    .slice(0, TOP_COSINE);

  const reranked = bm25Rerank(question, scored, TOP_AFTER_RERANK);

  return reranked.map((c) => ({
    chunkId: c.chunkId,
    text: c.text,
    metadata: c.metadata,
  }));
}
