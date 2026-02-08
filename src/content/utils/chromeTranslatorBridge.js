/**
 * Chrome Translator API Bridge – Main World Script
 *
 * This script is injected into the page's MAIN world (not the extension's
 * isolated world) so it can access Chrome's built-in Translator API which
 * may not be available in the content script's isolated JavaScript context.
 *
 * Communication with the content script happens via window.postMessage.
 *
 * Protocol:
 *   Content-script  →  Main-world:
 *     { type: 'XPLAINO_TRANSLATE_REQUEST', id, texts[], sourceLang, targetLang }
 *     { type: 'XPLAINO_TRANSLATE_AVAILABILITY', id, sourceLang, targetLang }
 *     { type: 'XPLAINO_TRANSLATE_DETECT_LANG', id, sampleText }
 *     { type: 'XPLAINO_TRANSLATE_CHECK_API', id }
 *
 *   Main-world  →  Content-script:
 *     { type: 'XPLAINO_TRANSLATE_RESPONSE', id, results[], error? }
 *     { type: 'XPLAINO_TRANSLATE_AVAILABILITY_RESPONSE', id, availability }
 *     { type: 'XPLAINO_TRANSLATE_DETECT_LANG_RESPONSE', id, lang }
 *     { type: 'XPLAINO_TRANSLATE_CHECK_API_RESPONSE', id, available, detectorAvailable }
 *     { type: 'XPLAINO_TRANSLATE_PROGRESS', id, index, translatedText }
 */

// Cache translator instances keyed by "source-target"
var translatorCache = new Map();

/**
 * Get or create a cached Translator instance for a language pair.
 */
async function getOrCreateTranslator(sourceLang, targetLang) {
  var key = sourceLang + '-' + targetLang;
  var cached = translatorCache.get(key);
  if (cached) return cached;

  var translator = await Translator.create({
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
  });

  translatorCache.set(key, translator);
  return translator;
}

window.addEventListener('message', async function (event) {
  // Only accept messages from the same window (content script)
  if (event.source !== window) return;
  var data = event.data;
  if (!data || !data.type || data.type.indexOf('XPLAINO_TRANSLATE_') !== 0) return;

  try {
    switch (data.type) {
      // -----------------------------------------------------------------
      // Check if the Translator API is available in this (main) world
      // -----------------------------------------------------------------
      case 'XPLAINO_TRANSLATE_CHECK_API': {
        var available = typeof Translator !== 'undefined' && 'Translator' in self;
        var detectorAvailable =
          typeof LanguageDetector !== 'undefined' && 'LanguageDetector' in self;
        console.log(
          '[TranslatorBridge] API check – Translator:',
          available,
          'LanguageDetector:',
          detectorAvailable
        );
        window.postMessage(
          {
            type: 'XPLAINO_TRANSLATE_CHECK_API_RESPONSE',
            id: data.id,
            available: available,
            detectorAvailable: detectorAvailable,
          },
          '*'
        );
        break;
      }

      // -----------------------------------------------------------------
      // Check language pair availability
      // -----------------------------------------------------------------
      case 'XPLAINO_TRANSLATE_AVAILABILITY': {
        var availability = 'unavailable';
        try {
          availability = await Translator.availability({
            sourceLanguage: data.sourceLang,
            targetLanguage: data.targetLang,
          });
        } catch (err) {
          console.warn('[TranslatorBridge] availability() failed:', err);
        }
        window.postMessage(
          {
            type: 'XPLAINO_TRANSLATE_AVAILABILITY_RESPONSE',
            id: data.id,
            availability: availability,
          },
          '*'
        );
        break;
      }

      // -----------------------------------------------------------------
      // Detect source language
      // -----------------------------------------------------------------
      case 'XPLAINO_TRANSLATE_DETECT_LANG': {
        var lang = 'en'; // default

        // 1. Try <html lang>
        var htmlLang = document.documentElement ? document.documentElement.lang : '';
        if (htmlLang) {
          var base = htmlLang.split('-')[0].toLowerCase();
          if (base.length >= 2) lang = base;
        }

        // 2. Try Language Detector API
        if (
          data.sampleText &&
          typeof LanguageDetector !== 'undefined' &&
          'LanguageDetector' in self
        ) {
          try {
            var detector = await LanguageDetector.create();
            var results = await detector.detect(data.sampleText);
            if (results && results.length > 0 && results[0].detectedLanguage) {
              lang = results[0].detectedLanguage;
            }
          } catch (err) {
            console.warn('[TranslatorBridge] LanguageDetector failed:', err);
          }
        }

        window.postMessage(
          { type: 'XPLAINO_TRANSLATE_DETECT_LANG_RESPONSE', id: data.id, lang: lang },
          '*'
        );
        break;
      }

      // -----------------------------------------------------------------
      // Translate an array of texts
      // -----------------------------------------------------------------
      case 'XPLAINO_TRANSLATE_REQUEST': {
        try {
          var translator = await getOrCreateTranslator(
            data.sourceLang,
            data.targetLang
          );

          var results = [];
          for (var i = 0; i < data.texts.length; i++) {
            var translated = await translator.translate(data.texts[i]);
            results.push(translated);

            // Send per-item progress
            window.postMessage(
              {
                type: 'XPLAINO_TRANSLATE_PROGRESS',
                id: data.id,
                index: i,
                translatedText: translated,
              },
              '*'
            );
          }

          window.postMessage(
            { type: 'XPLAINO_TRANSLATE_RESPONSE', id: data.id, results: results },
            '*'
          );
        } catch (err) {
          window.postMessage(
            {
              type: 'XPLAINO_TRANSLATE_RESPONSE',
              id: data.id,
              results: [],
              error: err && err.message ? err.message : String(err),
            },
            '*'
          );
        }
        break;
      }
    }
  } catch (err) {
    console.error('[TranslatorBridge] Unexpected error:', err);
  }
});

// Signal that the bridge is ready
window.postMessage({ type: 'XPLAINO_TRANSLATE_BRIDGE_READY' }, '*');
console.log('[TranslatorBridge] Main-world bridge script loaded');
