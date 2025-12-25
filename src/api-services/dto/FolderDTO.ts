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


