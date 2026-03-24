// src/store/webpageChatAtoms.ts
// Jotai atoms for the "Chat with Webpage" multi-session feature.

import { atom } from 'jotai';
import { ConversationMessage, CitationDetail } from '@/api-services/WebpageChatService';

export type { ConversationMessage };

// =============================================================================
// Message types
// =============================================================================

/** Annotation context attached to a question (selected text from page) */
export interface AnnotationData {
  selectedText: string;
  textSnippetStart: string;
  textSnippetEnd: string;
}

/**
 * A single rendered message in the chat UI.
 * Serializable — no function references. `errorQuestion` carries the question
 * to retry, and the component reconstructs the callback.
 */
export interface RenderedMessage {
  id: string;
  type: 'user' | 'assistant' | 'annotation' | 'error';
  /** User/assistant text content */
  content?: string;
  /** Per-message citation map (assistant messages only) */
  citationMap?: Record<string, CitationDetail>;
  /** For error messages: the original question, used to reconstruct the retry handler */
  errorQuestion?: string;
  /** For annotation messages: the selected text context */
  annotation?: AnnotationData;
}

// =============================================================================
// Session
// =============================================================================

/** A single chat session with its own history, messages, and citation state */
export interface ChatSession {
  id: string;
  name: string;
  /** Rendered UI messages (includes annotation cards, errors, user/assistant bubbles) */
  messages: RenderedMessage[];
  /** API conversation history — sent to classify/answer endpoints */
  history: ConversationMessage[];
  /** Citation map accumulated across all answers in this session */
  citationMap: Record<string, CitationDetail>;
  /** chunkIds whose <mark> highlights are currently active on the page */
  activeCitations: string[];
  /**
   * Pending annotation set when a text-selection action opens this session.
   * Consumed (cleared) the moment the user submits their first question with it.
   */
  pendingAnnotation: AnnotationData & { question?: string } | null;
}

function createSession(id: string, name: string): ChatSession {
  return {
    id,
    name,
    messages: [],
    history: [],
    citationMap: {},
    activeCitations: [],
    pendingAnnotation: null,
  };
}

const INITIAL_SESSION_ID = 'session-1';

export function makeSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// =============================================================================
// Pending annotation (cross-boundary: set by content/index.ts, consumed in view)
// =============================================================================

/** Payload set by content/index.ts when a text-selection action fires */
export interface PendingAnnotation extends AnnotationData {
  /** Pre-populated question for preset actions (Summarize, Key Points, etc.) */
  question?: string;
  /** When true, the chat input bar should be focused after the annotation is consumed */
  focusInput?: boolean;
}

/** Set by content/index.ts; consumed + cleared by WebpageChatView on mount/update */
export const webpageChatPendingAnnotationAtom = atom<PendingAnnotation | null>(null);

// =============================================================================
// Session atoms
// =============================================================================

export const webpageChatSessionsAtom = atom<ChatSession[]>([
  createSession(INITIAL_SESSION_ID, 'Session 1'),
]);

export const webpageChatActiveSessionIdAtom = atom<string>(INITIAL_SESSION_ID);

/** Derived: the currently visible session object */
export const webpageChatActiveSessionAtom = atom<ChatSession | undefined>((get) => {
  const sessions = get(webpageChatSessionsAtom);
  const activeId = get(webpageChatActiveSessionIdAtom);
  return sessions.find((s) => s.id === activeId);
});

/**
 * Derived: session counter used when naming the next new session.
 * Equals (highest numeric suffix seen across all session names) + 1.
 */
export const webpageChatNextSessionCounterAtom = atom<number>((get) => {
  const sessions = get(webpageChatSessionsAtom);
  let max = 0;
  for (const s of sessions) {
    const m = s.name.match(/Session (\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
});

// =============================================================================
// Transient state atoms (apply to the currently active session in-flight)
// =============================================================================

export type WebpageChatState =
  | 'idle'
  | 'classifying'   // POST /classify in flight
  | 'indexing'      // Building / loading vector index
  | 'answering'     // POST /answer SSE streaming
  | 'error';

export const webpageChatStateAtom = atom<WebpageChatState>('idle');

export const webpageChatStreamingAnswerAtom = atom<string>('');

export const webpageChatErrorAtom = atom<string>('');

export const webpageChatLastQuestionAtom = atom<string>('');

export const webpageChatIndexingIndicatorAtom = atom<boolean>(false);

// =============================================================================
// Derived helpers
// =============================================================================

export const webpageChatIsLoadingAtom = atom<boolean>((get) => {
  const state = get(webpageChatStateAtom);
  return state === 'classifying' || state === 'indexing' || state === 'answering';
});

/**
 * True when any session has at least one assistant reply.
 * Used by the refresh-guard keyboard listener in content/index.ts.
 */
export const webpageChatHasConversationAtom = atom<boolean>((get) => {
  const sessions = get(webpageChatSessionsAtom);
  return sessions.some((s) => s.messages.some((m) => m.type === 'assistant'));
});

/**
 * When true, the custom "Chat will be cleared on reload" warning modal is shown.
 * Set by the keyboard refresh interceptor in content/index.ts.
 * Reset to false when the user dismisses (Stay) or confirms (Reload).
 */
export const webpageChatShowRefreshWarningAtom = atom<boolean>(false);
