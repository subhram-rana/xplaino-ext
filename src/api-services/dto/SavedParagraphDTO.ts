// src/api-services/dto/SavedParagraphDTO.ts
// DTOs for Saved Paragraph API

export interface SaveParagraphRequest {
  content: string;
  source_url: string;
  name?: string;
  folder_id?: string;
}

export interface SavedParagraphResponse {
  id: string;
  name: string | null;
  source_url: string;
  content: string;
  folder_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateParagraphFolderRequest {
  name: string;
  parent_folder_id?: string;
}

export interface FolderResponse {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

