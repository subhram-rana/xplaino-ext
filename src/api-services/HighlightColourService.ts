// src/api-services/HighlightColourService.ts
// Service for fetching available highlight colours.
// This endpoint is public — no authentication required.

import { ENV } from '@/config/env';

export interface HighlightColour {
  id: string;
  hexcode: string;
}

export class HighlightColourService {
  private static readonly ENDPOINT = '/api/highlight/colours';

  /**
   * Fetch all available highlight colours from the backend.
   * Public endpoint — no auth headers needed.
   */
  static async getColours(): Promise<HighlightColour[]> {
    const url = `${ENV.API_BASE_URL}${this.ENDPOINT}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch highlight colours: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.colours as HighlightColour[];
  }
}
