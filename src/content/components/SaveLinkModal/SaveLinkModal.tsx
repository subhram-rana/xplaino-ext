// src/content/components/SaveLinkModal/SaveLinkModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import styles from './SaveLinkModal.module.css';

export interface SaveLinkModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when save button is clicked */
  onSave: (name: string) => void;
  /** Initial name value (pre-filled with page title) */
  initialName: string;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Whether save operation is in progress */
  isSaving?: boolean;
  /** Modal title/heading */
  modalTitle?: string;
}

export const SaveLinkModal: React.FC<SaveLinkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName,
  useShadowDom = false,
  isSaving = false,
  modalTitle = 'Save link with summary',
}) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update name when initialName changes
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [initialName, isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  const getClassName = useCallback(
    (name: string) => {
      return useShadowDom ? name : styles[name];
    },
    [useShadowDom]
  );

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    onSave(trimmedName || initialName);
  }, [name, initialName, onSave]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSaving) {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSave, isSaving, onClose]);

  if (!isOpen) return null;

  return (
    <div className={getClassName('modalBackdrop')} onClick={handleBackdropClick}>
      <div className={getClassName('modalContainer')} onClick={(e) => e.stopPropagation()}>
        <div className={getClassName('modalHeader')}>
          <h2 className={getClassName('modalTitle')}>{modalTitle}</h2>
          <button
            className={getClassName('closeButton')}
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className={getClassName('modalContent')}>
          <div className={getClassName('inputContainer')}>
            <label className={getClassName('inputLabel')} htmlFor="link-name-input">
              Name (optional)
            </label>
            <input
              ref={inputRef}
              id="link-name-input"
              type="text"
              className={getClassName('nameInput')}
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                // Limit to 50 characters (API constraint)
                if (value.length <= 50) {
                  setName(value);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter link name"
              disabled={isSaving}
              maxLength={50}
            />
            <div className={getClassName('charCount')}>
              {name.length}/50
            </div>
          </div>
        </div>

        <div className={getClassName('modalFooter')}>
          <button
            className={getClassName('cancelButton')}
            onClick={onClose}
            disabled={isSaving}
            type="button"
          >
            Cancel
          </button>
          <button
            className={getClassName('saveButton')}
            onClick={handleSave}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

SaveLinkModal.displayName = 'SaveLinkModal';

