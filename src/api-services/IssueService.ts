// src/api-services/IssueService.ts
// Service for issue/feature request management

import { ENV } from '@/config/env';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { ApiResponseHandler } from './ApiResponseHandler';
import { ApiErrorHandler } from './ApiErrorHandler';

// Types
export interface IssueResponse {
  id: string;
  ticket_id: string;
  type: string;
  heading: string | null;
  description: string;
  webpage_url: string | null;
  status: string;
  created_by: string;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  file_uploads: FileUploadResponse[];
}

export interface FileUploadResponse {
  id: string;
  file_name: string;
  file_type: string;
  entity_type: string;
  entity_id: string;
  s3_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type IssueType = 'GLITCH' | 'SUBSCRIPTION' | 'AUTHENTICATION' | 'FEATURE_REQUEST' | 'OTHERS';

/**
 * Service for issue/feature request management
 */
export class IssueService {
  private static readonly REPORT_ISSUE_ENDPOINT = '/api/issue/';

  /**
   * Report a feature request
   * @param description - The feature request description (max 1000 characters)
   * @param webpageUrl - Optional current page URL
   * @returns Promise resolving to IssueResponse
   */
  static async reportFeatureRequest(
    description: string,
    webpageUrl?: string
  ): Promise<IssueResponse> {
    return this.reportIssue('FEATURE_REQUEST', description, webpageUrl);
  }

  /**
   * Report an issue
   * @param type - Issue type
   * @param description - Issue description
   * @param webpageUrl - Optional webpage URL
   * @param heading - Optional heading (max 100 characters)
   * @returns Promise resolving to IssueResponse
   */
  static async reportIssue(
    type: IssueType,
    description: string,
    webpageUrl?: string,
    heading?: string
  ): Promise<IssueResponse> {
    const url = `${ENV.API_BASE_URL}${this.REPORT_ISSUE_ENDPOINT}`;

    // Get auth token
    const authInfo = await ChromeStorage.getAuthInfo();
    if (!authInfo?.accessToken) {
      // Trigger login modal
      ApiErrorHandler.triggerLoginRequired();
      throw new Error('Login required');
    }

    // Build form data (API uses multipart/form-data)
    const formData = new FormData();
    formData.append('type', type);
    formData.append('description', description);
    if (webpageUrl) {
      formData.append('webpage_url', webpageUrl);
    }
    if (heading) {
      formData.append('heading', heading);
    }

    // Build headers (don't set Content-Type - browser will set it with boundary)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authInfo.accessToken}`,
    };

    // Add unauthenticated user ID if available
    const unauthenticatedUserId = await ChromeStorage.getUnauthenticatedUserId();
    if (unauthenticatedUserId) {
      headers['X-Unauthenticated-User-Id'] = unauthenticatedUserId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Sync unauthenticated user ID from response headers
      await ApiResponseHandler.syncUnauthenticatedUserId(response, 'IssueService');

      if (!response.ok) {
        // Handle 401 errors
        if (response.status === 401) {
          try {
            const errorBody = await response.clone().json();
            
            // Check for LOGIN_REQUIRED error code
            if (
              errorBody?.errorCode === 'LOGIN_REQUIRED' ||
              errorBody?.detail?.error_code === 'LOGIN_REQUIRED' ||
              (typeof errorBody?.detail === 'object' && errorBody?.detail?.errorCode === 'LOGIN_REQUIRED')
            ) {
              console.log('[IssueService] LOGIN_REQUIRED error detected, triggering login modal');
              ApiErrorHandler.triggerLoginRequired();
              throw new Error('Login required');
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message === 'Login required') {
              throw parseError;
            }
            console.error('[IssueService] Error parsing 401 response:', parseError);
          }
        }

        const errorText = await response.text();
        throw new Error(`Failed to report issue: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[IssueService] Issue reported successfully:', data.ticket_id);
      return data as IssueResponse;
    } catch (error) {
      console.error('[IssueService] Error reporting issue:', error);
      throw error;
    }
  }
}
