// src/api-services/dto/WebHighlightDTO.ts
// DTOs for Web Highlight API

export interface AnchorContainer {
  xpath: string;
  offset: number;
}

export interface AnchorTextQuote {
  exact: string;
  prefix: string;
  suffix: string;
}

export interface AnchorTextPosition {
  start: number;
  end: number;
}

export interface AnchorData {
  startContainer: AnchorContainer;
  endContainer: AnchorContainer;
  textQuote: AnchorTextQuote;
  textPosition: AnchorTextPosition;
}

export interface CreateWebHighlightRequest {
  pageUrl: string;
  selectedText: string;
  anchor: AnchorData;
  color?: string;
  note?: string;
}

export interface WebHighlightResponse {
  id: string;
  pageUrl: string;
  selectedText: string;
  anchor: AnchorData;
  color: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetWebHighlightsResponse {
  highlights: WebHighlightResponse[];
}

export interface CreatedWebHighlightResponse {
  highlight: WebHighlightResponse;
}
