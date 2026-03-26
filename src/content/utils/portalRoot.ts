// src/content/utils/portalRoot.ts
// Shadow DOM-based portal container for tooltip components.
// All styles are injected into the shadow root so nothing leaks to the host page.

export const PORTAL_ROOT_ID = 'xplaino-portal-root';

let portalMountPoint: HTMLDivElement | null = null;
let portalShadow: ShadowRoot | null = null;

/**
 * Returns the mount point inside a Shadow DOM host.
 * createPortal() targets this element so React content renders
 * inside the shadow tree, fully isolated from host page styles.
 */
export function getOrCreatePortalContainer(): HTMLElement {
  if (portalMountPoint) return portalMountPoint;

  const host = document.createElement('div');
  host.id = PORTAL_ROOT_ID;
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'z-index: 2147483647',
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    'overflow: visible',
    'pointer-events: none',
  ].join('; ') + ';';

  portalShadow = host.attachShadow({ mode: 'open' });

  const baseStyle = document.createElement('style');
  baseStyle.textContent = `
    :host { pointer-events: none !important; overflow: visible !important; }
    #portal-mount { pointer-events: auto; }
  `;
  portalShadow.appendChild(baseStyle);

  portalMountPoint = document.createElement('div');
  portalMountPoint.id = 'portal-mount';
  portalShadow.appendChild(portalMountPoint);

  document.documentElement.appendChild(host);
  return portalMountPoint;
}

/**
 * Returns the shadow root of the portal container (for style injection).
 * Automatically creates the portal container if it doesn't exist yet.
 */
export function getPortalShadowRoot(): ShadowRoot {
  if (!portalShadow) getOrCreatePortalContainer();
  return portalShadow!;
}
