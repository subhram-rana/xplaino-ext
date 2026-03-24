// src/content/utils/bm25Reranker.ts
// Lightweight in-memory BM25 reranker. No external dependencies.
// Combines cosine similarity score with BM25 keyword score.

const K1 = 1.5;
const B = 0.75;
const COSINE_WEIGHT = 0.5;
const BM25_WEIGHT = 1 - COSINE_WEIGHT;
const DEFAULT_TOP_K = 7;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter((t) => t.length > 1);
}

export interface BM25Candidate {
  chunkId: string;
  text: string;
  cosineScore: number;
  metadata: {
    startXPath: string;
    endXPath: string;
    startOffset: number;
    endOffset: number;
    cssSelector: string;
    textSnippetStart: string;
    textSnippetEnd: string;
  };
}

export function bm25Rerank(
  query: string,
  candidates: BM25Candidate[],
  topK: number = DEFAULT_TOP_K
): BM25Candidate[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= topK) return [...candidates].sort((a, b) => b.cosineScore - a.cosineScore);

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return candidates.slice(0, topK);
  }

  const docs = candidates.map((c) => tokenize(c.text));
  const N = docs.length;
  const avgDl = docs.reduce((sum, d) => sum + d.length, 0) / N;

  // Compute IDF for each unique query term
  const idf: Record<string, number> = {};
  for (const term of queryTerms) {
    if (term in idf) continue;
    const df = docs.filter((d) => d.includes(term)).length;
    idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }

  // BM25 score for each document
  const bm25Scores = docs.map((doc) => {
    const dl = doc.length;
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.filter((t) => t === term).length;
      if (tf === 0) continue;
      const num = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + B * (dl / avgDl));
      score += idf[term] * (num / denom);
    }
    return score;
  });

  // Normalize BM25 scores to [0, 1]
  const maxBm25 = Math.max(...bm25Scores, 1e-9);
  const normalizedBm25 = bm25Scores.map((s) => s / maxBm25);

  // Combined score
  const scored = candidates.map((c, i) => ({
    ...c,
    _combined: COSINE_WEIGHT * c.cosineScore + BM25_WEIGHT * normalizedBm25[i],
  }));

  scored.sort((a, b) => b._combined - a._combined);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return scored.slice(0, topK).map(({ _combined: _c, ...rest }) => rest);
}
