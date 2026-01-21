// src/content/components/FeatureRequestModal/FeatureRequestModal.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { showFeatureRequestModalAtom, isFeatureRequestLoadingAtom, featureRequestErrorAtom } from '@/store/uiAtoms';
import { IssueService } from '@/api-services/IssueService';

export interface FeatureRequestModalProps {
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
}

const MAX_CHARACTERS = 1000;

export const FeatureRequestModal: React.FC<FeatureRequestModalProps> = ({ useShadowDom: _useShadowDom = false }) => {
  // Note: useShadowDom prop reserved for future Shadow DOM compatibility
  void _useShadowDom;
  const [isVisible, setIsVisible] = useAtom(showFeatureRequestModalAtom);
  const [isLoading, setIsLoading] = useAtom(isFeatureRequestLoadingAtom);
  const [error, setError] = useAtom(featureRequestErrorAtom);
  const [isClosing, setIsClosing] = useState(false);
  const [description, setDescription] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getClassName = useCallback((baseClass: string) => {
    // For Shadow DOM, use plain class names
    return baseClass;
  }, []);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isVisible]);

  // Reset state when modal opens
  useEffect(() => {
    if (isVisible) {
      setDescription('');
      setError(null);
      setSuccessMessage(null);
    }
  }, [isVisible, setError]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      setError(null);
      setSuccessMessage(null);
      setDescription('');
    }, 300); // Match animation duration
  }, [setIsVisible, setError]);

  // Handle click outside modal
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleClose();
    }
  }, [handleClose, isLoading]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible && !isLoading) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, isLoading, handleClose]);

  // Handle description change
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARACTERS) {
      setDescription(value);
      setError(null);
    }
  }, [setError]);

  // Handle submit
  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please enter a feature request description');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const currentUrl = window.location.href;
      await IssueService.reportFeatureRequest(description.trim(), currentUrl);
      
      setSuccessMessage('Thank you! Your feature request has been submitted.');
      setDescription('');
      
      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('[FeatureRequestModal] Submit error:', err);
      if (err instanceof Error && err.message === 'Login required') {
        // Login modal will be shown by ApiErrorHandler
        handleClose();
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit feature request');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  const remainingChars = MAX_CHARACTERS - description.length;
  const isNearLimit = remainingChars <= 100;

  return (
    <div
      className={`${getClassName('featureRequestModalOverlay')} ${isClosing ? getClassName('closing') : ''}`}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className={`${getClassName('featureRequestModalContainer')} ${isClosing ? getClassName('closing') : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={getClassName('featureRequestModalHeader')}>
          <h2 className={getClassName('featureRequestModalTitle')}>Feature Request</h2>
          <p className={getClassName('featureRequestModalSubtitle')}>
            Have an idea to improve Xplaino? We'd love to hear it!
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className={getClassName('featureRequestModalSuccess')}>
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={getClassName('featureRequestModalError')}>
            {error}
          </div>
        )}

        {/* Textarea */}
        {!successMessage && (
          <>
            <div className={getClassName('featureRequestTextareaContainer')}>
              <textarea
                ref={textareaRef}
                className={getClassName('featureRequestTextarea')}
                placeholder="Describe the feature you'd like to see..."
                value={description}
                onChange={handleDescriptionChange}
                maxLength={MAX_CHARACTERS}
                disabled={isLoading}
                rows={6}
              />
              <div className={`${getClassName('featureRequestCharCount')} ${isNearLimit ? getClassName('nearLimit') : ''}`}>
                {remainingChars} characters remaining
              </div>
            </div>

            {/* Submit Button */}
            <button
              className={getClassName('featureRequestSubmitButton')}
              onClick={handleSubmit}
              disabled={isLoading || !description.trim()}
              type="button"
            >
              {isLoading ? (
                <span className={getClassName('loadingSpinner')} />
              ) : (
                'Submit Request'
              )}
            </button>
          </>
        )}

        {/* Footer */}
        <p className={getClassName('featureRequestModalFooter')}>
          Your feedback helps us build a better product
        </p>
      </div>
    </div>
  );
};

FeatureRequestModal.displayName = 'FeatureRequestModal';
