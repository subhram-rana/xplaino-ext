// src/content/utils/vectorStore.ts
// IndexedDB persistence for page vector indexes.
// Keyed by SHA-256 hash of normalized page URL.

import { ChunkMetadata } from './pageChunker';

const DB_NAME = 'xplaino_webpage_chat';
const STORE_NAME = 'page_vector_index';
const DB_VERSION = 1;

export interface StoredChunk {
  chunkId: string;
  text: string;
  vector: number[];
  metadata: ChunkMetadata;
}

export interface VectorIndex {
  pageUrlHash: string;
  pageContentHash: string;
  indexedAt: string;
  chunks: StoredChunk[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'pageUrlHash' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
}

export async function getVectorIndex(urlHash: string): Promise<VectorIndex | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(urlHash);
      req.onsuccess = () => resolve((req.result as VectorIndex) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[VectorStore] getVectorIndex failed:', err);
    return null;
  }
}

export async function putVectorIndex(index: VectorIndex): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(index);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[VectorStore] putVectorIndex failed:', err);
  }
}

export async function deleteVectorIndex(urlHash: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(urlHash);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[VectorStore] deleteVectorIndex failed:', err);
  }
}
