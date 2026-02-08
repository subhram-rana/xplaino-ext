// src/content/utils/pageTranslationManager.ts
// Manager for page translation state and operations
// Uses IntersectionObserver for viewport-based lazy translation and Chrome's
// built-in Translator API with automatic backend fallback.

import { TranslatableElement, extractTranslatableElements } from './pageContentExtractor';
import { translateWithFallback, TranslateTextItem } from '@/api-services/TranslateService';
import { COLORS, colorWithOpacity } from '@/constants/colors';

/**
 * Manages page translation state, batching, and DOM manipulation.
 *
 * Elements are extracted from the page once, then an IntersectionObserver
 * watches for elements that enter the viewport (with a 300 px pre-load
 * margin).  Only visible elements are sent for translation, keeping memory
 * and network usage proportional to what the user actually reads.
 */
export class PageTranslationManager {
  private elements: TranslatableElement[] = [];
  private elementIndexMap = new Map<HTMLElement, number>(); // fast lookup
  private translationMode: 'append' | 'replace' = 'append';
  private translationState: 'idle' | 'translating' | 'partially-translated' | 'fully-translated' = 'idle';
  private viewMode: 'original' | 'translated' = 'translated';
  private batchSize: number = 15;
  private abortController: AbortController | null = null;

  // Viewport-aware translation
  private observer: IntersectionObserver | null = null;
  private pendingElements: Set<number> = new Set(); // indices of elements awaiting translation
  private translateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private targetLanguageCode: string = '';
  private isTranslatingBatch = false; // guard against concurrent batch runs
  private translatedCount = 0;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Translate the page.  Elements are extracted immediately, but actual
   * translation happens lazily as they scroll into view.
   *
   * @param targetLanguageCode Target language ISO 639-1 code (e.g. 'EN', 'ES')
   * @param mode               Translation display mode ('append' or 'replace')
   */
  async translatePage(targetLanguageCode: string, mode: 'append' | 'replace'): Promise<void> {
    console.log('[PageTranslationManager] Starting page translation', {
      targetLanguageCode,
      mode,
    });

    // Set state to translating
    this.translationState = 'translating';
    this.translationMode = mode;
    this.targetLanguageCode = targetLanguageCode;
    this.translatedCount = 0;

    // Extract translatable elements
    this.elements = extractTranslatableElements();

    if (this.elements.length === 0) {
      console.warn('[PageTranslationManager] No translatable elements found');
      this.translationState = 'idle';
      return;
    }

    // Build a fast lookup map: HTMLElement -> index
    this.elementIndexMap.clear();
    this.elements.forEach((el, idx) => this.elementIndexMap.set(el.element, idx));

    console.log(`[PageTranslationManager] Found ${this.elements.length} elements to translate`);

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    // Set up IntersectionObserver – translates elements on viewport entry
    this.setupObserver();
  }

  /** Get current translation state. */
  getTranslationState(): 'idle' | 'translating' | 'partially-translated' | 'fully-translated' {
    return this.translationState;
  }

  /** Get current view mode. */
  getViewMode(): 'original' | 'translated' {
    return this.viewMode;
  }

  /** Stop translation in progress. */
  stopTranslation(): void {
    console.log('[PageTranslationManager] Stopping translation');

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.disconnectObserver();

    // Immediately update state based on whether any translations exist
    const hasTranslations = this.elements.some(el => el.translatedText);
    this.translationState = hasTranslations ? 'partially-translated' : 'idle';
    console.log('[PageTranslationManager] State updated to:', this.translationState);
  }

  /** Toggle between original and translated view. */
  toggleView(mode: 'original' | 'translated'): void {
    this.viewMode = mode;

    console.log(`[PageTranslationManager] Switching to ${mode} view`);

    this.elements.forEach(element => {
      if (element.translatedText) {
        if (this.translationMode === 'append') {
          // For append mode, show/hide the translation div
          const nextSibling = element.element.nextSibling;
          if (
            nextSibling &&
            nextSibling.nodeType === Node.ELEMENT_NODE &&
            (nextSibling as HTMLElement).classList.contains('xplaino-translation-appended')
          ) {
            const translationDiv = nextSibling as HTMLElement;
            translationDiv.style.display = mode === 'original' ? 'none' : '';
          }
        } else {
          // For replace mode, swap text content (color preserved from original)
          if (mode === 'original') {
            const original = element.element.getAttribute('data-xplaino-original');
            if (original) {
              element.element.textContent = original;
            }
          } else {
            element.element.textContent = element.translatedText;
          }
        }
      }
    });
  }

