// src/api-services/ChromeTranslatorService.ts
// Service wrapping Chrome's built-in Translator API (Chrome 138+)
// Uses a main-world bridge when the API isn't available in the content
// script's isolated world, and falls back gracefully when the API is
// completely unavailable.

/**
 * Convert an uppercase ISO 639-1 code (e.g. 'EN', 'HI') to a BCP 47
 * lowercase tag understood by the Chrome Translator API (e.g. 'en', 'hi').
 */
export function toBcp47(code: string): string {
  return code.toLowerCase();
}

// ---------------------------------------------------------------------------
// Main-world bridge helpers
// ---------------------------------------------------------------------------

/** Whether we've already injected the bridge <script> into the page. */
let bridgeInjected = false;
/** Resolves once the bridge has signalled it's ready. */
let bridgeReadyPromise: Promise<void> | null = null;

/** Monotonically increasing ID for bridge request/response correlation. */
let nextBridgeId = 1;

/** Pending bridge responses keyed by request id. */
const pendingBridgeCallbacks = new Map<
  number,
  { resolve: (data: any) => void; reject: (err: Error) => void }
>();

/** Registered per-request progress callbacks. */
const pendingProgressCallbacks = new Map<
  number,
  (index: number, translatedText: string) => void
>();

/**
 * Listen for all bridge response messages from the main world.
 * This listener is installed once and handles every response type.
 */
function installBridgeListener() {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || typeof d.type !== 'string') return;

    // Progress events (fire-and-forget, not correlated with resolve)
    if (d.type === 'XPLAINO_TRANSLATE_PROGRESS') {
      const cb = pendingProgressCallbacks.get(d.id);
      cb?.(d.index, d.translatedText);
      return;
    }

    // Response events
    if (
      d.type === 'XPLAINO_TRANSLATE_RESPONSE' ||
      d.type === 'XPLAINO_TRANSLATE_AVAILABILITY_RESPONSE' ||
      d.type === 'XPLAINO_TRANSLATE_DETECT_LANG_RESPONSE' ||
      d.type === 'XPLAINO_TRANSLATE_CHECK_API_RESPONSE'
    ) {
      const entry = pendingBridgeCallbacks.get(d.id);
      if (entry) {
        pendingBridgeCallbacks.delete(d.id);
        // Check for error in translate response
        if (d.type === 'XPLAINO_TRANSLATE_RESPONSE' && d.error) {
          entry.reject(new Error(d.error));
        } else {
          entry.resolve(d);
        }
      }
    }
  });
}

// Install once at module load
installBridgeListener();

/**
 * Inject the main-world bridge script into the page if not yet done.
 * Uses `chrome.scripting.executeScript` via the background service worker
 * so the injection bypasses the page's Content Security Policy (CSP).
 *
 * Returns a promise that resolves when the bridge signals it's ready.
 */
function ensureBridgeInjected(): Promise<void> {
  if (bridgeReadyPromise) return bridgeReadyPromise;

  bridgeReadyPromise = new Promise<void>((resolve) => {
    // Listen for the READY signal from the bridge
    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data?.type === 'XPLAINO_TRANSLATE_BRIDGE_READY'
      ) {
        window.removeEventListener('message', handler);
        bridgeInjected = true;
        console.log('[ChromeTranslatorService] Bridge script ready (via background injection)');
        resolve();
      }
    };
    window.addEventListener('message', handler);

    // Ask the background service worker to inject the bridge into the
    // page's MAIN world using chrome.scripting.executeScript.
    // This bypasses CSP restrictions that block <script> tag injection.
    try {
      chrome.runtime.sendMessage(
        { type: 'INJECT_TRANSLATOR_BRIDGE' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              '[ChromeTranslatorService] Bridge injection message failed:',
              chrome.runtime.lastError.message,
            );
            resolve(); // fall through to backend
            return;
          }
          if (!response?.success) {
            console.warn(
              '[ChromeTranslatorService] Background could not inject bridge:',
              response?.error,
            );
            // Don't resolve yet – the timeout below will handle it
          } else {
            console.log('[ChromeTranslatorService] Background confirmed bridge injection');
          }
        },
      );
    } catch (err) {
      console.error('[ChromeTranslatorService] Failed to request bridge injection:', err);
      resolve(); // fall through to backend
    }

    // Safety timeout – if bridge never signals ready, resolve after 5s
    setTimeout(() => {
      if (!bridgeInjected) {
        console.warn('[ChromeTranslatorService] Bridge ready timeout (5s) – proceeding without bridge');
        resolve();
      }
    }, 5_000);
  });

  return bridgeReadyPromise;
}

/**
 * Send a message to the bridge and wait for the correlated response.
 */
