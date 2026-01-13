import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Toast.module.css';

export interface ToastProps {
  /** Message text or React node */
  message: string | React.ReactNode;
  /** Callback when toast is closed */
  onClose: () => void;
  /** Auto-close duration in ms. Set to 0 or null to disable auto-close */
  duration?: number | null;
  /** Toast type - affects color scheme */
  type?: 'success' | 'error' | 'warning';
  /** Show close button (X icon) */
  showCloseButton?: boolean;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  onClose, 
  duration = 3000, 
  type = 'success',
  showCloseButton = false,
}) => {
  useEffect(() => {
    // Don't auto-close if duration is 0, null, or undefined (when explicitly set to null)
    if (!duration || duration === 0) {
      return;
    }

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const toastClassName = `${styles.toast} ${
    type === 'error' ? styles.toastError : 
    type === 'warning' ? styles.toastWarning : ''
  }`;

  return (
    <div className={toastClassName}>
      <div className={styles.content}>
        <div className={styles.message}>
          {message}
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
};

Toast.displayName = 'Toast';

