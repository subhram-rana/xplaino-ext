// src/store/imageExplanationAtoms.ts
// Jotai atoms for Image Explanation state management

import { atom } from 'jotai';

// Types
export interface ImageExplanationState {
  id: string;
  imageElement: HTMLImageElement;
  imageFile: File | Blob; // Canvas-converted image
  iconPosition: { x: number; y: number };
  isSpinning: boolean;
  streamingText: string;
  abortController: AbortController | null;
  firstChunkReceived: boolean;
  iconRef: React.MutableRefObject<HTMLElement | null> | null;
  possibleQuestions: string[];
  shouldAllowSimplifyMore: boolean;
  previousSimplifiedTexts: string[];
  simplifiedExplanationCount: number;
  isSimplifyRequest?: boolean;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  messageQuestions: Record<number, string[]>;
  savedImageId: string | null; // ID of saved image if bookmarked
}

// ============================================
// IMAGE EXPLANATION STATE ATOMS
// ============================================

/** Map of all image explanations keyed by explanation ID */
export const imageExplanationsAtom = atom<Map<string, ImageExplanationState>>(new Map());

/** Currently active/selected explanation ID (null if no panel is open) */
export const activeImageExplanationIdAtom = atom<string | null>(null);

/** Boolean indicating if the side panel is currently open */
export const imageExplanationPanelOpenAtom = atom<boolean>(false);

// ============================================
// DERIVED ATOMS
// ============================================

/** Get the active explanation from the map (returns null if active ID is null or not found) */
export const activeImageExplanationAtom = atom((get) => {
  const activeId = get(activeImageExplanationIdAtom);
  if (!activeId) {
    return null;
  }
  
  const explanations = get(imageExplanationsAtom);
  return explanations.get(activeId) || null;
});


