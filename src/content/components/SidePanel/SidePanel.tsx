// src/content/components/SidePanel/SidePanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './SidePanel.module.css';

export interface SidePanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

type TabType = 'summary' | 'settings' | 'my';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  useShadowDom = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(DEFAULT_WIDTH);

  // Get class name based on context (Shadow DOM vs CSS Modules)
  const getClassName = useCallback((shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  }, [useShadowDom]);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    },
    [width]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = startXRef.current - e.clientX;
      let newWidth = startWidthRef.current + deltaX;

      // Clamp width
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Reset tab when panel closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('summary');
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  // Class names for Shadow DOM vs CSS Modules
  const sidePanelClass = getClassName(
    `sidePanel ${isOpen ? 'open' : ''}`,
    `${styles.sidePanel} ${isOpen ? styles.open : ''}`
  );
  const resizeHandlesClass = getClassName('resizeHandles', styles.resizeHandles);
  const resizeHandleTopLeftClass = getClassName('resizeHandleTopLeft', styles.resizeHandleTopLeft);
  const resizeHandleLeftClass = getClassName('resizeHandleLeft', styles.resizeHandleLeft);
  const resizeHandleBottomLeftClass = getClassName('resizeHandleBottomLeft', styles.resizeHandleBottomLeft);
  const headerClass = getClassName('header', styles.header);
  const headerBrandClass = getClassName('headerBrand', styles.headerBrand);
  const closeButtonClass = getClassName('closeButton', styles.closeButton);
  const contentClass = getClassName('content', styles.content);
  const footerClass = getClassName('footer', styles.footer);
  const tabGroupClass = getClassName('tabGroup', styles.tabGroup);

  return (
    <div
      ref={panelRef}
      className={sidePanelClass}
      style={{ width: `${width}px` }}
    >
      {/* Resize Handles */}
      <div className={resizeHandlesClass}>
        <div
          className={resizeHandleTopLeftClass}
          onMouseDown={handleResizeStart}
        />
        <div
          className={resizeHandleLeftClass}
          onMouseDown={handleResizeStart}
        />
        <div
          className={resizeHandleBottomLeftClass}
          onMouseDown={handleResizeStart}
        />
      </div>

      {/* Header */}
      <div className={headerClass}>
        <span className={headerBrandClass}>Xplaino</span>
        <button
          className={closeButtonClass}
          onClick={handleClose}
          aria-label="Close panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className={contentClass}>
        Content for {activeTab} tab
      </div>

      {/* Footer */}
      <div className={footerClass}>
        <div className={tabGroupClass}>
          <button
            className={getClassName(
              `tab ${activeTab === 'summary' ? 'active' : ''}`,
              `${styles.tab} ${activeTab === 'summary' ? styles.active : ''}`
            )}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={getClassName(
              `tab ${activeTab === 'settings' ? 'active' : ''}`,
              `${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`
            )}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button
            className={getClassName(
              `tab ${activeTab === 'my' ? 'active' : ''}`,
              `${styles.tab} ${activeTab === 'my' ? styles.active : ''}`
            )}
            onClick={() => setActiveTab('my')}
          >
            My
          </button>
        </div>
      </div>
    </div>
  );
};

SidePanel.displayName = 'SidePanel';
