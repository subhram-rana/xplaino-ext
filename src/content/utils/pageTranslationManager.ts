// src/content/utils/pageTranslationManager.ts
// Manager for page translation state and operations

import { TranslatableElement, extractTranslatableElements } from './pageContentExtractor';
import { TranslateService, TranslateTextItem } from '@/api-services/TranslateService';
import { COLORS, colorWithOpacity } from '@/constants/colors';

/**
 * Manages page translation state, batching, and DOM manipulation
 */
export class PageTranslationManager {
  private elements: TranslatableElement[] = [];
  private translationMode: 'append' | 'replace' = 'append';
  private translationState: 'idle' | 'translating' | 'partially-translated' | 'fully-translated' = 'idle';
  private viewMode: 'original' | 'translated' = 'translated';
  private batchSize: number = 15;
  private abortController: AbortController | null = null;

  /**
   * Translate the page
   * @param targetLanguageCode Target language ISO 639-1 code (e.g., 'EN', 'ES')
   * @param mode Translation mode ('append' or 'replace')
   */
  async translatePage(targetLanguageCode: string, mode: 'append' | 'replace'): Promise<void> {
    console.log('[PageTranslationManager] Starting page translation', {
      targetLanguageCode,
      mode
    });

    // Set state to translating
    this.translationState = 'translating';

    // Extract translatable elements
    this.elements = extractTranslatableElements();
    this.translationMode = mode;

    if (this.elements.length === 0) {
      console.warn('[PageTranslationManager] No translatable elements found');
      this.translationState = 'idle';
      return;
    }

    console.log(`[PageTranslationManager] Found ${this.elements.length} elements to translate`);

    // Create batches
    const batches = this.createBatches();
    console.log(`[PageTranslationManager] Created ${batches.length} batches`);

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        console.log(`[PageTranslationManager] Processing batch ${i + 1}/${batches.length} (${batch.texts.length} texts)`);

        try {
          await this.translateBatch(batch, targetLanguageCode);
        } catch (error) {
          // Check if it was aborted
          if (error instanceof Error && error.message === 'AbortError') {
            throw error; // Re-throw to be caught by outer try-catch
          }
          // For non-abort errors, stop the entire translation process
          // This ensures no state is stored when API fails
          console.error(`[PageTranslationManager] Error translating batch ${i + 1}:`, error);
          throw error; // Re-throw to stop translation and clean up state
        }
      }

