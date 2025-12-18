// src/components/ui/Modal/Modal.tsx
import React from 'react';
import { X } from 'lucide-react';
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS, SHADOW } from '@/constants/styles';

interface ModalProps {
  /** Modal visibility */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.OVERLAY,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: COLORS.BACKGROUND_PRIMARY,
          borderRadius: BORDER_RADIUS.LARGE,
          padding: '24px',
          maxWidth: '90%',
          maxHeight: '90%',
          overflow: 'auto',
          boxShadow: SHADOW.XL,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || true) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            {title && (
              <h2
                style={{
                  color: COLORS.TEXT_PRIMARY,
                  fontSize: '20px',
                  fontWeight: 600,
                }}
              >
                {title}
              </h2>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={COLORS.TEXT_SECONDARY} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';