function bridgeRequest(msg: Record<string, any>, timeoutMs = 30_000): Promise<any> {
  const id = nextBridgeId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingBridgeCallbacks.delete(id);
      pendingProgressCallbacks.delete(id);
      reject(new Error(`Bridge request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingBridgeCallbacks.set(id, {
      resolve: (data) => {
        clearTimeout(timer);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });

    window.postMessage({ ...msg, id }, '*');
  });
}

// ---------------------------------------------------------------------------
// ChromeTranslatorService
// ---------------------------------------------------------------------------

/**
 * Singleton service that wraps Chrome's built-in Translator & Language
 * Detector APIs.  It first tries calling the APIs directly (works if
 * Chrome exposes them in the content-script isolated world).  If not,
 * it falls back to a main-world bridge injected as a <script> tag.
 *
 * Instances of `Translator` are cached (both directly and inside the
 * bridge) so that repeated translations for the same language pair
 * reuse the downloaded model.
 */
export class ChromeTranslatorService {
  // Cache keyed by "source-target" (e.g. "en-hi") for direct API usage
  private static translatorCache = new Map<string, Translator>();

  /** Whether we've determined the direct API is available. */
  private static directApiAvailable: boolean | null = null;
  /** Whether we've determined the bridge API is available. */
  private static bridgeApiAvailable: boolean | null = null;

  // -----------------------------------------------------------------------
  // Feature detection
  // -----------------------------------------------------------------------

  /** Returns `true` when the browser exposes the Translator API directly. */
  static isDirectApiAvailable(): boolean {
    const hasSelf = typeof self !== 'undefined';
    const hasTranslator = hasSelf && 'Translator' in self;
    return hasTranslator;
  }

  /**
   * Returns `true` when the Translator API is available – either directly
   * in the current JS world or via the main-world bridge.
   *
   * On the first call this does a **synchronous** check of the direct API.
   * If that fails, `isAvailable()` returns `false` synchronously, but
   * `ensureAvailable()` should be awaited to also probe the bridge.
   */
  static isAvailable(): boolean {
    if (this.directApiAvailable === true) return true;
    if (this.bridgeApiAvailable === true) return true;

    // Synchronous direct check
    const direct = this.isDirectApiAvailable();
    console.log(
      '[ChromeTranslatorService] isAvailable (sync):',
      direct,
      '| directApiAvailable:', this.directApiAvailable,
      '| bridgeApiAvailable:', this.bridgeApiAvailable,
    );
    if (direct) {
      this.directApiAvailable = true;
      return true;
    }
    return false;
  }

  /**
   * Async availability check that also probes the main-world bridge.
   * Call this before starting translations to get an accurate answer.
   */
  static async ensureAvailable(): Promise<boolean> {
    // 1. Direct check
    if (this.isDirectApiAvailable()) {
      this.directApiAvailable = true;
      console.log('[ChromeTranslatorService] Direct API available');
      return true;
    }
    this.directApiAvailable = false;

    // 2. Probe bridge
    if (this.bridgeApiAvailable === true) return true;
    if (this.bridgeApiAvailable === false) return false;

    try {
      console.log('[ChromeTranslatorService] Direct API NOT available, trying bridge...');
      await ensureBridgeInjected();
      if (!bridgeInjected) {
        this.bridgeApiAvailable = false;
        console.log('[ChromeTranslatorService] Bridge injection failed');
        return false;
      }

      const resp = await bridgeRequest(
        { type: 'XPLAINO_TRANSLATE_CHECK_API' },
        5_000,
      );
      this.bridgeApiAvailable = resp.available === true;
      console.log(
        '[ChromeTranslatorService] Bridge API check result:',
        resp.available,
        '| detector:', resp.detectorAvailable,
      );
      return this.bridgeApiAvailable;
    } catch (err) {
      console.warn('[ChromeTranslatorService] Bridge probe failed:', err);
      this.bridgeApiAvailable = false;
      return false;
    }
  }

  /** Returns `true` when the Language Detector API is available directly. */
  static isLanguageDetectorAvailable(): boolean {
    const available = typeof self !== 'undefined' && 'LanguageDetector' in self;
    return available;
  }

  // -----------------------------------------------------------------------
  // Internal: choose direct vs bridge
  // -----------------------------------------------------------------------

  private static get useBridge(): boolean {
    return this.directApiAvailable === false && this.bridgeApiAvailable === true;
  }

  // -----------------------------------------------------------------------
  // Language pair availability
  // -----------------------------------------------------------------------

  /**
   * Check whether a given source/target pair is supported.
   * @returns `'available'` | `'downloadable'` | `'unavailable'`
   */
  static async checkLanguagePair(
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    console.log('[ChromeTranslatorService] checkLanguagePair:', sourceLang, '->', targetLang);

    if (this.useBridge) {
      try {
        const resp = await bridgeRequest({
          type: 'XPLAINO_TRANSLATE_AVAILABILITY',
          sourceLang,
          targetLang,
        });
        console.log('[ChromeTranslatorService] checkLanguagePair (bridge) result:', resp.availability);
        return resp.availability ?? 'unavailable';
      } catch (err) {
        console.warn('[ChromeTranslatorService] bridge availability() failed:', err);
        return 'unavailable';
      }
    }

    // Direct API
    if (!this.isDirectApiAvailable()) return 'unavailable';
    try {
      const result = await Translator.availability({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });
      console.log('[ChromeTranslatorService] checkLanguagePair (direct) result:', result);
      return result;
    } catch (err) {
      console.warn('[ChromeTranslatorService] availability() failed:', err);
      return 'unavailable';
    }
  }

  // -----------------------------------------------------------------------
  // Source language detection
  // -----------------------------------------------------------------------

  /**
   * Best-effort detection of the page's source language.
   * 1. `<html lang="…">` attribute
   * 2. Chrome Language Detector API (direct or bridge)
   * 3. Defaults to `'en'`
   */
  static async detectSourceLanguage(sampleText?: string): Promise<string> {
    if (this.useBridge) {
      try {
        const resp = await bridgeRequest({
          type: 'XPLAINO_TRANSLATE_DETECT_LANG',
          sampleText: sampleText ?? '',
        });
        console.log('[ChromeTranslatorService] detectSourceLanguage (bridge):', resp.lang);
        return resp.lang ?? 'en';
      } catch {
        return 'en';
      }
    }

    // Direct path
    // 1. Try the <html lang> attribute
    const htmlLang = document.documentElement?.lang;
    if (htmlLang) {
      const base = htmlLang.split('-')[0].toLowerCase();
      if (base.length >= 2) return base;
    }

    // 2. Try the Language Detector API with sample text
    if (sampleText && this.isLanguageDetectorAvailable()) {
      try {
        const detector = await LanguageDetector.create();
        const results = await detector.detect(sampleText);
        if (results && results.length > 0 && results[0].detectedLanguage) {
          return results[0].detectedLanguage;
        }
      } catch (err) {
        console.warn('[ChromeTranslatorService] LanguageDetector failed:', err);
      }
    }

    // 3. Default
    return 'en';
  }

  // -----------------------------------------------------------------------
  // Translator instance management (direct API only)
  // -----------------------------------------------------------------------

  private static async getOrCreateTranslator(
    sourceLang: string,
    targetLang: string,
    onDownloadProgress?: (loaded: number) => void,
  ): Promise<Translator> {
    const key = `${sourceLang}-${targetLang}`;
    const cached = this.translatorCache.get(key);
    if (cached) return cached;

    const translator = await Translator.create({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      monitor(m: any) {
        if (onDownloadProgress) {
          m.addEventListener('downloadprogress', (e: any) => {
            onDownloadProgress(e.loaded);
          });
        }
      },
    });

    this.translatorCache.set(key, translator);
    return translator;
  }

  // -----------------------------------------------------------------------
  // Translation
  // -----------------------------------------------------------------------

  /**
   * Translate a single piece of text using the Chrome built-in API
   * (direct or via bridge).
   */
  static async translate(
    text: string,
    targetLangCode: string,
    sourceLangCode?: string,
    onDownloadProgress?: (loaded: number) => void,
  ): Promise<string> {
    const source = sourceLangCode ?? await this.detectSourceLanguage(text);
    console.log('[ChromeTranslatorService] translate:', source, '->', targetLangCode,
      '| text length:', text.length, '| useBridge:', this.useBridge);

    if (this.useBridge) {
      const resp = await bridgeRequest({
        type: 'XPLAINO_TRANSLATE_REQUEST',
        texts: [text],
        sourceLang: source,
        targetLang: targetLangCode,
      });
      if (resp.error) throw new Error(resp.error);
      return resp.results?.[0] ?? '';
    }

    // Direct API
    const translator = await this.getOrCreateTranslator(
      source,
      targetLangCode,
      onDownloadProgress,
    );
    const result = await translator.translate(text);
    console.log('[ChromeTranslatorService] translate result length:', result.length);
    return result;
  }

  /**
   * Translate an array of texts (direct or via bridge).
   */
  static async translateBatch(
    texts: string[],
    targetLangCode: string,
    sourceLangCode?: string,
    onProgress?: (index: number, translatedText: string) => void,
    onDownloadProgress?: (loaded: number) => void,
  ): Promise<string[]> {
    const source = sourceLangCode ?? await this.detectSourceLanguage(texts[0]);

    if (this.useBridge) {
      const id = nextBridgeId; // will be set by bridgeRequest
      // Register progress callback before sending
      if (onProgress) {
        pendingProgressCallbacks.set(nextBridgeId, onProgress);
      }
      const resp = await bridgeRequest({
        type: 'XPLAINO_TRANSLATE_REQUEST',
        texts,
        sourceLang: source,
        targetLang: targetLangCode,
      });
      pendingProgressCallbacks.delete(id);
      if (resp.error) throw new Error(resp.error);
      return resp.results ?? [];
    }

    // Direct API
    const translator = await this.getOrCreateTranslator(
      source,
      targetLangCode,
      onDownloadProgress,
    );
    const results: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const translated = await translator.translate(texts[i]);
      results.push(translated);
      onProgress?.(i, translated);
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Cache management
  // -----------------------------------------------------------------------

  /** Clear the translator instance cache (e.g. on cleanup). */
  static clearCache(): void {
    this.translatorCache.clear();
  }
}
