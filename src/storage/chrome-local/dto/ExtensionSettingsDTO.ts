// src/storage/chrome-local/dto/ExtensionSettingsDTO.ts

/**
 * Extension settings DTO
 * Stores extension-only settings (per-domain theme overrides)
 */
export interface ExtensionSettingsDTO {
  /** Domain-specific theme overrides */
  domainThemes: Record<string, 'LIGHT' | 'DARK'>;
}

