// src/content/utils/shadowDom.ts
// Utility functions for Shadow DOM operations in content scripts

import ReactDOM from 'react-dom/client';

export interface ShadowHostOptions {
  id: string;
  zIndex?: number;
}

export interface ShadowHostResult {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  mountPoint: HTMLDivElement;
}

/**
 * Creates a Shadow DOM host element with proper isolation.
 * The host is a zero-size fixed anchor with pointer-events disabled,
 * so it does not interfere with page layout. The shadow content inside
 * re-enables pointer-events so the extension UI remains interactive.
 * Using overflow: visible ensures the shadow content is never clipped,
 * even if the host page creates stacking contexts on <body>.
 */
export function createShadowHost(options: ShadowHostOptions): ShadowHostResult {
  const { id, zIndex = 2147483647 } = options;

  // Create host element — zero-size anchor that won't be clipped
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    `z-index: ${zIndex}`,
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    'overflow: visible',
    'pointer-events: none',
  ].join('; ') + ';';

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject base isolation styles so shadow content is interactive
  const baseStyle = document.createElement('style');
  baseStyle.textContent = `
    :host {
      pointer-events: none !important;
      overflow: visible !important;
    }
    #${CSS.escape(id)}-root {
      pointer-events: auto;
    }
  `;
  shadow.appendChild(baseStyle);

  // Create React mount point
  const mountPoint = document.createElement('div');
  mountPoint.id = `${id}-root`;
  shadow.appendChild(mountPoint);

  return { host, shadow, mountPoint };
}

/**
 * Injects CSS styles into a Shadow DOM
 * @param shadow - Shadow root to inject styles into
 * @param cssText - CSS text to inject
 * @param isColorVariables - Whether this is color variables CSS (for easier identification)
 */
export function injectStyles(shadow: ShadowRoot, cssText: string, isColorVariables: boolean = false): HTMLStyleElement {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssText;
  if (isColorVariables) {
    styleElement.setAttribute('data-xplaino-color-variables', 'true');
  }
  shadow.insertBefore(styleElement, shadow.firstChild);
  return styleElement;
}

/**
 * Creates and mounts a React root in a Shadow DOM
 */
export function createShadowRoot(
  mountPoint: HTMLDivElement
): ReactDOM.Root {
  return ReactDOM.createRoot(mountPoint);
}

/**
 * Removes a Shadow DOM host and cleans up React
 */
export function removeShadowHost(
  hostId: string,
  reactRoot: ReactDOM.Root | null
): void {
  const host = document.getElementById(hostId);
  if (host) {
    if (reactRoot) {
      reactRoot.unmount();
    }
    host.remove();
  }
}

/**
 * Checks if a Shadow DOM host already exists
 */
export function shadowHostExists(hostId: string): boolean {
  return document.getElementById(hostId) !== null;
}

