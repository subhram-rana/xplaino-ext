// src/content/components/LoginModal/LoginModal.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { showLoginModalAtom, isLoginLoadingAtom, loginErrorAtom } from '@/store/uiAtoms';
import { AuthService } from '@/api-services/AuthService';
import { COLORS } from '@/constants/colors';

export interface LoginModalProps {
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ useShadowDom: _useShadowDom = false }) => {
  // Note: useShadowDom prop reserved for future Shadow DOM compatibility
  void _useShadowDom;
  const [isVisible, setIsVisible] = useAtom(showLoginModalAtom);
  const [isLoading, setIsLoading] = useAtom(isLoginLoadingAtom);
  const [error, setError] = useAtom(loginErrorAtom);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const getClassName = useCallback((baseClass: string) => {
    // For Shadow DOM, use plain class names
    return baseClass;
  }, []);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      setError(null);
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

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await AuthService.loginWithGoogle();
      handleClose();
    } catch (err) {
      console.error('[LoginModal] Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`${getClassName('loginModalOverlay')} ${isClosing ? getClassName('closing') : ''}`}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className={`${getClassName('loginModalContainer')} ${isClosing ? getClassName('closing') : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={getClassName('loginModalHeader')}>
          <h2 className={getClassName('loginModalTitle')}>Sign in to Xplaino</h2>
          <p className={getClassName('loginModalSubtitle')}>
            Sign in to unlock all features
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={getClassName('loginModalError')}>
            {error}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          className={getClassName('googleSignInButton')}
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          type="button"
        >
          {isLoading ? (
            <span className={getClassName('loadingSpinner')} />
          ) : (
            <>
              {/* Google Logo SVG */}
              <svg
                className={getClassName('googleLogo')}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill={COLORS.GOOGLE_BLUE}
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill={COLORS.GOOGLE_GREEN}
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill={COLORS.GOOGLE_YELLOW}
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill={COLORS.GOOGLE_RED}
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className={getClassName('googleSignInText')}>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </span>
            </>
          )}
        </button>

        {/* Footer */}
        <p className={getClassName('loginModalFooter')}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

LoginModal.displayName = 'LoginModal';

