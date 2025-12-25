// src/store/textExplanationAtoms.ts
// Jotai atoms for Text Explanation state management (multiple explanations support)

import { atom } from 'jotai';
import type { UnderlineState } from '@/content/utils/textSelectionUnderline';

// Types
export interface TextExplanationState {
  id: string;
  selectedText: string;
  range: Range | null;
  iconPosition: { x: number; y: number };
  isSpinning: boolean;
  streamingText: string;
  underlineState: UnderlineState | null;
  abortController: AbortController | null;
  firstChunkReceived: boolean;
  iconRef: React.MutableRefObject<HTMLElement | null> | null;
  possibleQuestions: string[];
  textStartIndex: number;
  textLength: number;
  pendingQuestion?: string; // Track the question being asked for stop handler
  shouldAllowSimplifyMore: boolean; // Whether Simplify button should be shown
  previousSimplifiedTexts: string[]; // Array of previous simplified texts for context
  simplifiedExplanationCount: number; // Count of simplified explanations (1, 2, 3, etc.)
  isSimplifyRequest?: boolean; // Track if current request is a Simplify request (not Ask request)
  translations: Array<{ language: string; translated_content: string }>; // Array of translations for this selected text
  paragraphId?: string; // ID of saved paragraph if this text is bookmarked
}

// ============================================
// TEXT EXPLANATION STATE ATOMS
// ============================================

/** Map of all text explanations keyed by explanation ID */
export const textExplanationsAtom = atom<Map<string, TextExplanationState>>(new Map());

/** Currently active/selected explanation ID (null if no panel is open) */
export const activeTextExplanationIdAtom = atom<string | null>(null);

/** Boolean indicating if the side panel is currently open */
export const textExplanationPanelOpenAtom = atom<boolean>(false);

// ============================================
// DERIVED ATOMS
// ============================================

/** Get the active explanation from the map (returns null if active ID is null or not found) */
export const activeTextExplanationAtom = atom((get) => {
  const activeId = get(activeTextExplanationIdAtom);
  if (!activeId) {
    return null;
  }
  
  const explanations = get(textExplanationsAtom);
  return explanations.get(activeId) || null;
});

