// src/content/components/SidePanel/SidePanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import styles from './SidePanel.module.css';
import { Header } from './Header';
import { UpgradeFooter } from '../BaseSidePanel/UpgradeFooter';
import { SummaryView } from './SummaryView';
import { SettingsView } from './SettingsView';
import { SaveLinkModal } from '../SaveLinkModal/SaveLinkModal';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { showLoginModalAtom, currentThemeAtom } from '@/store/uiAtoms';
import { summaryAtom, summariseStateAtom } from '@/store/summaryAtoms';
import { SavedLinkService } from '@/api-services/SavedLinkService';

// Reference link pattern: [[[ ref text ]]]
const REF_LINK_PATTERN = /\[\[\[\s*(.+?)\s*\]\]\]/g;

/**
 * Filter out reference links ([[[ text ]]]) from summary text
 */
function filterReferenceLinks(summary: string): string {
  return summary.replace(REF_LINK_PATTERN, '').trim();
}

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
  /** Callback to show toast message */
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
  /** Callback to show bookmark toast */
  onShowBookmarkToast?: (type: 'word' | 'paragraph' | 'link', urlPath: string) => void;
  /** Callback when bookmark is clicked (for folder selection) */
  onBookmark?: () => void;
  /** Initial saved link ID (from content script) */
  initialSavedLinkId?: string | null;
}

