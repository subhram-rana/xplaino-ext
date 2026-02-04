// src/api-services/dto/FolderDTO.ts
// DTOs for Folder API

export interface FolderWithSubFoldersResponse {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  subFolders: FolderWithSubFoldersResponse[];
}

export interface GetAllFoldersResponse {
  type: string;
  folders: FolderWithSubFoldersResponse[];
}

export interface CreateFolderRequest {
  name: string;
  parent_folder_id?: string;
}

export interface CreateFolderResponse {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}
