// src/api-services/dto/WebNoteDTO.ts
// TypeScript interfaces mirroring the backend Pydantic models for web notes.

import type { AnchorData } from './WebHighlightDTO';

export interface CreateWebNoteRequest {
  pageUrl: string;
  selectedText: string;
  anchor: AnchorData;
  content: string;
}

export interface UpdateWebNoteRequest {
  content: string;
}

export interface WebNoteResponse {
  id: string;
  pageUrl: string;
  selectedText: string;
  anchor: AnchorData;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetWebNotesResponse {
  notes: WebNoteResponse[];
}

export interface WebNoteWriteResponse {
  note: WebNoteResponse | null;
}
