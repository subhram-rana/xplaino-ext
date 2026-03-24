// src/content/utils/urlHasher.ts
// SHA-256 helpers for URL normalization and content hashing.

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'fbclid', 'ref', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'msclkid', 'twclid', 'mc_cid', 'mc_eid', '_ga',
]);

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    // Normalize trailing slash on path
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Remove fragment — citations are page-level
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPageUrl(url: string): Promise<string> {
  return sha256(normalizeUrl(url));
}

export async function hashPageContent(content: string): Promise<string> {
  return sha256(content);
}
