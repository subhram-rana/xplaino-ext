// src/content/components/WebpageChat/ChatRefreshWarningModal.tsx
// Custom warning modal shown when the user tries to refresh the page while
// there is an active chat session. Rendered inside the SidePanel's Shadow DOM
// as a full-viewport fixed overlay so it appears even when the panel is closed.

import React, { useCallback } from 'react';
import { useAtom } from 'jotai';
import { AlertTriangle } from 'lucide-react';
import { webpageChatShowRefreshWarningAtom } from '@/store/webpageChatAtoms';

interface ChatRefreshWarningModalProps {
  useShadowDom?: boolean;
}

export const ChatRefreshWarningModal: React.FC<ChatRefreshWarningModalProps> = ({
  useShadowDom = false,
}) => {
  const [isVisible, setIsVisible] = useAtom(webpageChatShowRefreshWarningAtom);

  const handleStay = useCallback(() => {
    setIsVisible(false);
  }, [setIsVisible]);

  const handleReload = useCallback(() => {
    setIsVisible(false);
    window.location.reload();
  }, [setIsVisible]);

  if (!isVisible) return null;

  // Styles are inline so the modal works in both Shadow DOM and CSS-module contexts
  // without needing to inject additional stylesheets.
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(2px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    background: useShadowDom ? 'var(--color-surface, #ffffff)' : '#ffffff',
    borderRadius: '14px',
    padding: '28px 28px 22px',
    maxWidth: '360px',
    width: 'calc(100vw - 48px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const iconRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1.3,
  };

  const bodyStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '13.5px',
    color: '#4b5563',
    lineHeight: 1.6,
  };

  const highlightStyle: React.CSSProperties = {
    color: '#0d9488',
    fontWeight: 600,
  };

  const buttonRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '4px',
  };

  const stayBtnStyle: React.CSSProperties = {
    padding: '8px 18px',
    borderRadius: '8px',
    border: '1.5px solid #d1d5db',
    background: 'transparent',
    color: '#374151',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s ease',
  };

  const reloadBtnStyle: React.CSSProperties = {
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    background: '#ef4444',
    color: '#ffffff',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s ease',
  };

  return (
    <div style={overlayStyle} onClick={handleStay}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={iconRowStyle}>
          <AlertTriangle size={22} color="#0d9488" style={{ flexShrink: 0 }} />
          <h2 style={titleStyle}>Reload page?</h2>
        </div>

        <p style={bodyStyle}>
          Your current <span style={highlightStyle}>chat sessions</span> will be permanently
          cleared if you reload.
          <br /><br />
          Don't worry — your <span style={highlightStyle}>highlights and notes</span> are saved
          and will not be affected.
        </p>

        <div style={buttonRowStyle}>
          <button style={stayBtnStyle} onClick={handleStay} type="button">
            Stay
          </button>
          <button style={reloadBtnStyle} onClick={handleReload} type="button">
            Reload anyway
          </button>
        </div>
      </div>
    </div>
  );
};

ChatRefreshWarningModal.displayName = 'ChatRefreshWarningModal';
