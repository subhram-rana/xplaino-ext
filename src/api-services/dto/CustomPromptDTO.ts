// src/api-services/dto/CustomPromptDTO.ts
// DTOs for custom user prompts

export interface CustomPromptResponse {
  id: string;
  userId: string;
  title: string;
  description: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetAllCustomPromptsResponse {
  prompts: CustomPromptResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface CreateCustomPromptRequest {
  title: string;
  description: string;
}

export interface UpdateCustomPromptRequest {
  title?: string;
  description?: string;
}

export interface CustomPromptShareResponse {
  id: string;
  customUserPromptId: string;
  sharedTo: string;
  isHidden: boolean;
  createdAt: string;
  prompt: CustomPromptResponse;
}

export interface GetSharedCustomPromptsResponse {
  shares: CustomPromptShareResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface ShareCustomPromptRequest {
  sharedToUserId: string;
}
