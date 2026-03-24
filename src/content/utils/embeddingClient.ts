// src/content/utils/embeddingClient.ts
// Promise-based wrapper around the embedding Web Worker.
// The worker is created lazily and reused across all calls.

let worker: Worker | null = null;
let messageIdCounter = 0;

interface PendingRequest {
  resolve: (vectors: number[][]) => void;
  reject: (err: Error) => void;
}

const pending = new Map<number, PendingRequest>();

function getOrCreateWorker(): Worker {
  if (worker) return worker;

  const workerUrl = chrome.runtime.getURL('src/content/workers/embeddingWorker.js');
  const w = new Worker(workerUrl);

  w.addEventListener('message', (event: MessageEvent) => {
    const { type, id, vectors, error } = event.data as {
      type: string;
      id?: number;
      vectors?: number[][];
      error?: string;
    };

    if (type === 'embedResult' && id !== undefined) {
      const req = pending.get(id);
      if (req) {
        pending.delete(id);
        req.resolve(vectors ?? []);
      }
      return;
    }

    if (type === 'embedError' && id !== undefined) {
      const req = pending.get(id);
      if (req) {
        pending.delete(id);
        req.reject(new Error(error ?? 'Embedding worker error'));
      }
    }
  });

  w.addEventListener('error', (event: ErrorEvent) => {
    console.error('[EmbeddingClient] Worker error:', event.message);
    // Reject all in-flight requests
    for (const req of pending.values()) {
      req.reject(new Error(`Embedding worker crashed: ${event.message}`));
    }
    pending.clear();
    worker = null;
  });

  worker = w;
  return w;
}

/**
 * Embed a batch of texts. Returns an array of 384-dimensional float vectors.
 * The worker loads the model lazily on first call.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const id = ++messageIdCounter;
  const w = getOrCreateWorker();

  return new Promise<number[][]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: 'embed', id, texts });
  });
}

/**
 * Embed a single text. Returns a 384-dimensional float vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

/**
 * Cosine similarity between two unit vectors.
 * MiniLM-L6-v2 outputs normalized vectors so this is just a dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}
