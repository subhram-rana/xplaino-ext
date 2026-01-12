// src/content/components/BookmarkSavedToast/BookmarkSavedToast.tsx
import React, { useCallback } from 'react';
import styles from './BookmarkSavedToast.module.css';

export type BookmarkType = 'word' | 'paragraph' | 'link' | 'image';

export interface BookmarkSavedToastProps {
  /** Type of bookmark that was saved */
  bookmarkType: BookmarkType;
  /** URL to the saved bookmarks page */
  url: string;
  /** Whether the toast is in closing animation */
  isClosing: boolean;
  /** Handler for "Okay" button click */
  onOkay: () => void;
  /** Handler for "Don't show again" button click */
  onDontShowAgain: () => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
}

export const BookmarkSavedToast: React.FC<BookmarkSavedToastProps> = ({
  bookmarkType: _bookmarkType, // Reserved for future use (e.g., type-specific messages)
  url,
  isClosing,
  onOkay,
  onDontShowAgain,
  useShadowDom = false,
}) => {
  const getClassName = useCallback((baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  }, [useShadowDom]);

  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.open(url, '_blank');
  }, [url]);

  const toastClassName = `${getClassName('toast')} ${isClosing ? getClassName('toastClosing') : ''}`;

  return (
    <div className={getClassName('toastContainer')}>
      <div className={toastClassName}>
        <div className={getClassName('message')}>
          Your bookmarks are saved{' '}
          <a
            href={url}
            onClick={handleLinkClick}
            className={getClassName('link')}
          >
            here
          </a>
          .
        </div>
        <div className={getClassName('buttons')}>
          <button
            onClick={onOkay}
            className={getClassName('button')}
          >
            Okay
          </button>
          <button
            onClick={onDontShowAgain}
            className={getClassName('button')}
          >
            Don't show again
          </button>
        </div>
      </div>
    </div>
  );
};

BookmarkSavedToast.displayName = 'BookmarkSavedToast';
