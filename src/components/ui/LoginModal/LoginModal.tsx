import React, { useState } from 'react';
import styles from './LoginModal.module.css';

interface LoginModalProps {
  actionText: string;
  onLogin?: () => void;
}

/**
 * LoginModal - Login component for Chrome extension
 * Can be customized with different auth providers
 *
 * @param actionText - Text describing the action requiring login
 * @param onLogin - Callback when login is initiated
 * @returns JSX element
 */
export const LoginModal: React.FC<LoginModalProps> = ({ 
  actionText,
  onLogin 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // TODO: Implement Chrome extension authentication
      // This could use chrome.identity API for Google OAuth
      // or redirect to web app for authentication
      
      if (onLogin) {
        onLogin();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to login. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginModal}>
      <div className={styles.content}>
        <div className={styles.loginContainer}>
          <p className={styles.actionText}>Login to {actionText}</p>
          
          <button 
            className={styles.loginButton}
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          
          {error && (
            <div className={styles.errorMessage}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

LoginModal.displayName = 'LoginModal';

