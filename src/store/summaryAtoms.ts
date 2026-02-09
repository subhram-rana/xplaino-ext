// src/store/summaryAtoms.ts
// Jotai atoms for Summary tab state persistence across tab switches

import { atom } from 'jotai';

// Types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type PageReadingState = 'reading' | 'ready' | 'error';
export type SummariseState = 'idle' | 'summarising' | 'done' | 'error';
export type AskingState = 'idle' | 'asking' | 'error';

// ============================================
// SUMMARY TAB STATE ATOMS
// ============================================

/** Page reading state */
export const pageReadingStateAtom = atom<PageReadingState>('reading');

/** Summarise state */
export const summariseStateAtom = atom<SummariseState>('idle');

/** Asking state for chat */
export const askingStateAtom = atom<AskingState>('idle');

/** Summary content */
export const summaryAtom = atom<string>('');

/** Streaming text during summarisation */
export const streamingTextAtom = atom<string>('');

/** Streaming text during ask */
export const askStreamingTextAtom = atom<string>('');

/** Possible/suggested questions */
export const possibleQuestionsAtom = atom<ChatMessage[]>([]);

/** Chat messages */
export const chatMessagesAtom = atom<ChatMessage[]>([]);

/** Suggested questions from API - stored per message index */
export const messageQuestionsAtom = atom<Record<number, string[]>>({});

/** Legacy atom for backward compatibility - will be removed */
export const suggestedQuestionsAtom = atom<string[]>([]);

/** Error message */
export const summaryErrorAtom = atom<string>('');

/** Signal to focus the ask input bar in SummaryView */
export const focusAskInputAtom = atom<boolean>(false);

// ============================================
// DERIVED ATOMS
// ============================================

/** Whether there is any content (summary, chat, or streaming) */
export const hasContentAtom = atom((get) => {
  const summary = get(summaryAtom);
  const streamingText = get(streamingTextAtom);
  const chatMessages = get(chatMessagesAtom);
  return !!(summary || streamingText || chatMessages.length > 0);
});

