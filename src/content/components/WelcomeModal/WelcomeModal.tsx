// src/content/components/WelcomeModal/WelcomeModal.tsx
import React, { useCallback, useState, useEffect } from 'react';
import { getCurrentTheme } from '@/constants/theme';

export interface WelcomeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when "Ok" is clicked */
  onOk?: () => void;
  /** Callback when "Don't show me again" is clicked */
  onDontShowAgain?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  visible,
  onDontShowAgain,
}) => {
  const [brandImageUrl, setBrandImageUrl] = useState<string>('');

  // Detect theme and set appropriate brand image
  useEffect(() => {
    const loadBrandImage = async () => {
      const theme = await getCurrentTheme();
      const imageName = theme === 'dark' 
        ? 'brand-name-turquoise.png' 
        : 'brand-name.png';
      const imageUrl = chrome.runtime.getURL(`src/assets/photos/${imageName}`);
      setBrandImageUrl(imageUrl);
    };

    loadBrandImage();
  }, []);

  const handleDontShowAgain = useCallback(() => {
    onDontShowAgain?.();
  }, [onDontShowAgain]);

  if (!visible) return null;

  return (
    <div className="welcomeModalContainer">
      <div className="welcomeModalContent">
        {/* Brand Image */}
        <div className="welcomeModalImageContainer">
          <img 
            src={brandImageUrl} 
            alt="Xplaino" 
            className="welcomeModalImage"
          />
        </div>

        {/* Instruction Text + Button in a single row */}
        <div className="welcomeModalRow">
          <p className="welcomeModalText">
            Your Control Panel
          </p>
          <button
            className="welcomeModalButton dontShowButton"
            onClick={handleDontShowAgain}
            type="button"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

WelcomeModal.displayName = 'WelcomeModal';

