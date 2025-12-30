// src/api-services/dto/SavedImageDTO.ts
// DTOs for Saved Image API

export interface SaveImageRequest {
  sourceUrl: string;
  imageUrl: string;
  folderId?: string;
  name?: string;
}

export interface SavedImageResponse {
  id: string;
  sourceUrl: string;
  imageUrl: string;
  name: string | null;
  folderId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    name: string;
  };
}

