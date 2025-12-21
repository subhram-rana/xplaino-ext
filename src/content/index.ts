// src/content/index.ts
// Chrome extension content script - Minimal orchestration layer

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createStore, Provider } from 'jotai';

// Import components
import { FAB } from './components/FAB';
import { SidePanel } from './components/SidePanel';
import { ContentActionsTrigger } from './components/ContentActions';
import { DisableNotificationModal } from './components/DisableNotificationModal';
import { LoginModal } from './components/LoginModal';

// Import Shadow DOM utilities
import {
  createShadowHost,
  injectStyles,
  removeShadowHost,
  shadowHostExists,
} from './utils/shadowDom';

// Import Shadow DOM styles as inline strings
import fabStyles from './styles/fab.shadow.css?inline';
import sidePanelStyles from './styles/sidePanel.shadow.css?inline';
import contentActionsStyles from './styles/contentActions.shadow.css?inline';
import disableNotificationModalStyles from './styles/disableNotificationModal.shadow.css?inline';
import loginModalStyles from './styles/loginModal.shadow.css?inline';

// Import color CSS variables
import { FAB_COLOR_VARIABLES } from '../constants/colors.css.js';

// Import services and utilities
import { SummariseService } from '../api-services/SummariseService';
import { extractAndStorePageContent, getStoredPageContent } from './utils/pageContentExtractor';
import {
  summariseStateAtom,
  streamingTextAtom,
  summaryAtom,
  summaryErrorAtom,
  messageQuestionsAtom,
  pageReadingStateAtom,
} from '../store/summaryAtoms';
import { showLoginModalAtom } from '../store/uiAtoms';

console.log('[Content Script] Initialized');

// =============================================================================
// CONSTANTS
// =============================================================================

const FAB_HOST_ID = 'xplaino-fab-host';
const SIDE_PANEL_HOST_ID = 'xplaino-side-panel-host';
const CONTENT_ACTIONS_HOST_ID = 'xplaino-content-actions-host';
const DISABLE_MODAL_HOST_ID = 'xplaino-disable-modal-host';
const LOGIN_MODAL_HOST_ID = 'xplaino-login-modal-host';

/**
 * Domain status enum (must match src/types/domain.ts)
 */
enum DomainStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  BANNED = 'BANNED',
  INVALID = 'INVALID',
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// React root references
let fabRoot: ReactDOM.Root | null = null;
let sidePanelRoot: ReactDOM.Root | null = null;
let contentActionsRoot: ReactDOM.Root | null = null;
let disableModalRoot: ReactDOM.Root | null = null;
let loginModalRoot: ReactDOM.Root | null = null;

// Modal state
let modalVisible = false;

// Shared state for side panel
let sidePanelOpen = false;

// Jotai store for managing atoms outside React
const store = createStore();

// FAB loading state
let isSummarising = false;
let summariseAbortController: AbortController | null = null;
let firstChunkReceived = false;
let canHideFABActions = true;

/**
 * Toggle side panel open/closed state
 */
function setSidePanelOpen(open: boolean, initialTab?: 'summary' | 'settings' | 'my'): void {
  sidePanelOpen = open;
  updateSidePanel(initialTab);
}

// =============================================================================
// DOMAIN UTILITIES
// =============================================================================

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Check if extension is allowed to run on current page
 */
async function isExtensionAllowed(): Promise<boolean> {
  try {
    const currentDomain = extractDomain(window.location.href);
    
    if (!currentDomain) {
      console.log('[Content Script] Could not extract domain');
      return false;
    }

    // Get settings from chrome.storage.local
    const result = await chrome.storage.local.get('extension_settings');
    const settings = result.extension_settings || {
      globalDisabled: false,
      domainSettings: {},
    };

    // Check if globally disabled
    if (settings.globalDisabled) {
      console.log('[Content Script] Extension is globally disabled');
      return false;
    }

    // Check domain status
    const domainStatus = settings.domainSettings[currentDomain];
    
    if (domainStatus !== DomainStatus.ENABLED) {
      console.log(`[Content Script] Domain "${currentDomain}" is not ENABLED (status: ${domainStatus || 'not set'})`);
      return false;
    }

    console.log(`[Content Script] Extension allowed for domain: ${currentDomain}`);
    return true;
  } catch (error) {
    console.error('[Content Script] Error checking permissions:', error);
    return false;
  }
}

