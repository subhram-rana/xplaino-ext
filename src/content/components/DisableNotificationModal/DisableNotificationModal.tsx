// src/content/components/DisableNotificationModal/DisableNotificationModal.tsx
import React, { useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

export interface DisableNotificationModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when "I understood" is clicked */
  onUnderstood?: () => void;
  /** Callback when "Don't show me again" is clicked */
  onDontShowAgain?: () => void;
}

export const DisableNotificationModal: React.FC<DisableNotificationModalProps> = ({
  visible,
  onUnderstood,
  onDontShowAgain,
}) => {
  const handleUnderstood = useCallback(() => {
    onUnderstood?.();
  }, [onUnderstood]);

  const handleDontShowAgain = useCallback(() => {
    onDontShowAgain?.();
  }, [onDontShowAgain]);

  if (!visible) return null;

  return (
    <div className="disableNotificationModal">
      <div className="disableNotificationModalArrow">
        <ArrowUp size={20} strokeWidth={3} />
      </div>
      <div className="disableNotificationModalContent">
        <p className="disableNotificationModalMessage">
          You can enable it from here
        </p>
        <div className="disableNotificationModalButtons">
          <button
            className="disableNotificationModalButton understoodButton"
            onClick={handleUnderstood}
          >
            I understood
          </button>
          <button
            className="disableNotificationModalButton dontShowButton"
            onClick={handleDontShowAgain}
          >
            Don't show me again
          </button>
        </div>
      </div>
    </div>
  );
};

DisableNotificationModal.displayName = 'DisableNotificationModal';

