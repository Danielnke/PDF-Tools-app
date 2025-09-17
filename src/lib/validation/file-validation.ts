import { FILE_TYPES, FILE_EXTENSIONS } from "@/lib/constants/file-types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FileValidationOptions {
  acceptedTypes: string[];
  maxFileSize: number;
  maxFiles?: number;
}

export function validateFile(file: File, options: FileValidationOptions): ValidationResult {
  const errors: string[] = [];

  // Check file type
  if (!options.acceptedTypes.includes(file.type)) {
    const acceptedExtensions = getAcceptedExtensions(options.acceptedTypes);
    errors.push(`Invalid file type. Accepted types: ${acceptedExtensions.join(', ')}`);
  }

  // Check file size
  if (file.size > options.maxFileSize) {
    const maxSizeMB = Math.round(options.maxFileSize / (1024 * 1024));
    errors.push(`File size too large. Maximum size: ${maxSizeMB}MB`);
  }

  // Check for empty files
  if (file.size === 0) {
    errors.push('File is empty');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateFiles(files: File[], options: FileValidationOptions): ValidationResult {
  const errors: string[] = [];

  // Check number of files
  if (options.maxFiles && files.length > options.maxFiles) {
    errors.push(`Too many files. Maximum allowed: ${options.maxFiles}`);
  }

  // Validate each file
  files.forEach((file, index) => {
    const fileValidation = validateFile(file, options);
    if (!fileValidation.isValid) {
      fileValidation.errors.forEach(error => {
        errors.push(`File ${index + 1} (${file.name}): ${error}`);
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getAcceptedExtensions(mimeTypes: string[]): string[] {
  const extensions: string[] = [];
  
  mimeTypes.forEach(mimeType => {
    switch (mimeType) {
      case FILE_TYPES.PDF:
        extensions.push(...FILE_EXTENSIONS.PDF);
        break;
      case FILE_TYPES.JPEG:
      case FILE_TYPES.PNG:
        extensions.push(...FILE_EXTENSIONS.IMAGE);
        break;
      case FILE_TYPES.DOCX:
      case FILE_TYPES.XLSX:
      case FILE_TYPES.PPTX:
        extensions.push(...FILE_EXTENSIONS.OFFICE);
        break;
    }
  });

  return [...new Set(extensions)]; // Remove duplicates
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string): string {
  switch (mimeType) {
    case FILE_TYPES.PDF:
      return '📄';
    case FILE_TYPES.JPEG:
    case FILE_TYPES.PNG:
      return '🖼️';
    case FILE_TYPES.DOCX:
      return '📝';
    case FILE_TYPES.XLSX:
      return '📊';
    case FILE_TYPES.PPTX:
      return '📋';
    default:
      return '📁';
  }
}