// =============================================================================
// FAB INJECTION
// =============================================================================

/**
 * Inject FAB into the page with Shadow DOM
 */
function injectFAB(): void {
  // Check if already injected
  if (shadowHostExists(FAB_HOST_ID)) {
    console.log('[Content Script] FAB already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: FAB_HOST_ID,
    zIndex: 2147483645,
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, fabStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  fabRoot = ReactDOM.createRoot(mountPoint);
  updateFAB();

  console.log('[Content Script] FAB injected successfully');
}

/**
 * Remove FAB from the page
 */
function removeFAB(): void {
  removeShadowHost(FAB_HOST_ID, fabRoot);
  fabRoot = null;
  console.log('[Content Script] FAB removed');
  removeSidePanel();
}

// =============================================================================
// SIDE PANEL INJECTION
// =============================================================================

/**
 * Handle summarise button click
 */
async function handleSummariseClick(): Promise<void> {
  console.log('[Content Script] Summarise clicked from FAB');
  
  // Check if summary already exists
  const existingSummary = store.get(summaryAtom);
  const hasSummary = !!existingSummary && existingSummary.trim().length > 0;
  
  // If summary exists, just open the side panel
  if (hasSummary) {
    console.log('[Content Script] Summary exists, opening side panel');
    setSidePanelOpen(true, 'summary');
    return;
  }
  
  // If already summarising, abort and reset
  if (isSummarising && summariseAbortController) {
    summariseAbortController.abort();
    summariseAbortController = null;
    isSummarising = false;
    firstChunkReceived = false;
    canHideFABActions = true;
    store.set(summariseStateAtom, 'idle');
    updateFAB();
    return;
  }

  // Set loading state
  isSummarising = true;
  firstChunkReceived = false;
  canHideFABActions = false; // Prevent hiding actions during loading
  store.set(summariseStateAtom, 'summarising');
  store.set(streamingTextAtom, '');
  store.set(summaryAtom, '');
  store.set(summaryErrorAtom, '');
  store.set(messageQuestionsAtom, {});
  updateFAB();

  try {
    // Extract page content if not already available
    let pageContent = await getStoredPageContent();
    if (!pageContent) {
      console.log('[Content Script] Extracting page content...');
      store.set(pageReadingStateAtom, 'reading');
      pageContent = await extractAndStorePageContent();
      if (!pageContent) {
        throw new Error('Could not extract page content');
      }
      store.set(pageReadingStateAtom, 'ready');
    }

    // Create abort controller
    summariseAbortController = new AbortController();

    // Call summarise API
    await SummariseService.summarise(
      {
        text: pageContent,
        context_type: 'PAGE',
      },
      {
        onChunk: (_chunk, accumulated) => {
          // Update streaming text first
          store.set(streamingTextAtom, accumulated);
          
          // On first chunk, open side panel with summary tab and allow FAB actions to hide
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            canHideFABActions = true; // Allow actions to hide after first event
            isSummarising = false; // Stop showing spinner, revert to icon
            console.log('[Content Script] First chunk received, opening side panel');
            setSidePanelOpen(true, 'summary');
            // Update FAB after setting streaming text so hasSummary will be true
            updateFAB(); // Update FAB to reflect changes (spinner -> icon, canHideActions, hasSummary)
          }
        },
        onComplete: (finalSummary, questions) => {
          console.log('[Content Script] Summarise complete');
          store.set(summaryAtom, finalSummary);
          store.set(streamingTextAtom, '');
          store.set(summariseStateAtom, 'done');
          
          // Store questions for summary (use -1 as key for summary)
          if (questions.length > 0) {
            const currentQuestions = store.get(messageQuestionsAtom);
            store.set(messageQuestionsAtom, {
              ...currentQuestions,
              [-1]: questions,
            });
          }
          
          // Reset loading state
          isSummarising = false;
          summariseAbortController = null;
          firstChunkReceived = false;
          canHideFABActions = true;
          updateFAB();
        },
        onError: (errorCode, errorMsg) => {
          console.error('[Content Script] Summarise error:', errorCode, errorMsg);
          store.set(summariseStateAtom, 'error');
          store.set(summaryErrorAtom, errorMsg);
          
          // Reset loading state
          isSummarising = false;
          summariseAbortController = null;
          firstChunkReceived = false;
          canHideFABActions = true;
          updateFAB();
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for summarise');
          store.set(summariseStateAtom, 'idle');
          store.set(showLoginModalAtom, true);
          
          // Reset loading state
          isSummarising = false;
          summariseAbortController = null;
          firstChunkReceived = false;
          canHideFABActions = true;
          updateFAB();
        },
      },
      summariseAbortController
    );
  } catch (error) {
    console.error('[Content Script] Summarise exception:', error);
    store.set(summariseStateAtom, 'error');
    store.set(summaryErrorAtom, error instanceof Error ? error.message : 'An error occurred while summarising');
    
    // Reset loading state
    isSummarising = false;
    summariseAbortController = null;
    firstChunkReceived = false;
    canHideFABActions = true;
    updateFAB();
  }
}

/**
 * Update FAB state
 */
function updateFAB(): void {
  if (fabRoot) {
    // Check if summary exists (either in summaryAtom or streamingTextAtom)
    const summary = store.get(summaryAtom);
    const streamingText = store.get(streamingTextAtom);
    const hasSummary = (!!summary && summary.trim().length > 0) || (!!streamingText && streamingText.trim().length > 0);
    
    fabRoot.render(
      React.createElement(Provider, { store },
        React.createElement(FAB, {
          useShadowDom: true,
          onSummarise: handleSummariseClick,
          onTranslate: () => console.log('[FAB] Translate clicked'),
          onOptions: () => setSidePanelOpen(true),
          isSummarising: isSummarising,
          hasSummary: hasSummary,
          canHideActions: canHideFABActions,
        })
      )
    );
  }
}

/**
 * Update side panel state
 */
function updateSidePanel(initialTab?: 'summary' | 'settings' | 'my'): void {
  if (sidePanelRoot) {
    sidePanelRoot.render(
      React.createElement(Provider, { store },
        React.createElement(SidePanel, {
          isOpen: sidePanelOpen,
          useShadowDom: true,
          onClose: () => setSidePanelOpen(false),
          initialTab: initialTab,
        })
      )
    );
  }
  // Also update FAB to reflect side panel state
  updateFAB();
}

/**
 * Inject Side Panel into the page with Shadow DOM
 */
function injectSidePanel(): void {
  // Check if already injected
  if (shadowHostExists(SIDE_PANEL_HOST_ID)) {
    updateSidePanel();
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: SIDE_PANEL_HOST_ID,
    zIndex: 2147483646,
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, sidePanelStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  sidePanelRoot = ReactDOM.createRoot(mountPoint);
  sidePanelRoot.render(
    React.createElement(Provider, { store },
      React.createElement(SidePanel, {
        isOpen: sidePanelOpen,
        useShadowDom: true,
        onClose: () => setSidePanelOpen(false),
        initialTab: 'summary',
      })
    )
  );

  console.log('[Content Script] Side Panel injected successfully');
}

/**
 * Remove Side Panel from the page
 */
function removeSidePanel(): void {
  removeShadowHost(SIDE_PANEL_HOST_ID, sidePanelRoot);
  sidePanelRoot = null;
  console.log('[Content Script] Side Panel removed');
}

// =============================================================================
// CONTENT ACTIONS INJECTION
// =============================================================================

/**
 * Inject Content Actions into the page with Shadow DOM
 */
function injectContentActions(): void {
  // Check if already injected
  if (shadowHostExists(CONTENT_ACTIONS_HOST_ID)) {
    console.log('[Content Script] Content Actions already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: CONTENT_ACTIONS_HOST_ID,
    zIndex: 2147483647, // Highest z-index for selection popup
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, contentActionsStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  contentActionsRoot = ReactDOM.createRoot(mountPoint);
  contentActionsRoot.render(
    React.createElement(ContentActionsTrigger, {
      useShadowDom: true,
      onExplain: (text: string) => console.log('[ContentActions] Explain:', text),
      onGrammar: (text: string) => console.log('[ContentActions] Grammar:', text),
      onTranslate: (text: string) => console.log('[ContentActions] Translate:', text),
      onBookmark: (text: string) => console.log('[ContentActions] Bookmark:', text),
      onShowModal: showDisableModal,
    })
  );

  console.log('[Content Script] Content Actions injected successfully');
}

/**
 * Remove Content Actions from the page
 */
function removeContentActions(): void {
  removeShadowHost(CONTENT_ACTIONS_HOST_ID, contentActionsRoot);
  contentActionsRoot = null;
  console.log('[Content Script] Content Actions removed');
}

// =============================================================================
// DISABLE NOTIFICATION MODAL INJECTION
// =============================================================================

/**
 * Inject Disable Notification Modal into the page with Shadow DOM
 */
function injectDisableModal(): void {
  // Check if already injected
  if (shadowHostExists(DISABLE_MODAL_HOST_ID)) {
    console.log('[Content Script] Disable Modal already injected');
    updateDisableModal();
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: DISABLE_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, disableNotificationModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  disableModalRoot = ReactDOM.createRoot(mountPoint);
  updateDisableModal();

  console.log('[Content Script] Disable Modal injected successfully');
}

/**
 * Update modal visibility based on state
 */
async function updateDisableModal(): Promise<void> {
  if (!disableModalRoot) return;

  // Check if modal should be shown (not dismissed)
  const { ChromeStorage } = await import('../storage/chrome-local/ChromeStorage');
  const dismissed = await ChromeStorage.getDisableModalDismissed();

  disableModalRoot.render(
    React.createElement(DisableNotificationModal, {
      visible: modalVisible && !dismissed,
      onUnderstood: handleModalUnderstood,
      onDontShowAgain: handleModalDontShowAgain,
    })
  );
}

/**
 * Show the disable notification modal
 */
export function showDisableModal(): void {
  modalVisible = true;
  injectDisableModal();
}

/**
 * Hide the disable notification modal
 */
function hideDisableModal(): void {
  modalVisible = false;
  updateDisableModal();
}

/**
 * Handle "I understood" button click
 */
function handleModalUnderstood(): void {
  hideDisableModal();
}

/**
 * Handle "Don't show me again" button click
 */
async function handleModalDontShowAgain(): Promise<void> {
  const { ChromeStorage } = await import('../storage/chrome-local/ChromeStorage');
  await ChromeStorage.setDisableModalDismissed(true);
  hideDisableModal();
}

// =============================================================================
// LOGIN MODAL INJECTION
// =============================================================================

/**
 * Inject Login Modal into the page with Shadow DOM
 */
function injectLoginModal(): void {
  // Check if already injected
  if (shadowHostExists(LOGIN_MODAL_HOST_ID)) {
    console.log('[Content Script] Login Modal already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: LOGIN_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index for modal
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, loginModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  loginModalRoot = ReactDOM.createRoot(mountPoint);
  loginModalRoot.render(
    React.createElement(Provider, { store },
      React.createElement(LoginModal, {
        useShadowDom: true,
      })
    )
  );

  console.log('[Content Script] Login Modal injected successfully');
}

/**
 * Remove Login Modal from the page
 */
function removeLoginModal(): void {
  removeShadowHost(LOGIN_MODAL_HOST_ID, loginModalRoot);
  loginModalRoot = null;
  console.log('[Content Script] Login Modal removed');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Main content script logic
 */
async function initContentScript(): Promise<void> {
  const allowed = await isExtensionAllowed();
  
  if (allowed) {
    console.log('[Content Script] Running content script functionality...');
    injectFAB();
    injectSidePanel();
    injectContentActions();
    injectLoginModal();
  } else {
    console.log('[Content Script] Not running - extension not allowed on this page');
    removeFAB();
    removeSidePanel();
    removeContentActions();
    removeLoginModal();
  }
}

/**
 * Listen for storage changes to dynamically enable/disable
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.extension_settings) {
    console.log('[Content Script] Settings changed, re-checking permissions...');
    initContentScript();
  }
});

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

export {};
