// src/content/components/ContentActions/ContentActionsButtonGroup.tsx
import React, { useState, useCallback, useRef } from 'react';
import { ContentActionButton } from './ContentActionButton';
import { DisablePopover } from './DisablePopover';

export interface ContentActionsButtonGroupProps {
  /** Whether the button group is visible */
  visible: boolean;
  /** Whether the current selection is a word (shows Grammar button) */
  isWordSelection: boolean;
  /** Callback when Explain is clicked */
  onExplain: () => void;
  /** Callback when Grammar is clicked */
  onGrammar: () => void;
  /** Callback when Translate is clicked */
  onTranslate: () => void;
  /** Callback when Bookmark is clicked */
  onBookmark: () => void;
}

export const ContentActionsButtonGroup: React.FC<ContentActionsButtonGroupProps> = ({
  visible,
  isWordSelection,
  onExplain,
  onGrammar,
  onTranslate,
  onBookmark,
}) => {
  const [showDisablePopover, setShowDisablePopover] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePowerMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setShowDisablePopover(true);
  }, []);

  const handlePowerMouseLeave = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowDisablePopover(false);
    }, 150);
  }, []);

  const handleDisabled = useCallback(() => {
    setShowDisablePopover(false);
  }, []);

  return (
    <div className={`contentActionsButtonGroup ${visible ? 'visible' : ''}`}>
      <ContentActionButton
        icon="explain"
        tooltip="Explain"
        onClick={onExplain}
        delay={0}
      />
      {isWordSelection && (
        <ContentActionButton
          icon="grammar"
          tooltip="Grammar"
          onClick={onGrammar}
          delay={1}
        />
      )}
      <ContentActionButton
        icon="translate"
        tooltip="Translate"
        onClick={onTranslate}
        delay={isWordSelection ? 2 : 1}
      />
      <ContentActionButton
        icon="bookmark"
        tooltip="Bookmark"
        onClick={onBookmark}
        delay={isWordSelection ? 3 : 2}
      />
      {/* Power button with disable popover */}
      <div
        className="powerButtonWrapper"
        onMouseEnter={handlePowerMouseEnter}
        onMouseLeave={handlePowerMouseLeave}
      >
        <ContentActionButton
          icon="power"
          tooltip="Disable"
          delay={isWordSelection ? 4 : 3}
          className="powerButton"
        >
          <DisablePopover
            visible={showDisablePopover}
            onDisabled={handleDisabled}
          />
        </ContentActionButton>
      </div>
    </div>
  );
};

ContentActionsButtonGroup.displayName = 'ContentActionsButtonGroup';

