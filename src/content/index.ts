// src/content/index.ts
// Chrome extension content script

import React from 'react';
import ReactDOM from 'react-dom/client';

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
 * FAB Styles - inlined for Shadow DOM
 */
const FAB_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  .fabParent {
    position: fixed;
    top: 120px;
    right: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    z-index: 2147483647;
    padding: 8px;
    padding-right: 0;
    transform: translateX(calc(100% - 60px));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .fabParent.actionsVisible {
    transform: translateX(0);
  }

  .fabContainer {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .fabButton {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #9527F5;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(149, 39, 245, 0.35);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    outline: none;
    position: relative;
    overflow: hidden;
  }

  .fabButton:hover {
    background: #8607f5;
    box-shadow: 0 6px 20px rgba(149, 39, 245, 0.5);
    transform: scale(1.05);
  }

  .fabButton:active {
    transform: scale(0.98);
  }

  .fabButton svg {
    width: 32px;
    height: 32px;
    pointer-events: none;
  }

  .actionsContainer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    opacity: 0;
    visibility: hidden;
    transform: translateX(20px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .actionsContainer.visible {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
  }

  .actionButton {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #9527F5;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(149, 39, 245, 0.35);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    outline: none;
    position: relative;
  }

  .actionButton:hover {
    background: #8607f5;
    box-shadow: 0 6px 20px rgba(149, 39, 245, 0.5);
    transform: scale(1.1);
  }

  .actionButton:active {
    transform: scale(0.95);
  }

  .actionButton svg {
    width: 22px;
    height: 22px;
    color: #FFFFFF;
    stroke: #FFFFFF;
    fill: none;
    pointer-events: none;
  }

  .actionButton::before {
    content: attr(data-tooltip);
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: #9527F5;
    color: #FFFFFF;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .actionButton:hover::before {
    opacity: 1;
    visibility: visible;
  }

  .actionsContainer.visible .actionButton:nth-child(1) {
    animation: slideIn 0.3s ease forwards;
    animation-delay: 0s;
  }

  .actionsContainer.visible .actionButton:nth-child(2) {
    animation: slideIn 0.3s ease forwards;
    animation-delay: 0.05s;
  }

  .actionsContainer.visible .actionButton:nth-child(3) {
    animation: slideIn 0.3s ease forwards;
    animation-delay: 0.1s;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(10px) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(149, 39, 245, 0.5);
    }
    70% {
      box-shadow: 0 0 0 12px rgba(149, 39, 245, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(149, 39, 245, 0);
    }
  }

  .fabButton.pulse {
    animation: pulse 2s ease-in-out 3;
  }
`;

/**
 * FAB Component for content script (inline version)
 */
const FABComponent: React.FC = () => {
  const [actionsVisible, setActionsVisible] = React.useState(false);
  const [showPulse, setShowPulse] = React.useState(true);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = React.useRef(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  const clearHideTimeout = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleFabMouseEnter = React.useCallback(() => {
    clearHideTimeout();
    isHoveringRef.current = true;
    setActionsVisible(true);
  }, [clearHideTimeout]);

  const handleParentMouseEnter = React.useCallback(() => {
    clearHideTimeout();
    isHoveringRef.current = true;
  }, [clearHideTimeout]);

  const handleParentMouseLeave = React.useCallback(() => {
    isHoveringRef.current = false;
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setActionsVisible(false);
      }
    }, 300);
  }, [clearHideTimeout]);

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleSummarise = () => console.log('[FAB] Summarise clicked');
  const handleTranslate = () => console.log('[FAB] Translate clicked');
  const handleOptions = () => console.log('[FAB] Options clicked');

  // Xplaino logo SVG (white version)
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="638" height="636" viewBox="0 0 638 636">
    <path d="M 299.14 509.99 C293.45,510.55 287.37,510.92 285.64,510.82 C275.14,510.22 271.61,509.83 263.69,508.43 C193.33,496.00 158.82,429.87 183.61,355.00 C187.81,342.32 197.87,321.43 205.04,310.50 C230.61,271.50 269.89,239.57 312.10,223.46 C322.97,219.31 342.81,214.37 353.97,213.02 C368.76,211.24 395.00,212.02 395.00,214.24 C395.00,214.81 392.87,214.93 389.75,214.54 C386.86,214.17 379.80,213.65 374.06,213.37 C365.62,212.96 362.91,213.19 359.88,214.56 C357.49,215.63 355.13,216.00 353.42,215.57 C350.97,214.96 347.95,215.41 337.00,218.02 C335.08,218.48 330.80,219.42 327.50,220.11 C320.39,221.60 313.77,224.25 310.26,227.01 C308.87,228.10 307.03,229.00 306.18,229.00 C305.33,229.00 302.58,229.95 300.07,231.11 C289.72,235.90 284.49,238.57 283.27,239.68 C282.57,240.34 281.09,241.15 279.99,241.50 C278.90,241.85 278.00,242.46 278.00,242.86 C278.00,243.26 274.80,245.11 270.89,246.98 C266.98,248.85 262.87,251.61 261.76,253.11 C260.65,254.62 258.72,256.10 257.49,256.41 C256.25,256.72 255.00,257.89 254.71,259.00 C254.42,260.12 252.67,261.66 250.83,262.43 C248.99,263.20 245.82,265.62 243.79,267.81 C241.77,270.00 239.61,271.96 239.00,272.17 C238.39,272.37 237.78,273.30 237.64,274.24 C237.36,276.13 236.31,277.43 234.92,277.62 C234.41,277.69 233.60,277.81 233.11,277.88 C232.62,277.94 231.96,279.01 231.64,280.25 C231.32,281.49 229.74,283.24 228.13,284.14 C226.52,285.05 223.96,287.97 222.42,290.64 C220.89,293.31 217.30,297.62 214.45,300.21 C211.46,302.93 209.02,306.10 208.68,307.71 C208.36,309.25 206.96,311.79 205.57,313.37 C204.19,314.95 202.80,317.05 202.49,318.03 C202.18,319.01 201.27,320.07 200.46,320.38 C199.66,320.68 199.00,321.89 199.00,323.06 C199.00,324.23 198.10,326.33 197.00,327.73 C195.90,329.13 195.00,330.90 195.00,331.67 C195.00,332.44 194.31,334.12 193.47,335.41 C192.62,336.70 191.76,338.59 191.55,339.63 C191.09,341.86 188.86,347.30 185.04,355.50 C181.91,362.23 181.34,364.93 179.43,381.78 C179.04,385.23 178.33,388.30 177.86,388.59 C176.35,389.52 176.87,415.01 178.51,420.41 C179.33,423.11 180.00,426.62 180.00,428.22 C180.00,431.71 182.67,440.26 185.16,444.74 C186.15,446.53 187.15,449.00 187.39,450.24 C187.98,453.36 192.78,461.69 195.64,464.55 C196.94,465.85 198.00,467.39 198.00,467.98 C198.00,468.57 199.12,469.48 200.50,470.00 C201.88,470.52 203.00,471.58 203.00,472.36 C203.00,473.14 204.12,474.51 205.49,475.40 C206.87,476.30 207.88,477.52 207.74,478.11 C207.61,478.70 208.39,479.71 209.48,480.34 C210.58,480.98 212.06,482.29 212.79,483.25 C213.52,484.21 214.59,485.00 215.17,485.00 C215.76,485.00 217.77,486.35 219.65,488.00 C221.53,489.65 224.18,491.00 225.53,491.00 C226.93,491.00 228.52,491.88 229.24,493.05 C231.22,496.28 250.24,504.31 260.00,506.04 C262.48,506.48 267.20,507.30 270.50,507.87 C277.67,509.10 304.06,508.54 308.99,507.05 C310.91,506.47 314.30,506.00 316.51,506.00 C318.72,506.00 322.10,505.17 324.01,504.15 C325.93,503.13 329.30,501.96 331.50,501.56 C333.70,501.15 335.95,500.47 336.50,500.04 C337.47,499.27 340.83,498.49 348.00,497.35 C349.92,497.04 352.49,495.75 353.71,494.48 C354.92,493.22 357.28,491.88 358.95,491.51 C360.61,491.15 362.23,490.43 362.55,489.92 C362.86,489.42 363.90,489.00 364.85,489.00 C365.80,489.00 368.13,487.67 370.04,486.04 C371.94,484.41 374.29,483.06 375.25,483.04 C376.21,483.02 377.90,482.10 379.00,481.00 C380.10,479.90 381.85,479.00 382.89,479.00 C383.93,479.00 385.05,478.33 385.36,477.50 C385.68,476.67 386.74,475.99 387.72,475.99 C388.70,475.98 392.65,473.52 396.50,470.51 C400.35,467.51 404.77,464.08 406.33,462.88 C407.88,461.69 409.56,459.66 410.05,458.36 C410.65,456.78 411.75,456.00 413.36,456.00 C414.89,456.00 416.68,454.82 418.28,452.75 C419.67,450.96 424.79,445.36 429.65,440.30 C438.56,431.03 440.47,428.84 445.97,421.50 C447.62,419.30 449.43,416.96 449.99,416.29 C450.54,415.63 451.00,414.33 451.00,413.40 C451.00,412.47 451.92,410.76 453.04,409.61 C458.16,404.32 460.00,401.51 460.00,398.96 C460.00,397.45 460.63,395.97 461.39,395.68 C462.16,395.39 463.97,392.75 465.41,389.82 C466.86,386.90 468.43,383.83 468.90,383.00 C469.38,382.17 470.35,380.26 471.05,378.75 C471.76,377.24 472.70,376.00 473.13,376.00 C474.14,376.00 471.22,382.94 465.38,394.48 C446.93,430.87 413.54,464.95 375.50,486.18 C352.23,499.17 325.87,507.39 299.14,509.99 Z" fill="#FFFFFF"/>
  </svg>`;

  return React.createElement('div', {
    className: `fabParent ${actionsVisible ? 'actionsVisible' : ''}`,
    onMouseEnter: handleParentMouseEnter,
    onMouseLeave: handleParentMouseLeave,
  }, [
    // Actions Container
    React.createElement('div', {
      key: 'actions',
      className: `actionsContainer ${actionsVisible ? 'visible' : ''}`,
    }, [
      // Summarise Button
      React.createElement('button', {
        key: 'summarise',
        className: 'actionButton',
        onClick: handleSummarise,
        'data-tooltip': 'Summarise Page',
        'aria-label': 'Summarise Page',
      }, React.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }, [
        React.createElement('path', { key: '1', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        React.createElement('polyline', { key: '2', points: '14 2 14 8 20 8' }),
        React.createElement('line', { key: '3', x1: '16', y1: '13', x2: '8', y2: '13' }),
        React.createElement('line', { key: '4', x1: '16', y1: '17', x2: '8', y2: '17' }),
        React.createElement('polyline', { key: '5', points: '10 9 9 9 8 9' }),
      ])),
      // Translate Button
      React.createElement('button', {
        key: 'translate',
        className: 'actionButton',
        onClick: handleTranslate,
        'data-tooltip': 'Translate Page',
        'aria-label': 'Translate Page',
      }, React.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }, [
        React.createElement('circle', { key: '1', cx: '12', cy: '12', r: '10' }),
        React.createElement('line', { key: '2', x1: '2', y1: '12', x2: '22', y2: '12' }),
        React.createElement('path', { key: '3', d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }),
      ])),
      // Options Button
      React.createElement('button', {
        key: 'options',
        className: 'actionButton',
        onClick: handleOptions,
        'data-tooltip': 'Options',
        'aria-label': 'Options',
      }, React.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }, [
        React.createElement('circle', { key: '1', cx: '12', cy: '12', r: '3' }),
        React.createElement('path', { key: '2', d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' }),
      ])),
    ]),
    // FAB Container
    React.createElement('div', {
      key: 'fab',
      className: 'fabContainer',
    }, React.createElement('button', {
      className: `fabButton ${showPulse ? 'pulse' : ''}`,
      onMouseEnter: handleFabMouseEnter,
      'aria-label': 'Xplaino Actions',
    }, React.createElement('div', {
      dangerouslySetInnerHTML: { __html: logoSvg },
      style: { 
        width: '32px', 
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }))),
  ]);
};

// Host element ID
const FAB_HOST_ID = 'xplaino-fab-host';

// React root reference
let fabRoot: ReactDOM.Root | null = null;

/**
 * Inject FAB into the page with Shadow DOM
 */
function injectFAB(): void {
  // Check if already injected
  if (document.getElementById(FAB_HOST_ID)) {
    console.log('[Content Script] FAB already injected');
    return;
  }

  // Create host element
  const host = document.createElement('div');
  host.id = FAB_HOST_ID;
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const styleElement = document.createElement('style');
  styleElement.textContent = FAB_STYLES;
  shadow.appendChild(styleElement);

  // Create React mount point
  const mountPoint = document.createElement('div');
  mountPoint.id = 'fab-root';
  shadow.appendChild(mountPoint);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  fabRoot = ReactDOM.createRoot(mountPoint);
  fabRoot.render(React.createElement(FABComponent));

  console.log('[Content Script] FAB injected successfully');
}

/**
 * Remove FAB from the page
 */
function removeFAB(): void {
  const host = document.getElementById(FAB_HOST_ID);
  if (host) {
    if (fabRoot) {
      fabRoot.unmount();
      fabRoot = null;
    }
    host.remove();
    console.log('[Content Script] FAB removed');
  }
}

/**
 * Main content script logic
 */
async function initContentScript(): Promise<void> {
  const allowed = await isExtensionAllowed();
  
  if (allowed) {
    console.log('[Content Script] Running content script functionality...');
    injectFAB();
  } else {
    console.log('[Content Script] Not running - extension not allowed on this page');
    removeFAB();
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
