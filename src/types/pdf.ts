export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  uploadTime: Date;
  thumbnailUrl?: string;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentOperation: string;
  progress: number;
  estimatedTime?: number;
}

export interface ProcessingResult {
  id: string;
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
  processingTime: number;
}

export interface ProcessingOptions {
  quality?: number;           // 0.1 - 1.0 for compression
  pages?: number[];          // Specific pages to process
  password?: string;         // For protected PDFs
  watermark?: WatermarkOptions;
  encryption?: EncryptionOptions;
}

export interface WatermarkOptions {
  text?: string;
  image?: File;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
}

export interface EncryptionOptions {
  userPassword?: string;
  ownerPassword?: string;
  permissions: PDFPermissions;
}

export interface PDFPermissions {
  printing: boolean;
  modifying: boolean;
  copying: boolean;
  annotating: boolean;
}

export interface PDFTool {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  features: string[];
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes: string[];
}

export interface AppState {
  currentTool: string;
  uploadedFiles: UploadedFile[];
  processingStatus: ProcessingStatus;
  results: ProcessingResult[];
  errors: string[];
}