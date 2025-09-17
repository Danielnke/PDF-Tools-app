// API Request and Response Types

// Upload API Types
export interface UploadRequest {
  files: File[];
}

export interface UploadResponse {
  message: string;
  files: ProcessedFile[];
  uploadDir: string;
}

// PDF Processing Types
export interface ProcessedFile {
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  type: string;
}

export interface MergeRequest {
  files: ProcessedFile[];
  uploadDir: string;
}

export interface MergeResponse {
  message: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
}

export interface SplitRequest {
  filePath: string;
  splitMode: 'ranges' | 'individual';
  ranges?: string[]; // e.g., ["1-3", "4-6"]
  pageNumbers?: number[]; // e.g., [1, 2, 3]
}

export interface SplitResponse {
  message: string;
  data: {
    files: Array<{
      fileName: string;
      filePath: string;
      pages: string;
      size?: number;
      type?: string;
    }>;
    outputDir?: string;
  };
}

export interface CompressRequest {
  filePath: string;
  quality: 'low' | 'medium' | 'high';
}

export interface CompressResponse {
  message: string;
  fileName: string;
  filePath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  downloadUrl: string;
}

export interface ConvertRequest {
  filePath: string;
  targetFormat: string;
  options?: Record<string, any>;
}

export interface ConvertResponse {
  message: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
}

// General API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// File Validation Types
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Progress Types
export interface ProcessingProgress {
  step: string;
  progress: number; // 0-100
  message: string;
}

// Tool Configuration Types
export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  supportedFormats: string[];
  maxFileSize: number; // in bytes
  maxFiles: number;
  options?: Record<string, any>;
}

// Error Response Types
export interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

// Validation Types
export interface ValidationRequest {
  files: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  toolId: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  supportedFormats: string[];
}

// Rate Limit Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// File Info Types
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  extension: string;
  lastModified?: Date;
}

// Processing Status Types
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ProcessingJob {
  id: string;
  status: ProcessingStatus;
  toolId: string;
  files: FileInfo[];
  progress: number;
  result?: {
    files: Array<{
      name: string;
      url: string;
      size: number;
    }>;
    downloadUrl?: string;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}