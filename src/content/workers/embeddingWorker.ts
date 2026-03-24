// src/content/workers/embeddingWorker.ts
// Web Worker that runs @xenova/transformers embedding inference off the main thread.
// Accepts 'init' and 'embed' messages; responds with 'ready', 'embedResult', 'embedError'.

import { pipeline, env } from '@xenova/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbedPipeline = any;

let embedder: EmbedPipeline | null = null;
let initPromise: Promise<EmbedPipeline> | null = null;

async function loadPipeline(wasmBasePath?: string): Promise<EmbedPipeline> {
  if (embedder) return embedder;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (wasmBasePath) {
      env.backends.onnx.wasm.wasmPaths = wasmBasePath;
    }
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const pipe = await pipeline('feature-extraction', MODEL_ID, {
      quantized: true,
    });

    embedder = pipe;
    return pipe;
  })();

  return initPromise;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, id, texts, wasmBasePath } = event.data as {
    type: string;
    id: number;
    texts?: string[];
    wasmBasePath?: string;
  };

  if (type === 'init') {
    try {
      await loadPipeline(wasmBasePath);
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'initError', error: String(error) });
    }
    return;
  }

  if (type === 'embed') {
    if (!texts || texts.length === 0) {
      self.postMessage({ type: 'embedResult', id, vectors: [] });
      return;
    }

    try {
      const pipe = await loadPipeline(wasmBasePath);
      const vectors: number[][] = [];

      for (const text of texts) {
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        vectors.push(Array.from(output.data as Float32Array));
      }

      self.postMessage({ type: 'embedResult', id, vectors });
    } catch (error) {
      self.postMessage({ type: 'embedError', id, error: String(error) });
    }
  }
});
