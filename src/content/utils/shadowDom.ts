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
 * Creates a Shadow DOM host element with proper isolation
 */
export function createShadowHost(options: ShadowHostOptions): ShadowHostResult {
  const { id, zIndex = 2147483647 } = options;

  // Create host element
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = `all: initial; position: fixed; z-index: ${zIndex};`;

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Create React mount point
  const mountPoint = document.createElement('div');
  mountPoint.id = `${id}-root`;
  shadow.appendChild(mountPoint);

  return { host, shadow, mountPoint };
}

/**
 * Injects CSS styles into a Shadow DOM
 */
export function injectStyles(shadow: ShadowRoot, cssText: string): HTMLStyleElement {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssText;
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

