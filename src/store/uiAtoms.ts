// src/store/uiAtoms.ts
import { atom } from 'jotai';

// ============================================
// UI STATE ATOMS
// ============================================

/** Loading state atom */
export const isLoadingAtom = atom<boolean>(false);

/** Error message atom */
export const errorMessageAtom = atom<string | null>(null);

/** Modal visibility atoms */
export const isModalOpenAtom = atom<boolean>(false);

/** Active tab atom */
export const activeTabAtom = atom<string>('text');

