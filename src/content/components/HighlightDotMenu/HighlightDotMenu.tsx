// src/content/components/HighlightDotMenu/HighlightDotMenu.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Trash2, FileText } from 'lucide-react';

export interface HighlightDotMenuProps {
  /** Fixed viewport coordinates — the 13px dot will be centered here */
  position: { left: number; top: number };
  /** Whether the dropdown is currently open */
  isMenuOpen: boolean;
  /** Called when the dot button is clicked (toggle menu) */
  onDotClick: () => void;
  /** Called when "Clear highlight" is clicked */
  onDelete: () => void;
  /** Called when "Add a note" is clicked */
  onAddNote?: () => void;
  /** Called when the mouse enters the dot/dropdown — cancels hide timer */
  onMouseEnter: () => void;
  /** Called when the mouse leaves the dot/dropdown — starts hide timer */
  onMouseLeave: () => void;
}

export const HighlightDotMenu: React.FC<HighlightDotMenuProps> = ({
  position,
  isMenuOpen,
  onDotClick,
  onDelete,
  onAddNote,
  onMouseEnter,
  onMouseLeave,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Trigger the visible CSS class after mount so the CSS transition plays
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleMouseLeave = (e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget;
    const wrapper = wrapperRef.current;
    // Don't start hide timer if moving to a child element within the wrapper
    if (relatedTarget instanceof Node && wrapper && wrapper.contains(relatedTarget)) return;
    onMouseLeave();
  };

  return (
    <div
      ref={wrapperRef}
      className="highlightDotWrapper"
      style={{
        // Position so the center of the 13px dot is at (position.left, position.top)
        left: `${position.left - 6.5}px`,
        top: `${position.top - 6.5}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`highlightDotBtn${isMounted ? ' visible' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDotClick();
        }}
        aria-label="Highlight options"
        aria-expanded={isMenuOpen}
      >
        <span className="highlightDotInner" aria-hidden="true" />
      </button>

      {isMenuOpen && (
        <div
          className="highlightDotDropdown"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Add a note */}
          <button
            className="highlightDotOption"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddNote?.();
            }}
            aria-label="Add a note"
          >
            <FileText size={13} />
            <span>Add a note</span>
          </button>

          <div className="highlightDotOptionSeparator" />

          {/* Clear highlight — calls delete API */}
          <button
            className="highlightDotOption highlightDotOptionDanger"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Clear highlight"
          >
            <Trash2 size={13} />
            <span>Clear highlight</span>
          </button>
        </div>
      )}
    </div>
  );
};

HighlightDotMenu.displayName = 'HighlightDotMenu';
