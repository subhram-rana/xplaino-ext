// src/content/components/ReviewPromptModal/ReviewPromptModal.tsx
import React, { useCallback, useState, useEffect } from 'react';
import { getCurrentTheme } from '@/constants/theme';

const CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/xplaino-ai/nmphalmbdmddagbllhjnfnmodfmbnlkp';

export interface ReviewPromptModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when "Write a Review" is clicked */
  onReviewClick?: () => void;
  /** Callback when "Maybe Later" is clicked */
  onMaybeLater?: () => void;
}

export const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({
  visible,
  onReviewClick,
  onMaybeLater,
}) => {
  const [brandImageUrl, setBrandImageUrl] = useState<string>('');

  // Detect theme and set appropriate brand image
  useEffect(() => {
    const loadBrandImage = async () => {
      const theme = await getCurrentTheme();
      const imageName =
        theme === 'dark' ? 'brand-name-turquoise.png' : 'brand-name.png';
      const imageUrl = chrome.runtime.getURL(`src/assets/photos/${imageName}`);
      setBrandImageUrl(imageUrl);
    };

    loadBrandImage();
  }, []);

  const handleReviewClick = useCallback(() => {
    // Open Chrome Web Store in a new tab
    window.open(CHROME_WEB_STORE_URL, '_blank');
    onReviewClick?.();
  }, [onReviewClick]);

  const handleMaybeLater = useCallback(() => {
    onMaybeLater?.();
  }, [onMaybeLater]);

  if (!visible) return null;

  return (
    <div className="reviewPromptModalOverlay">
      <div className="reviewPromptModalContent">
        {/* Brand Image */}
        <div className="reviewPromptModalImageContainer">
          <img
            src={brandImageUrl}
            alt="Xplaino"
            className="reviewPromptModalImage"
          />
        </div>

        {/* Heading */}
        <h2 className="reviewPromptModalHeading">Enjoying Xplaino AI?</h2>

        {/* Message */}
        <p className="reviewPromptModalText">
          Your feedback helps us improve the extension and build a better
          experience for everyone.
        </p>

        {/* Primary action */}
        <button
          className="reviewPromptModalButton reviewButton"
          onClick={handleReviewClick}
          type="button"
        >
          Rate Us
        </button>

        {/* Subtle dismiss link */}
        <button
          className="maybeLaterLink"
          onClick={handleMaybeLater}
          type="button"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};

ReviewPromptModal.displayName = 'ReviewPromptModal';
