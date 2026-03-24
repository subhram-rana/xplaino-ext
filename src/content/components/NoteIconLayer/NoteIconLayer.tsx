// src/content/components/NoteIconLayer/NoteIconLayer.tsx
// Renders one fixed-position note icon per saved note, anchored to the
// zero-width span injected at the end of the noted text range.

import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { WebNoteState } from '@/store/webNoteAtoms';

export interface NoteIconLayerProps {
  notes: WebNoteState[];
  /**
   * Pre-computed fixed-viewport positions keyed by note ID.
   * Derived from the note's resolved Range client rects (rightmost edge).
   * Falls back to anchorSpan.getBoundingClientRect() when absent.
   */
  noteIconPositions?: Record<string, { left: number; top: number }>;
  /** Called when the user hovers over a note icon */
  onHover: (noteId: string, anchorRect: DOMRect) => void;
  /** Called when the mouse leaves a note icon */
  onLeave: () => void;
  /** Called when the user clicks a note icon */
  onClick: (noteId: string, anchorRect: DOMRect) => void;
  /** ID of the note whose editor is currently open/pinned */
  pinnedNoteId: string | null;
}

export const NoteIconLayer: React.FC<NoteIconLayerProps> = ({
  notes,
  noteIconPositions,
  onHover,
  onLeave,
  onClick,
  pinnedNoteId,
}) => {
  return (
    <>
      {notes.map((note) => {
        // Prefer pre-computed rightmost position; fall back to anchor span.
        const precomputed = noteIconPositions?.[note.id];
        let left: number;
        let top: number;

        if (precomputed) {
          left = precomputed.left;
          top = precomputed.top;
        } else {
          if (!note.anchorSpan) return null;
          const fallbackRect = note.anchorSpan.getBoundingClientRect();
          if (fallbackRect.width === 0 && fallbackRect.height === 0) return null;
          left = fallbackRect.right + 4;
          top = fallbackRect.top;
        }

        const isPinned = pinnedNoteId === note.id;

        return (
          <div
            key={note.id}
            className={`noteIconWrapper${isPinned ? ' noteIconWrapperPinned' : ''}`}
            style={{ left: `${left}px`, top: `${top}px` }}
            onMouseEnter={() =>
              onHover(note.id, note.anchorSpan?.getBoundingClientRect() ?? new DOMRect())
            }
            onMouseLeave={() => onLeave()}
          >
            <button
              className={`noteIconBtn${isPinned ? ' noteIconBtnPinned' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onClick(note.id, note.anchorSpan?.getBoundingClientRect() ?? new DOMRect());
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="View or edit note"
              title="Note"
            >
              <MessageSquare size={16} strokeWidth={1.5} />
            </button>
          </div>
        );
      })}
    </>
  );
};

NoteIconLayer.displayName = 'NoteIconLayer';
