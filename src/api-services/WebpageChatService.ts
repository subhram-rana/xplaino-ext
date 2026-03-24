// src/api-services/WebpageChatService.ts
// API service for the "Chat with Webpage" feature.
// Implements classify (JSON POST) and answer (SSE POST) following AskService patterns.

import { ENV } from '@/config/env';
import { ApiHeaders } from './ApiHeaders';
import { ApiResponseHandler } from './ApiResponseHandler';
import { TokenRefreshRetry } from './TokenRefreshRetry';
import { TokenRefreshService } from './TokenRefreshService';
import { ChunkMetadata } from '@/content/utils/pageChunker';

// =============================================================================
// Types
// =============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClassifyRequest {
  question: string;
  conversationHistory?: ConversationMessage[];
}

export interface ClassifyResult {
  type: 'greeting' | 'broad' | 'contextual';
  reply: string;
}

export interface WebpageChunk {
  chunkId: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface AnswerRequest {
  question: string;
  questionType: 'broad' | 'contextual';
  pageUrl: string;
  pageTitle?: string;
  /** Optional ISO 639-1 language code (e.g. 'EN', 'FR'). Nullable — omit when unknown. */
  languageCode?: string;
  /**
   * Text the user selected/annotated on the page before asking this question.
   * When provided, the LLM treats this as the primary focus and uses the chunks
   * for supporting evidence and broader context.
   */
  selectedText?: string;
  chunks: WebpageChunk[];
  conversationHistory?: ConversationMessage[];
}

export interface CitationDetail {
  chunkId: string;
  text: string;
  startXPath: string;
  endXPath: string;
  startOffset: number;
  endOffset: number;
  cssSelector: string;
  textSnippetStart: string;
  textSnippetEnd: string;
}

export interface AnswerCallbacks {
  /** Called for each streamed chunk; progressiveAnswer is the growing display text */
  onChunk: (chunk: string, accumulated: string, progressiveAnswer: string) => void;
  /** Called with final parsed answer text and citation map */
  onCitations: (answer: string, citationMap: Record<string, CitationDetail>) => void;
  onError: (errorCode: string, errorMessage: string) => void;
  onLoginRequired: () => void;
  onSubscriptionRequired?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

const CITE_STRIP_RE = /\[\[cite:[^\]]+\]\]/g;

/** Strip [[cite:...]] markers from assistant history before sending to API */
export function stripCiteMarkers(text: string): string {
  return text.replace(CITE_STRIP_RE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Progressively extract the answer field from a partial/complete JSON string.
 * The LLM streams JSON: {"answer": "growing text..."}
 * Returns the extracted answer text, or empty string if not yet available.
 */
function extractProgressiveAnswer(accumulated: string): string {
  // Match the answer field value progressively — no closing quote required so
  // each SSE chunk updates the displayed text as soon as "answer": " appears.
  const match = accumulated.match(/"answer"\s*:\s*"((?:[^"\\]|\\[\s\S])*)/s);
  if (match) {
    const raw = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    // Strip citation markers during streaming — the citationMap is empty until the
    // final "citations" SSE event fires, so chips would all show "could not locate".
    // The final committed message (from onCitations) keeps the markers and works correctly.
    return raw.replace(/\[\[cite:[^\]]+\]\]/g, '');
  }
  // If the LLM output doesn't start with { it's plain text (windowed path)
  if (!accumulated.trimStart().startsWith('{')) {
    return accumulated;
  }
  return '';
}

/**
 * Parse final accumulated text into { answer, citedChunkIds }.
 * Falls back to using accumulated as raw answer if JSON parse fails.
 */
function parseFinalAccumulated(accumulated: string): { answer: string; citedChunkIds: string[] } {
  try {
    const parsed = JSON.parse(accumulated);
    return {
      answer: parsed.answer ?? accumulated,
      citedChunkIds: parsed.citedChunkIds ?? [],
    };
  } catch {
    return { answer: accumulated, citedChunkIds: [] };
  }
}

// =============================================================================
// SSE stream reader — shared logic extracted for reuse in retry path
// =============================================================================

async function processSSEStream(
  response: Response,
  callbacks: AnswerCallbacks,
  abortController?: AbortController
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('STREAM_ERROR', 'Failed to get response reader');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let finalAnswer = '';
  let citationMap: Record<string, CitationDetail> = {};
  let gotCitations = false;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (abortController?.signal.aborted) {
        await reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      if (abortController?.signal.aborted) {
        await reader.cancel();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data) as Record<string, unknown>;

          if ('type' in event) {
            const evType = event.type as string;

            if (evType === 'citations') {
              citationMap = (event.citationMap ?? {}) as Record<string, CitationDetail>;
              gotCitations = true;
              // Parse the final answer from accumulated
              const parsed = parseFinalAccumulated(accumulated);
              finalAnswer = parsed.answer;
            } else if (evType === 'error') {
              const code = (event.error_code as string) ?? 'UNKNOWN_ERROR';
              const msg = (event.error_message as string) ?? 'An error occurred';
              if (ApiResponseHandler.checkLoginRequired({ error_code: code }, 0)) {
                ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebpageChatService');
              } else {
                callbacks.onError(code, msg);
              }
              return;
            }
          } else if ('chunk' in event) {
            const chunk = event.chunk as string;
            accumulated = (event.accumulated as string) ?? accumulated + chunk;
            const progressiveAnswer = extractProgressiveAnswer(accumulated);
            callbacks.onChunk(chunk, accumulated, progressiveAnswer);
          }
        } catch {
          // Ignore malformed SSE data lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (gotCitations) {
    callbacks.onCitations(finalAnswer, citationMap);
  } else {
    // Stream ended without citations event — try to parse what we have
    const parsed = parseFinalAccumulated(accumulated);
    callbacks.onCitations(parsed.answer, {});
  }
}