  /** Clear all translations and reset state. */
  clearTranslations(): void {
    console.log('[PageTranslationManager] Clearing all translations');

    this.disconnectObserver();

    this.elements.forEach(element => {
      if (this.translationMode === 'append') {
        // Remove appended translation divs
        const nextSibling = element.element.nextSibling;
        if (
          nextSibling &&
          nextSibling.nodeType === Node.ELEMENT_NODE &&
          (nextSibling as HTMLElement).classList.contains('xplaino-translation-appended')
        ) {
          nextSibling.parentNode?.removeChild(nextSibling);
        }
      } else {
        // Restore original text
        const original = element.element.getAttribute('data-xplaino-original');
        if (original) {
          element.element.textContent = original;
        }
      }

      // Clean up attributes
      element.element.removeAttribute('data-xplaino-translated');
      element.element.removeAttribute('data-xplaino-original');

      // Clear translated text from element
      element.translatedText = '';
    });

    this.translationState = 'idle';
    this.viewMode = 'translated';
    this.elements = [];
    this.elementIndexMap.clear();
    this.pendingElements.clear();
    this.translatedCount = 0;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if page is currently translated
   * @deprecated Use getTranslationState() instead
   */
  isPageTranslated(): boolean {
    return this.translationState === 'fully-translated' || this.translationState === 'partially-translated';
  }

  /**
   * Cancel ongoing translation
   * @deprecated Use stopTranslation() instead
   */
  cancel(): void {
    this.stopTranslation();
  }

  // -----------------------------------------------------------------------
  // IntersectionObserver – viewport-based lazy translation
  // -----------------------------------------------------------------------

  /**
   * Set up an IntersectionObserver that fires when elements scroll into
   * (or near) the viewport.  A 300 px root margin pre-loads elements just
   * before they become visible so users don't see a flash of untranslated
   * content.
   */
  private setupObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = this.elementIndexMap.get(entry.target as HTMLElement);
            if (idx !== undefined) {
              const el = this.elements[idx];
              // Only queue untranslated elements
              if (!el.translatedText) {
                this.pendingElements.add(idx);
              }
            }
            // Un-observe – we only need to translate once per element
            this.observer?.unobserve(entry.target);
          }
        }

        // Schedule a debounced translation for the newly visible elements
        if (this.pendingElements.size > 0) {
          this.scheduleTranslation();
        }
      },
      {
        rootMargin: '300px', // pre-load 300 px before viewport
        threshold: 0.1,
      },
    );

    // Start observing every extracted element
    this.elements.forEach(el => this.observer!.observe(el.element));
  }

  /** Disconnect the IntersectionObserver and clear timers. */
  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.translateDebounceTimer) {
      clearTimeout(this.translateDebounceTimer);
      this.translateDebounceTimer = null;
    }
  }

  /**
   * Debounce: wait 100 ms to collect all elements that just scrolled into
   * view, then translate them as a batch.
   */
  private scheduleTranslation(): void {
    if (this.translateDebounceTimer) clearTimeout(this.translateDebounceTimer);
    this.translateDebounceTimer = setTimeout(() => {
      this.translatePendingElements();
    }, 100);
  }

  // -----------------------------------------------------------------------
  // Batch translation of pending (viewport) elements
  // -----------------------------------------------------------------------

  /**
   * Translate all elements that have been queued by the IntersectionObserver.
   * Elements are split into batches of `batchSize` and translated via
   * `translateWithFallback` (Chrome Translator API -> backend SSE fallback).
   */
  private async translatePendingElements(): Promise<void> {
    if (this.pendingElements.size === 0) return;
    if (this.isTranslatingBatch) return; // prevent concurrent runs

    this.isTranslatingBatch = true;

    // Snapshot the current pending indices and clear the set
    const indices = Array.from(this.pendingElements).sort((a, b) => a - b);
    this.pendingElements.clear();

    // Split into batches
    for (let start = 0; start < indices.length; start += this.batchSize) {
      // Check abort
      if (this.abortController?.signal.aborted) break;

      const batchIndices = indices.slice(start, start + this.batchSize);

      try {
        await this.translateBatch(batchIndices);
      } catch (error) {
        if (error instanceof Error && error.message === 'AbortError') {
          break;
        }
        console.error('[PageTranslationManager] Batch error:', error);
        // For non-abort errors: stop translating, update state
        this.translationState = this.translatedCount > 0 ? 'partially-translated' : 'idle';
        break;
      }
    }

    this.isTranslatingBatch = false;

    // Update overall state
    this.updateTranslationState();
  }

  /**
   * Translate a single batch of element indices using `translateWithFallback`.
   */
  private async translateBatch(batchIndices: number[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const textItems: TranslateTextItem[] = batchIndices.map((idx, i) => ({
        id: `batch_${Date.now()}_${i}`,
        text: this.elements[idx].originalText,
      }));

      // Map id→elementIndex for fast lookup in onProgress
      const idToElementIdx = new Map<number, number>();
      batchIndices.forEach((elemIdx, i) => idToElementIdx.set(i, elemIdx));

      translateWithFallback(
        {
          targetLangugeCode: this.targetLanguageCode,
          texts: textItems,
        },
        {
          onProgress: (index, translatedText) => {
            const elementIdx = idToElementIdx.get(index);
            if (elementIdx !== undefined) {
              const element = this.elements[elementIdx];
              if (element) {
                element.translatedText = translatedText;
                this.applyTranslation(element);
                this.translatedCount++;
              }
            }
          },
          onSuccess: () => {
            resolve();
          },
          onError: (errorCode, errorMessage) => {
            console.error('[PageTranslationManager] Translation error:', errorCode, errorMessage);
            if (errorCode === 'AbortError' || errorMessage.includes('abort')) {
              reject(new Error('AbortError'));
            } else {
              reject(new Error(`Translation error: ${errorCode} - ${errorMessage}`));
            }
          },
          onLoginRequired: () => {
            reject(new Error('LOGIN_REQUIRED'));
          },
        },
        this.abortController || undefined,
      );
    });
  }

  /**
   * Recompute `translationState` based on how many elements have been
   * translated vs. total extracted.
   */
  private updateTranslationState(): void {
    if (this.translatedCount === 0) {
      // Still translating (observer is active, just nothing visible yet)
      return;
    }

    if (this.translatedCount >= this.elements.length) {
      this.translationState = 'fully-translated';
      this.disconnectObserver();
      console.log('[PageTranslationManager] All elements translated');
    } else {
      // Some translated, more may come as user scrolls
      this.translationState = 'translating';
    }
  }

  // -----------------------------------------------------------------------
  // DOM manipulation – apply / remove translations
  // -----------------------------------------------------------------------

  /** Apply translation to an element based on mode. */
  private applyTranslation(element: TranslatableElement): void {
    if (!element.translatedText) return;

    if (this.translationMode === 'append') {
      this.applyAppendedTranslation(element);
    } else {
      this.applyReplacedTranslation(element);
    }
  }

  /**
   * Detect if element is in dark mode context by checking background luminance.
   * Walks up the DOM tree to find a background color and calculates its
   * luminance.
   */
  private isElementInDarkMode(element: HTMLElement): boolean {
    let current: HTMLElement | null = element;
    while (current) {
      const bgColor = window.getComputedStyle(current).backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          return luminance < 128;
        }
      }
      current = current.parentElement;
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  }

  /** Apply translation in append mode (add below original). */
  private applyAppendedTranslation(element: TranslatableElement): void {
    if (!element.translatedText) return;

    // Check if already appended
    const nextSibling = element.element.nextSibling;
    if (
      nextSibling &&
      nextSibling.nodeType === Node.ELEMENT_NODE &&
      (nextSibling as HTMLElement).classList.contains('xplaino-translation-appended')
    ) {
      return; // Already appended
    }

    // Get computed styles from the original element to preserve font properties and color
    const computedStyle = window.getComputedStyle(element.element);
    const fontStyle = computedStyle.fontStyle;
    const fontWeight = computedStyle.fontWeight;
    const fontSize = computedStyle.fontSize;
    const originalColor = computedStyle.color;

    // Create translation div
    const translationDiv = document.createElement('div');
    translationDiv.className = 'xplaino-translation-appended';
    translationDiv.textContent = element.translatedText;

    // Use the same color as the original text for a seamless reading experience
    // Use primary color only for the border-left accent
    const isDarkMode = this.isElementInDarkMode(element.element);
    const accentColor = isDarkMode ? COLORS.DARK_PRIMARY : COLORS.PRIMARY;

    translationDiv.style.cssText = `
      color: ${originalColor};
      font-style: ${fontStyle};
      font-weight: ${fontWeight};
      font-size: ${fontSize};
      margin-top: 4px;
      padding-left: 8px;
      border-left: 2px solid ${colorWithOpacity(accentColor, 0.3)};
      line-height: inherit;
    `;

    // Insert after the original element
    if (element.element.parentNode) {
      element.element.parentNode.insertBefore(translationDiv, element.element.nextSibling);
      element.element.setAttribute('data-xplaino-translated', 'true');
    }
  }

  /**
   * Apply translation in replace mode (swap content).
   * Color and font style are preserved from the original element.
   */
  private applyReplacedTranslation(element: TranslatableElement): void {
    if (!element.translatedText) return;

    // Store original text
    if (!element.element.hasAttribute('data-xplaino-original')) {
      element.element.setAttribute('data-xplaino-original', element.originalText);
    }

    // Replace text content (color and font style are preserved from the original element)
    element.element.textContent = element.translatedText;

    element.element.setAttribute('data-xplaino-translated', 'true');
  }

  /**
   * Restore original content (cleanup)
   * @deprecated Use clearTranslations() instead
   */
  restoreOriginal(): void {
    this.clearTranslations();
  }
}
