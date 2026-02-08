// src/background/index.ts
// Chrome extension background service worker

import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { ApiService } from '@/api-services/ApiService';
import { extractDomain } from '@/utils/domain';
import { DomainStatus } from '@/types/domain';
import { ENV } from '@/config/env';

// This file serves as the entry point for the background script
// Add background logic here (message handling, alarms, etc.)

console.log('Background service worker initialized');

// Redirect to feedback page when user uninstalls the extension
const version = chrome.runtime.getManifest().version;
chrome.runtime.setUninstallURL(
  `${ENV.XPLAINO_WEBSITE_BASE_URL}/uninstall-extension-feedback?version=${version}`
);

/**
 * Sync domain status with API
 * Checks current tab domain against API and updates Chrome storage accordingly
 */
async function syncDomainStatus(): Promise<void> {
  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tabs.length === 0 || !tabs[0].url) {
      console.log('No active tab or URL found');
      return;
    }

    const tabUrl = tabs[0].url;

    console.log('Tab URL:', tabUrl);

    // Handle chrome://, chrome-extension://, and other special URLs as INVALID
    if (
      tabUrl.startsWith('chrome://') ||
      tabUrl.startsWith('chrome-extension://') ||
      tabUrl.startsWith('edge://') ||
      tabUrl.startsWith('about:')
    ) {
      console.log('Special URL detected, setting INVALID:', tabUrl);
      const specialDomain = extractDomain(tabUrl) || 'special-url';
      await ChromeStorage.setDomainStatus(specialDomain, DomainStatus.INVALID);
      return;
    }

    // Extract domain from URL
    const currentDomain = extractDomain(tabUrl);
    console.log('Current domain:', currentDomain);

    // Get all domains from API
    let apiDomains: Array<{ url: string; status: 'ALLOWED' | 'BANNED' }> = [];
    try {
      const response = await ApiService.getAllDomains();
      apiDomains = response.domains.map((d) => ({
        url: d.url.toLowerCase(),
        status: d.status,
      }));
      console.log('Fetched domains from API:', apiDomains.length);
    } catch (error) {
      console.error('Failed to fetch domains from API:', error);
      // On API failure, don't update storage - keep existing state
      return;
    }

    // Check if current domain exists in API response
    const apiDomain = apiDomains.find(
      (d) => d.url.toLowerCase() === currentDomain.toLowerCase()
    );

    // Get current domain status from storage
    const currentDomainStatus = await ChromeStorage.getDomainStatus(
      currentDomain
    );

    if (!apiDomain) {
      // Domain NOT in API response
      if (!currentDomainStatus) {
        // Domain not in storage - create with ENABLED
        await ChromeStorage.setDomainStatus(currentDomain, DomainStatus.ENABLED);
        console.log('Created domain in storage as ENABLED:', currentDomain);
      } else if (currentDomainStatus === DomainStatus.BANNED) {
        // Domain in storage but BANNED - reset to ENABLED
        await ChromeStorage.setDomainStatus(currentDomain, DomainStatus.ENABLED);
        console.log('Domain was BANNED, reset to ENABLED:', currentDomain);
      } else {
        // Domain already in storage with ENABLED/DISABLED - do nothing
        console.log('Domain already in storage, no change needed');
      }
    } else {
      // Domain exists in API response
      if (apiDomain.status === 'BANNED') {
        // API says BANNED - always update/create as BANNED
        await ChromeStorage.setDomainStatus(
          currentDomain,
          DomainStatus.BANNED
        );
        console.log('Updated domain status to BANNED:', currentDomain);
      } else if (apiDomain.status === 'ALLOWED') {
        // API says ALLOWED
        if (!currentDomainStatus) {
          // Domain not in storage - create with ENABLED
          await ChromeStorage.setDomainStatus(
            currentDomain,
            DomainStatus.ENABLED
          );
          console.log('Created domain in storage as ENABLED:', currentDomain);
        } else if (currentDomainStatus === DomainStatus.BANNED) {
          // Domain was BANNED locally but API says ALLOWED - reset to ENABLED
          await ChromeStorage.setDomainStatus(
            currentDomain,
            DomainStatus.ENABLED
          );
          console.log('Reset domain from BANNED to ENABLED:', currentDomain);
        } else {
          // Domain in storage with ENABLED or DISABLED - keep local value
          console.log(
            'Domain in storage, keeping local value:',
            currentDomainStatus
          );
        }
      }
    }
  } catch (error) {
    console.error('Error syncing domain status:', error);
  }
}

// Initialize on extension load
syncDomainStatus();

// Listen for tab URL changes
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  // Only process when URL changes and tab is complete
  if (changeInfo.status === 'complete' && tab.url) {
    syncDomainStatus();
  }
});

/**
 * Extract ID token from redirect URL
 */
function extractIdTokenFromUrl(url: string): string | null {
  try {
    const hashParams = new URLSearchParams(url.split('#')[1]);
    return hashParams.get('id_token');
  } catch {
    return null;
  }
}

/**
 * Convert blob to base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

// Message listener for handling OAuth flow and image fetching
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle image fetch from content script (bypasses CORS)
  if (message.type === 'FETCH_IMAGE') {
    const { imageUrl } = message;
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      sendResponse({ success: false, error: 'Invalid image URL' });
      return true;
    }

    console.log('[Background] Fetching image:', imageUrl);

    fetch(imageUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.blob();
      })
      .then((blob) => blobToBase64(blob).then((base64) => ({ base64, mimeType: blob.type })))
      .then(({ base64, mimeType }) => {
        console.log('[Background] Image fetched successfully, mimeType:', mimeType);
        sendResponse({
          success: true,
          base64,
          mimeType: mimeType || 'image/png',
        });
      })
      .catch((error) => {
        console.error('[Background] Failed to fetch image:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  // Handle Google OAuth login from content script
  if (message.type === 'GOOGLE_LOGIN') {
    const authUrl = message.authUrl;

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error('[Background] Chrome identity error:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message || 'Authentication failed' });
          return;
        }

        if (!redirectUrl) {
          sendResponse({ error: 'No redirect URL received' });
          return;
        }

        const idToken = extractIdTokenFromUrl(redirectUrl);
        if (!idToken) {
          sendResponse({ error: 'Failed to extract ID token from response' });
          return;
        }

        sendResponse({ idToken });
      }
    );

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  // Handle request to inject the Translator bridge into the page's main world
  if (message.type === 'INJECT_TRANSLATOR_BRIDGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return true;
    }

    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN' as any, // inject into the page's JS context
        files: ['src/content/utils/chromeTranslatorBridge.js'],
      })
      .then(() => {
        console.log('[Background] Translator bridge injected into tab', tabId);
        sendResponse({ success: true });
      })
      .catch((err) => {
        console.error('[Background] Failed to inject translator bridge:', err);
        sendResponse({ success: false, error: String(err) });
      });

    return true; // async response
  }

  // Handle other messages
  console.log('Message received:', message);
  sendResponse({ status: 'ok' });
  return true;
});

export {};

