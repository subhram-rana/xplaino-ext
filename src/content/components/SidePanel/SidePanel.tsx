// src/content/components/SidePanel/SidePanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import styles from './SidePanel.module.css';
import { Header } from './Header';
import { Footer } from './Footer';
import { SummaryView } from './SummaryView';
import { SettingsView } from './SettingsView';
import { MyView } from './MyView';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { showLoginModalAtom } from '@/store/uiAtoms';

export interface SidePanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Callback when login is required (401 error) */
  onLoginRequired?: () => void;
  /** Initial tab to show when panel opens */
  initialTab?: TabType;
}

type TabType = 'summary' | 'settings' | 'my';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  useShadowDom = false,
  onLoginRequired,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'summary');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isVerticallyExpanded, setIsVerticallyExpanded] = useState(false);
  const [isSlidingOut, setIsSlidingOut] = useState(false);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Jotai setter for login modal
  const setShowLoginModal = useSetAtom(showLoginModalAtom);

  // Handle login button click - show login modal
  const handleLoginClick = useCallback(() => {
    setShowLoginModal(true);
  }, [setShowLoginModal]);

  // Handle login required callback (from API errors)
  const handleLoginRequired = useCallback(() => {
    setShowLoginModal(true);
    onLoginRequired?.();
  }, [onLoginRequired, setShowLoginModal]);

  // Get class name based on context (Shadow DOM vs CSS Modules)
  const getClassName = useCallback((shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  }, [useShadowDom]);

  // Handle resize start - attach listeners directly for Shadow DOM compatibility
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const startX = e.clientX;
      const startWidth = width;
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Since panel is on the right, dragging left increases width
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
        setWidth(newWidth);
      };
      
      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [width]
  );

  // Load expanded state from storage on mount
  useEffect(() => {
    const loadExpandedState = async () => {
      const domain = window.location.hostname;
      const expanded = await ChromeStorage.getSidePanelExpanded(domain);
      setIsVerticallyExpanded(expanded);
      setExpandedLoaded(true);
    };
    loadExpandedState();
  }, []);

  // Save expanded state when it changes (after initial load)
  useEffect(() => {
    if (!expandedLoaded) return;
    const domain = window.location.hostname;
    ChromeStorage.setSidePanelExpanded(domain, isVerticallyExpanded);
  }, [isVerticallyExpanded, expandedLoaded]);

  // Reset tab and sliding state when panel closes (but keep expanded state)
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('summary');
      setIsSlidingOut(false);
    } else if (initialTab) {
      // Set initial tab when panel opens
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const handleSlideOut = useCallback(() => {
    setIsSlidingOut(true);
    setTimeout(() => {
      onClose?.();
    }, 300); // Match transition duration
  }, [onClose]);

  const handleVerticalExpand = useCallback(() => {
    setIsVerticallyExpanded((prev) => !prev);
  }, []);

  // Class names for Shadow DOM vs CSS Modules
  const sidePanelClass = getClassName(
    `sidePanel ${isOpen ? 'open' : ''} ${isSlidingOut ? 'slidingOut' : ''} ${isVerticallyExpanded ? 'verticallyExpanded' : ''}`,
    `${styles.sidePanel} ${isOpen ? styles.open : ''} ${isSlidingOut ? styles.slidingOut : ''} ${isVerticallyExpanded ? styles.verticallyExpanded : ''}`
  );
  const resizeHandleClass = getClassName('resizeHandle', styles.resizeHandle);
  const contentClass = getClassName('content', styles.content);

  return (
    <div
      ref={panelRef}
      className={sidePanelClass}
      style={{ '--panel-width': `${width}px` } as React.CSSProperties }
    >
      {/* Resize Handle */}
      <div
        className={resizeHandleClass}
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <Header
        onSlideOut={handleSlideOut}
        onVerticalExpand={handleVerticalExpand}
        onLogin={handleLoginClick}
        brandImageSrc={chrome.runtime.getURL('src/assets/photos/brand-name.png')}
        useShadowDom={useShadowDom}
        isExpanded={isVerticallyExpanded}
      />

      {/* Content */}
      <div className={contentClass}>
        {activeTab === 'summary' && (
          <SummaryView
            useShadowDom={useShadowDom}
            onLoginRequired={handleLoginRequired}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView useShadowDom={useShadowDom} />
        )}
        {activeTab === 'my' && (
          <MyView useShadowDom={useShadowDom} />
        )}
      </div>

      {/* Footer */}
      <Footer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        useShadowDom={useShadowDom}
      />
    </div>
  );
};

SidePanel.displayName = 'SidePanel';
