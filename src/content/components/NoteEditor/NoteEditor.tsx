// src/content/components/NoteEditor/NoteEditor.tsx
// Floating note editor card (create / edit modes).
// Ported from PdfHighlightLayer.tsx noteEditor panel in xplaino-web.

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';

export interface NoteEditorProps {
  mode: 'create' | 'edit';
  noteId?: string;
  initialContent?: string;
  /** Fixed viewport coordinates where the editor should appear */
  position: { left: number; top: number };
  onSave: (content: string) => void;
  onUpdate: (noteId: string, content: string) => void;
  onDelete: (noteId: string) => void;
  onClose: () => void;
  /** Called when the mouse enters the editor — cancel any pending close timer */
  onMouseEnter: () => void;
  /** Called when the mouse leaves the editor — start a close timer */
  onMouseLeave: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  mode,
  noteId,
  initialContent = '',
  position,
  onSave,
  onUpdate,
  onDelete,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Trigger the open animation on the next frame
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-size textarea and position cursor on mount
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    const len = el.value.length;
    el.setSelectionRange(len, len);
    el.focus();
  }, []);

  // Clamp the editor so it stays on-screen
  const getClampedStyle = useCallback((): React.CSSProperties => {
    const MARGIN = 8;
    const editorH = editorRef.current?.offsetHeight ?? 200;
    const editorW = editorRef.current?.offsetWidth ?? 230;
    const rawLeft = position.left;
    const rawTop = position.top;
    const clampedLeft = Math.min(
      Math.max(MARGIN, rawLeft),
      window.innerWidth - editorW - MARGIN
    );
    const clampedTop = Math.min(
      Math.max(MARGIN, rawTop),
      window.innerHeight - editorH - MARGIN
    );
    return { left: clampedLeft, top: clampedTop };
  }, [position]);

  const handleSave = useCallback(async () => {
    if (isSaving || !content.trim()) return;
    setIsSaving(true);
    try {
      if (mode === 'create') {
        onSave(content.trim());
      } else if (mode === 'edit' && noteId) {
        onUpdate(noteId, content.trim());
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, content, mode, noteId, onSave, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (isDeleting || !noteId) return;
    setIsDeleting(true);
    try {
      onDelete(noteId);
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, noteId, onDelete]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const modeClass = mode === 'create' ? 'noteEditorCreate' : 'noteEditorEdit';
  const visibleClass = isVisible ? ' noteEditorVisible' : '';
  const busy = isSaving || isDeleting;

  return (
    <div
      ref={editorRef}
      className={`noteEditor ${modeClass}${visibleClass}`}
      style={getClampedStyle()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="noteEditorHeader">
        <span>{mode === 'edit' ? 'Note' : 'Add a note'}</span>
        <button
          className="noteEditorClose"
          onClick={onClose}
          disabled={busy}
          aria-label="Close note editor"
        >
          <X size={14} />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        className="noteEditorTextarea"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          const el = e.target;
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }}
        onKeyDown={handleKeyDown}
        placeholder="Write your note here…"
        rows={3}
        disabled={busy}
      />

      {/* Actions row */}
      <div className="noteEditorActions">
        {mode === 'edit' && noteId && (
          <button
            className="noteEditorDelete"
            onClick={handleDelete}
            disabled={busy}
            aria-label="Delete note"
          >
            {isDeleting ? (
              <span className="noteEditorSpinner" aria-hidden="true" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        )}
        <button
          className="noteEditorSave"
          onClick={handleSave}
          disabled={busy || !content.trim()}
        >
          {isSaving ? (
            <span className="noteEditorSpinner" aria-hidden="true" />
          ) : mode === 'edit' ? (
            'Update'
          ) : (
            'Save'
          )}
        </button>
      </div>

      {/* Bottom-left resize grip — purely decorative, actual resize is handled by CSS */}
      <div className="noteEditorResizeHandle" aria-hidden="true">
        <svg viewBox="0 0 10 10" fill="currentColor" width="10" height="10">
          <circle cx="2" cy="8" r="1" />
          <circle cx="5" cy="8" r="1" />
          <circle cx="8" cy="8" r="1" />
          <circle cx="5" cy="5" r="1" />
          <circle cx="8" cy="5" r="1" />
          <circle cx="8" cy="2" r="1" />
        </svg>
      </div>
    </div>
  );
};

NoteEditor.displayName = 'NoteEditor';
