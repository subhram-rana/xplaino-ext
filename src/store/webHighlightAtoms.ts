// src/store/webHighlightAtoms.ts
// Jotai atoms for Web Highlight state management

import { atom } from 'jotai';
import type { AnchorData } from '@/api-services/dto/WebHighlightDTO';
import type { HighlightColour } from '@/api-services/HighlightColourService';

export interface WebHighlightState {
  id: string;
  selectedText: string;
  anchor: AnchorData;
  color: string | null;
  /** References to the <mark> DOM nodes so they can be removed without a DOM query */
  wrapperElements: HTMLElement[];
}

/** Map of highlight ID → runtime highlight state (including DOM refs) */
export const webHighlightsAtom = atom<Map<string, WebHighlightState>>(new Map());

/** True while the initial GET /api/web-highlights is in flight */
export const webHighlightsLoadingAtom = atom<boolean>(false);

/** All available highlight colours fetched from GET /api/highlight/colours */
export const highlightColoursAtom = atom<HighlightColour[]>([]);

/** The ID of the colour currently selected by the user (persisted to ChromeStorage) */
export const selectedHighlightColourIdAtom = atom<string | null>(null);
