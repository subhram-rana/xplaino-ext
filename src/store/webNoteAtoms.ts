// src/store/webNoteAtoms.ts
// Jotai atoms for Web Note state management

import { atom } from 'jotai';
import type { AnchorData } from '@/api-services/dto/WebHighlightDTO';

export interface WebNoteState {
  id: string;
  selectedText: string;
  anchor: AnchorData;
  content: string;
  /** Zero-width <span> injected at the end of the text range; used to position the note icon. */
  anchorSpan: HTMLSpanElement | null;
}

/** Map of note ID → runtime note state (including DOM refs). */
export const webNotesAtom = atom<Map<string, WebNoteState>>(new Map());
