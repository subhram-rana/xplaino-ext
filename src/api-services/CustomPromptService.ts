// src/api-services/CustomPromptService.ts
// Service for managing custom user prompts.

import { ENV } from '@/config/env';
import { ApiHeaders } from './ApiHeaders';
import type {
  CustomPromptResponse,
  GetAllCustomPromptsResponse,
  CreateCustomPromptRequest,
  UpdateCustomPromptRequest,
  CustomPromptShareResponse,
  GetSharedCustomPromptsResponse,
  ShareCustomPromptRequest,
} from './dto/CustomPromptDTO';

function getErrorMessage(errorData: unknown, fallback: string): string {
  if (errorData && typeof errorData === 'object' && 'detail' in errorData) {
    const detail = (errorData as { detail?: unknown }).detail;
    if (detail && typeof detail === 'object' && 'error_message' in detail) {
      return (detail as { error_message: string }).error_message;
    }
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export class CustomPromptService {
  private static readonly BASE_URL = `${ENV.API_BASE_URL}/api/custom-user-prompts`;

  static async listCustomPrompts(
    offset = 0,
    limit = 50
  ): Promise<GetAllCustomPromptsResponse> {
    const url = `${this.BASE_URL}?offset=${offset}&limit=${limit}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to fetch prompts'));
    }

    return response.json();
  }

  static async createCustomPrompt(
    body: CreateCustomPromptRequest
  ): Promise<CustomPromptResponse> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(this.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to create prompt'));
    }

    return response.json();
  }

  static async updateCustomPrompt(
    promptId: string,
    body: UpdateCustomPromptRequest
  ): Promise<CustomPromptResponse> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(`${this.BASE_URL}/${promptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to update prompt'));
    }

    return response.json();
  }

  static async setCustomPromptHidden(
    promptId: string,
    isHidden: boolean
  ): Promise<CustomPromptResponse> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(
      `${this.BASE_URL}/${promptId}/hide?is_hidden=${isHidden}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to update prompt visibility'));
    }

    return response.json();
  }

  static async deleteCustomPrompt(promptId: string): Promise<void> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(`${this.BASE_URL}/${promptId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to delete prompt'));
    }
  }

  static async shareCustomPrompt(
    promptId: string,
    body: ShareCustomPromptRequest
  ): Promise<CustomPromptShareResponse> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(`${this.BASE_URL}/${promptId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to share prompt'));
    }

    return response.json();
  }

  static async listReceivedShares(
    offset = 0,
    limit = 50
  ): Promise<GetSharedCustomPromptsResponse> {
    const url = `${this.BASE_URL}/shares/received?offset=${offset}&limit=${limit}`;
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to fetch received shares'));
    }

    return response.json();
  }

  static async deleteReceivedShare(shareId: string): Promise<void> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(`${this.BASE_URL}/shares/${shareId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to remove share'));
    }
  }

  static async setReceivedShareHidden(
    shareId: string,
    isHidden: boolean
  ): Promise<CustomPromptShareResponse> {
    const authHeaders = await ApiHeaders.getAuthHeaders('CustomPromptService');

    const response = await fetch(
      `${this.BASE_URL}/shares/${shareId}/hide?is_hidden=${isHidden}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(errorData, 'Failed to update share visibility'));
    }

    return response.json();
  }
}