// =============================================================================
// WebpageChatService
// =============================================================================

export class WebpageChatService {
  private static readonly CLASSIFY_ENDPOINT = '/api/webpage-chat/classify';
  private static readonly ANSWER_ENDPOINT = '/api/webpage-chat/answer';

  // ---------------------------------------------------------------------------
  // Classify
  // ---------------------------------------------------------------------------

  static async classify(
    request: ClassifyRequest,
    onLoginRequired: () => void
  ): Promise<ClassifyResult> {
    const url = `${ENV.API_BASE_URL}${this.CLASSIFY_ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebpageChatService.classify');

    const fetchWithHeaders = async (headers: Record<string, string>): Promise<Response> =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(request),
        credentials: 'include',
      });

    let response = await fetchWithHeaders(authHeaders);
    await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebpageChatService.classify');

    // Token refresh retry
    if (response.status === 401) {
      const errorData = await ApiResponseHandler.parseErrorResponse(response);
      if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
        try {
          response = await TokenRefreshRetry.retryRequestWithTokenRefresh(
            {
              url,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify(request),
              credentials: 'include',
            },
            'WebpageChatService.classify'
          );
        } catch {
          await TokenRefreshService.handleTokenRefreshFailure();
          onLoginRequired();
          throw new Error('TOKEN_REFRESH_FAILED');
        }
      } else if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
        ApiResponseHandler.handleLoginRequired(onLoginRequired, 'WebpageChatService.classify');
        throw new Error('LOGIN_REQUIRED');
      }
    }

    if (!response.ok) {
      const errorData = await ApiResponseHandler.parseErrorResponse(response);
      if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
        ApiResponseHandler.handleLoginRequired(onLoginRequired, 'WebpageChatService.classify');
        throw new Error('LOGIN_REQUIRED');
      }
      const code = errorData?.detail?.error ?? errorData?.error ?? 'CLASSIFY_ERROR';
      throw new Error(code);
    }

    const data = await response.json();
    return { type: data.type, reply: data.reply ?? '' };
  }

  // ---------------------------------------------------------------------------
  // Answer (SSE)
  // ---------------------------------------------------------------------------

  static async answer(
    request: AnswerRequest,
    callbacks: AnswerCallbacks,
    abortController?: AbortController
  ): Promise<void> {
    const url = `${ENV.API_BASE_URL}${this.ANSWER_ENDPOINT}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('WebpageChatService.answer');

    const requestBody = JSON.stringify(request);
    const fetchConfig = {
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...authHeaders,
      },
      body: requestBody,
      signal: abortController?.signal,
      credentials: 'include' as const,
    };

    try {
      let response = await fetch(url, fetchConfig);
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'WebpageChatService.answer');

      // 401 handling with token refresh
      if (response.status === 401) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);

        if (TokenRefreshRetry.shouldRetryWithTokenRefresh(response, errorData)) {
          try {
            response = await TokenRefreshRetry.retrySSERequestWithTokenRefresh(
              {
                url,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'text/event-stream',
                  ...authHeaders,
                },
                body: requestBody,
                signal: abortController?.signal,
                credentials: 'include',
              },
              'WebpageChatService.answer'
            );

            if (response.status === 401) {
              const retryErr = await ApiResponseHandler.parseErrorResponse(response);
              if (ApiResponseHandler.checkLoginRequired(retryErr, response.status)) {
                ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebpageChatService.answer');
                return;
              }
              callbacks.onError('AUTH_ERROR', 'Authentication failed');
              return;
            }
          } catch {
            await TokenRefreshService.handleTokenRefreshFailure();
            callbacks.onLoginRequired();
            return;
          }
        } else if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebpageChatService.answer');
          return;
        } else {
          callbacks.onError('AUTH_ERROR', 'Authentication failed');
          return;
        }
      }

      if (!response.ok) {
        const errorData = await ApiResponseHandler.parseErrorResponse(response);
        if (ApiResponseHandler.checkLoginRequired(errorData, response.status)) {
          ApiResponseHandler.handleLoginRequired(callbacks.onLoginRequired, 'WebpageChatService.answer');
          return;
        }
        if (ApiResponseHandler.checkSubscriptionRequired(errorData, response.status)) {
          ApiResponseHandler.handleSubscriptionRequired(callbacks.onSubscriptionRequired, 'WebpageChatService.answer');
          return;
        }
        callbacks.onError(
          errorData?.error_code ?? 'HTTP_ERROR',
          errorData?.error_message ?? `HTTP ${response.status}`
        );
        return;
      }

      await processSSEStream(response, callbacks, abortController);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') return;
        callbacks.onError('NETWORK_ERROR', err.message);
      } else {
        callbacks.onError('UNKNOWN_ERROR', 'An unknown error occurred');
      }
    }
  }
}
