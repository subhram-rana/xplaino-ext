// src/content/index.ts
// Chrome extension content script

// This file runs in the context of web pages

console.log('[Content Script] Initialized');

/**
 * Domain status enum (must match src/types/domain.ts)
 */
enum DomainStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  BANNED = 'BANNED',
  INVALID = 'INVALID',
}

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

/**
 * Main content script logic
 * This function contains all DOM manipulations and other content script functionality
 */
async function initContentScript(): Promise<void> {
  const allowed = await isExtensionAllowed();
  
  if (!allowed) {
    console.log('[Content Script] Not running - extension not allowed on this page');
    return;
  }

  console.log('[Content Script] Running content script functionality...');
  
  // =====================================================
  // ADD YOUR CONTENT SCRIPT LOGIC BELOW
  // This code only runs when:
  // 1. Extension is globally enabled
  // 2. Current domain status is ENABLED
  // =====================================================
  
  // Example: Add your DOM manipulation code here
  // document.body.style.border = '2px solid purple'; // Test line - remove in production
  
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

// Initialize content script
initContentScript();

export {};