type TabType = 'summary' | 'settings';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  useShadowDom = false,
  onLoginRequired,
  initialTab,
  onShowToast,
  onShowBookmarkToast,
  onBookmark,
  initialSavedLinkId = null,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'summary');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isVerticallyExpanded, setIsVerticallyExpanded] = useState(false);
  const [isSlidingOut, setIsSlidingOut] = useState(false);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const [isSaveLinkModalOpen, setIsSaveLinkModalOpen] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [savedLinkId, setSavedLinkId] = useState<string | null>(initialSavedLinkId);
  const [brandImageUrl, setBrandImageUrl] = useState<string>('');
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Subscribe to theme changes
  const currentTheme = useAtomValue(currentThemeAtom);
  
  // Load theme-aware brand image when theme changes
  useEffect(() => {
    const imageName = currentTheme === 'dark' 
      ? 'brand-name-turquoise.png' 
      : 'brand-name.png';
    const imageUrl = chrome.runtime.getURL(`src/assets/photos/${imageName}`);
    setBrandImageUrl(imageUrl);
  }, [currentTheme]);

  // Update savedLinkId when initialSavedLinkId changes (from folder modal save)
  useEffect(() => {
    if (initialSavedLinkId !== null) {
      setSavedLinkId(initialSavedLinkId);
    }
  }, [initialSavedLinkId]);
  
  // Jotai setter for login modal
  const setShowLoginModal = useSetAtom(showLoginModalAtom);
  
  // Get summary state to determine bookmark visibility
  const summary = useAtomValue(summaryAtom);
  const summariseState = useAtomValue(summariseStateAtom);
  
  // Determine if bookmark should be shown
  const showBookmark = activeTab === 'summary' && summariseState === 'done' && summary.trim().length > 0;
  
  // Determine if bookmark is filled (saved)
  const isBookmarked = savedLinkId !== null;

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

  // Handle remove link
  const handleRemoveLink = useCallback(async () => {
    if (!savedLinkId) {
      onShowToast?.('No saved link to remove', 'error');
      return;
    }

    await SavedLinkService.removeSavedLink(
      savedLinkId,
      {
        onSuccess: () => {
          console.log('[SidePanel] Link removed successfully');
          setSavedLinkId(null); // Clear saved link ID
          onShowToast?.('Link removed successfully!', 'success');
        },
        onError: (errorCode, errorMessage) => {
          console.error('[SidePanel] Failed to remove link:', errorCode, errorMessage);
          let displayMessage = 'Failed to remove link';
          
          // Handle specific error codes with user-friendly messages
          if (errorCode === 'NOT_FOUND') {
            displayMessage = 'Link not found or already removed';
            // Clear saved link ID if link doesn't exist
            setSavedLinkId(null);
          } else if (errorCode === 'LOGIN_REQUIRED' || errorCode === 'AUTH_001' || errorCode === 'AUTH_002' || errorCode === 'AUTH_003') {
            displayMessage = 'Please login to remove links';
          } else if (errorCode === 'NETWORK_ERROR') {
            displayMessage = 'Network error. Please check your connection and try again.';
          } else if (errorCode === 'ABORTED') {
            displayMessage = 'Request was cancelled';
          } else if (errorCode === 'UNAUTHORIZED') {
            displayMessage = 'Unauthorized. Please login and try again.';
          } else if (errorMessage && errorMessage.trim().length > 0) {
            displayMessage = errorMessage;
          } else {
            displayMessage = `Failed to remove link (${errorCode})`;
          }
          
          onShowToast?.(displayMessage, 'error');
        },
        onLoginRequired: () => {
          console.log('[SidePanel] Login required for removing link');
          setShowLoginModal(true);
          onLoginRequired?.();
          onShowToast?.('Please login to remove links', 'error');
        },
        onSubscriptionRequired: () => {
          console.log('[SidePanel] Subscription required for removing link');
          onShowToast?.('Subscription required to remove links', 'error');
        },
      }
    );
  }, [savedLinkId, onShowToast, setShowLoginModal, onLoginRequired]);

  // Handle bookmark click - toggle between save and remove
  const handleBookmark = useCallback(() => {
    if (savedLinkId) {
      // If already saved, remove it
      handleRemoveLink();
    } else {
      // If not saved, call the onBookmark callback to show folder modal
      if (onBookmark) {
        onBookmark();
      } else {
        // Fallback to old behavior if callback not provided
        if (!summary || summary.trim().length === 0) {
          onShowToast?.('No summary available to save', 'error');
          return;
        }
        setIsSaveLinkModalOpen(true);
      }
    }
  }, [savedLinkId, summary, onShowToast, handleRemoveLink, onBookmark]);

  // Handle save from modal
  const handleSaveLink = useCallback(async (name: string) => {
    if (!summary || summary.trim().length === 0) {
      onShowToast?.('No summary available to save', 'error');
      setIsSaveLinkModalOpen(false);
      return;
    }

    setIsSavingLink(true);

    const currentUrl = window.location.href;
    const pageTitle = document.title || '';

    // Limit URL length to 1024 characters (API constraint)
    const urlToSave = currentUrl.length > 1024 ? currentUrl.substring(0, 1024) : currentUrl;
    
    // Use provided name or fall back to page title, limit to 50 characters (API constraint)
    const nameToSave = (name || pageTitle).length > 50 
      ? (name || pageTitle).substring(0, 50) 
      : (name || pageTitle);

    // Filter out reference links from summary
    const filteredSummary = filterReferenceLinks(summary);

    await SavedLinkService.saveLink(
      {
        url: urlToSave,
        summary: filteredSummary,
        name: nameToSave || undefined,
      },
      {
        onSuccess: (response) => {
          console.log('[SidePanel] Link saved successfully:', response);
          setIsSavingLink(false);
          setIsSaveLinkModalOpen(false);
          setSavedLinkId(response.id); // Store saved link ID
          onShowToast?.('Link saved successfully!', 'success');
          onShowBookmarkToast?.('link', '/user/saved-links');
        },
        onError: (errorCode, errorMessage) => {
          console.error('[SidePanel] Failed to save link:', errorCode, errorMessage);
          setIsSavingLink(false);
          let displayMessage = 'Failed to save link';
          
          // Handle specific error codes
          if (errorCode === 'VAL_001') {
            displayMessage = 'URL is too long';
          } else if (errorCode === 'VAL_002') {
            displayMessage = 'Name is too long';
          } else if (errorCode === 'NOT_FOUND') {
            displayMessage = 'Folder not found';
          } else if (errorCode === 'NETWORK_ERROR') {
            displayMessage = 'Network error. Please check your connection.';
          } else if (errorMessage) {
            displayMessage = errorMessage;
          }
          
          onShowToast?.(displayMessage, 'error');
        },
        onLoginRequired: () => {
          console.log('[SidePanel] Login required for saving link');
          setIsSavingLink(false);
          setIsSaveLinkModalOpen(false);
          setShowLoginModal(true);
          onLoginRequired?.();
        },
        onSubscriptionRequired: () => {
          console.log('[SidePanel] Subscription required for saving link');
          setIsSavingLink(false);
          setIsSaveLinkModalOpen(false);
          onShowToast?.('Subscription required to save links', 'error');
        },
      }
    );
  }, [summary, onShowToast, setShowLoginModal, onLoginRequired]);

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
        brandImageSrc={brandImageUrl}
        useShadowDom={useShadowDom}
        isExpanded={isVerticallyExpanded}
        activeTab={activeTab}
        onBookmark={handleBookmark}
        showBookmark={showBookmark}
        isBookmarked={isBookmarked}
      />

      {/* Content */}
      <div className={contentClass}>
        {activeTab === 'summary' && (
          <SummaryView
            useShadowDom={useShadowDom}
            onLoginRequired={handleLoginRequired}
            isOpen={isOpen}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView useShadowDom={useShadowDom} />
        )}
      </div>

      {/* Upgrade Footer */}
      <UpgradeFooter useShadowDom={useShadowDom} />

      {/* Save Link Modal */}
      <SaveLinkModal
        isOpen={isSaveLinkModalOpen}
        onClose={() => {
          if (!isSavingLink) {
            setIsSaveLinkModalOpen(false);
          }
        }}
        onSave={handleSaveLink}
        initialName={document.title || ''}
        useShadowDom={useShadowDom}
        isSaving={isSavingLink}
      />
    </div>
  );
};

SidePanel.displayName = 'SidePanel';