      // All batches completed successfully
      this.translationState = 'fully-translated';
      console.log('[PageTranslationManager] Page translation complete');
    } catch (error) {
      // Translation was aborted or failed
      if (error instanceof Error && error.message === 'AbortError') {
        const hasTranslations = this.elements.some(el => el.translatedText);
        this.translationState = hasTranslations ? 'partially-translated' : 'idle';
        console.log('[PageTranslationManager] Translation stopped', { state: this.translationState });
      } else {
        // For any other error, reset state to idle and clear translations
        this.translationState = 'idle';
        // Clear any partial translations that might have been applied
        this.clearTranslations();
        console.error('[PageTranslationManager] Translation failed:', error);
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Get current translation state
   */
  getTranslationState(): 'idle' | 'translating' | 'partially-translated' | 'fully-translated' {
    return this.translationState;
  }

  /**
   * Get current view mode
   */
  getViewMode(): 'original' | 'translated' {
    return this.viewMode;
  }

  /**
   * Stop translation in progress
   */
  stopTranslation(): void {
    if (this.abortController) {
      console.log('[PageTranslationManager] Stopping translation');
      this.abortController.abort();
      this.abortController = null;
      
      // Immediately update state based on whether any translations exist
      const hasTranslations = this.elements.some(el => el.translatedText);
      this.translationState = hasTranslations ? 'partially-translated' : 'idle';
      console.log('[PageTranslationManager] State updated to:', this.translationState);
    }
  }

  /**
   * Toggle between original and translated view
   */
  toggleView(mode: 'original' | 'translated'): void {
    this.viewMode = mode;
    
    console.log(`[PageTranslationManager] Switching to ${mode} view`);

    this.elements.forEach(element => {
      if (element.translatedText) {
        if (this.translationMode === 'append') {
          // For append mode, show/hide the translation div
          const nextSibling = element.element.nextSibling;
          if (nextSibling && 
              nextSibling.nodeType === Node.ELEMENT_NODE && 
              (nextSibling as HTMLElement).classList.contains('xplaino-translation-appended')) {
            const translationDiv = nextSibling as HTMLElement;
            translationDiv.style.display = mode === 'original' ? 'none' : '';
          }
        } else {
          // For replace mode, swap text content
          if (mode === 'original') {
            const original = element.element.getAttribute('data-xplaino-original');
            if (original) {
              element.element.textContent = original;
              // Restore original color by removing inline color style
              element.element.style.color = '';
            }
          } else {
            element.element.textContent = element.translatedText;
            // Apply teal color for translated text
            element.element.style.color = COLORS.PRIMARY;
          }
        }
      }
    });
  }

  /**
   * Clear all translations and reset state
   */
  clearTranslations(): void {
    console.log('[PageTranslationManager] Clearing all translations');

    this.elements.forEach(element => {
      if (this.translationMode === 'append') {
        // Remove appended translation divs
        const nextSibling = element.element.nextSibling;
        if (nextSibling && 
            nextSibling.nodeType === Node.ELEMENT_NODE && 
            (nextSibling as HTMLElement).classList.contains('xplaino-translation-appended')) {
          nextSibling.parentNode?.removeChild(nextSibling);
        }
      } else {
        // Restore original text
        const original = element.element.getAttribute('data-xplaino-original');
        if (original) {
          element.element.textContent = original;
          // Restore original color by removing inline color style
          element.element.style.color = '';
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

  /**
   * Create batches of texts for translation
   */
  private createBatches(): Array<{ texts: string[]; indices: number[] }> {
    const batches: Array<{ texts: string[]; indices: number[] }> = [];

    for (let i = 0; i < this.elements.length; i += this.batchSize) {
      const batchElements = this.elements.slice(i, i + this.batchSize);
      batches.push({
        texts: batchElements.map(el => el.originalText),
        indices: batchElements.map((_, idx) => i + idx)
      });
    }

    return batches;
  }

  /**
   * Translate a batch of texts
   */
  private async translateBatch(
    batch: { texts: string[]; indices: number[] },
    targetLanguageCode: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate unique IDs for each text item
      const textItems: TranslateTextItem[] = batch.texts.map((text, index) => ({
        id: `batch_${Date.now()}_${index}`,
        text: text
      }));

      // Map to store pending translations for micro-batching
      const pendingUpdates = new Map<number, string>();
      let updateInterval: number | null = null;

      // Apply pending translations to DOM
      const applyPendingTranslations = () => {
        if (pendingUpdates.size === 0) return;
        
        console.log(`[PageTranslationManager] Applying ${pendingUpdates.size} pending translations to DOM`);
        
        pendingUpdates.forEach((translatedText, elementIdx) => {
          const element = this.elements[elementIdx];
          if (element) {
            element.translatedText = translatedText;
            this.applyTranslation(element);
          }
        });
        pendingUpdates.clear();
      };

      TranslateService.translate(
        {
          targetLangugeCode: targetLanguageCode,
          texts: textItems
        },
        {
          onProgress: (index, translatedText) => {
            // Store translation in pending updates map
            const elementIdx = batch.indices[index];
            pendingUpdates.set(elementIdx, translatedText);
            
            // Start 2-second interval if not already running
            if (!updateInterval) {
              console.log('[PageTranslationManager] Starting 2-second micro-batching interval');
              updateInterval = setInterval(applyPendingTranslations, 2000);
            }
          },
          onSuccess: (translatedTexts) => {
            console.log(`[PageTranslationManager] Batch translation completed, got ${translatedTexts.length} translations`);

            // Clear the interval
            if (updateInterval) {
              clearInterval(updateInterval);
              updateInterval = null;
            }

            // Apply any remaining pending translations
            applyPendingTranslations();

            resolve();
          },
          onError: (errorCode, errorMessage) => {
            console.error('[PageTranslationManager] Translation error:', errorCode, errorMessage);
            
            // Clear the interval
            if (updateInterval) {
              clearInterval(updateInterval);
              updateInterval = null;
            }
            
            // Check if it's an abort error
            if (errorCode === 'AbortError' || errorMessage.includes('abort')) {
              reject(new Error('AbortError'));
            } else {
              // Reject for non-abort errors to properly propagate the error
              // This ensures handleTranslateClick() can catch and clean up state
              reject(new Error(`Translation error: ${errorCode} - ${errorMessage}`));
            }
          },
          onLoginRequired: () => {
            console.log('[PageTranslationManager] Login required for translation');
            
            // Clear the interval
            if (updateInterval) {
              clearInterval(updateInterval);
              updateInterval = null;
            }
            
            reject(new Error('LOGIN_REQUIRED'));
          }
        },
        this.abortController || undefined
      );
    });
  }

  /**
   * Apply translation to an element based on mode
   */
  private applyTranslation(element: TranslatableElement): void {
    if (!element.translatedText) return;

    if (this.translationMode === 'append') {
      this.applyAppendedTranslation(element);
    } else {
      this.applyReplacedTranslation(element);
    }
  }

  /**
   * Apply translation in append mode (add below original)
   */
  private applyAppendedTranslation(element: TranslatableElement): void {
    if (!element.translatedText) return;

    // Check if already appended
    const nextSibling = element.element.nextSibling;
    if (nextSibling && 
        nextSibling.nodeType === Node.ELEMENT_NODE && 
        (nextSibling as HTMLElement).classList.contains('xplaino-translation-appended')) {
      return; // Already appended
    }

    // Get computed styles from the original element to preserve font properties
    const computedStyle = window.getComputedStyle(element.element);
    const fontStyle = computedStyle.fontStyle;
    const fontWeight = computedStyle.fontWeight;
    const fontSize = computedStyle.fontSize;

    // Create translation div
    const translationDiv = document.createElement('div');
    translationDiv.className = 'xplaino-translation-appended';
    translationDiv.textContent = element.translatedText;
    
    // Theme-aware color: detect system dark mode preference
    const isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    const primaryColor = isDarkMode ? COLORS.DARK_PRIMARY : COLORS.PRIMARY;
    
    translationDiv.style.cssText = `
      color: ${primaryColor};
      font-style: ${fontStyle};
      font-weight: ${fontWeight};
      font-size: ${fontSize};
      margin-top: 4px;
      padding-left: 8px;
      border-left: 2px solid ${colorWithOpacity(primaryColor, 0.3)};
      line-height: inherit;
    `;

    // Insert after the original element
    if (element.element.parentNode) {
      element.element.parentNode.insertBefore(translationDiv, element.element.nextSibling);
      element.element.setAttribute('data-xplaino-translated', 'true');
    }
  }

  /**
   * Apply translation in replace mode (swap content)
   */
  private applyReplacedTranslation(element: TranslatableElement): void {
    if (!element.translatedText) return;

    // Store original text
    if (!element.element.hasAttribute('data-xplaino-original')) {
      element.element.setAttribute('data-xplaino-original', element.originalText);
    }

    // Replace text content
    element.element.textContent = element.translatedText;
    
    // Apply teal color while preserving existing font properties
    element.element.style.color = COLORS.PRIMARY;
    
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

