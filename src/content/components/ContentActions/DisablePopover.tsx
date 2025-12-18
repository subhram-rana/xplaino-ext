// src/content/components/ContentActions/DisablePopover.tsx
import React, { useState, useCallback } from 'react';
import { Globe, Monitor } from 'lucide-react';

export interface DisablePopoverProps {
  /** Whether the popover is visible */
  visible: boolean;
  /** Callback after disable action is executed */
  onDisabled?: () => void;
}

/**
 * Extract domain from URL (same logic as content/index.ts)
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
 * Update extension settings in chrome.storage.local
 */
async function updateExtensionSettings(
  updates: { globalDisabled?: boolean; domainStatus?: { domain: string; status: string } }
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('extension_settings', (result) => {
      const settings = result.extension_settings || {
        globalDisabled: false,
        domainSettings: {},
      };

      if (updates.globalDisabled !== undefined) {
        settings.globalDisabled = updates.globalDisabled;
      }

      if (updates.domainStatus) {
        settings.domainSettings[updates.domainStatus.domain] = updates.domainStatus.status;
      }

      chrome.storage.local.set({ extension_settings: settings }, () => {
        resolve();
      });
    });
  });
}

export const DisablePopover: React.FC<DisablePopoverProps> = ({
  visible,
  onDisabled,
}) => {
  const [currentDomain] = useState(() => extractDomain(window.location.href));

  const handleDisableGlobally = useCallback(async () => {
    await updateExtensionSettings({ globalDisabled: true });
    console.log('[ContentActions] Disabled globally');
    onDisabled?.();
  }, [onDisabled]);

  const handleDisableOnSite = useCallback(async () => {
    if (!currentDomain) return;
    await updateExtensionSettings({
      domainStatus: { domain: currentDomain, status: 'DISABLED' },
    });
    console.log('[ContentActions] Disabled on:', currentDomain);
    onDisabled?.();
  }, [currentDomain, onDisabled]);

  if (!visible) return null;

  return (
    <div className="disablePopover">
      <button
        className="disablePopoverOption"
        onClick={handleDisableGlobally}
      >
        <Globe size={14} strokeWidth={2.5} />
        <span>Disable globally</span>
      </button>
      <button
        className="disablePopoverOption"
        onClick={handleDisableOnSite}
      >
        <Monitor size={14} strokeWidth={2.5} />
        <span>Disable on this site</span>
      </button>
    </div>
  );
};

DisablePopover.displayName = 'DisablePopover';

