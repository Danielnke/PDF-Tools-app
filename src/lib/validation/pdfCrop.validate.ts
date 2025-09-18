import { CropOptions, MultiCropOptions } from '@/lib/pdfCrop';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PDFCropValidator {
  private static readonly MIN_CROP_SIZE = 10; // Minimum crop size in points
  private static readonly MAX_CROP_SIZE = 14400; // Maximum crop size in points (200 inches)
  private static readonly SUPPORTED_UNITS = ['px', 'pt', 'mm', 'in'] as const;
  private static readonly COORDINATE_PRECISION = 2; // Decimal places for coordinates

  static validateCropOptions(options: CropOptions): ValidationResult {
    const errors: string[] = [];

    // Validate page number
    if (!Number.isInteger(options.pageNumber) || options.pageNumber < 1) {
      errors.push('Page number must be a positive integer');
    }

    // Validate coordinates
    if (typeof options.x !== 'number' || isNaN(options.x)) {
      errors.push('X coordinate must be a valid number');
    }

    if (typeof options.y !== 'number' || isNaN(options.y)) {
      errors.push('Y coordinate must be a valid number');
    }

    // Validate dimensions
    if (typeof options.width !== 'number' || isNaN(options.width) || options.width <= 0) {
      errors.push('Width must be a positive number');
    }

    if (typeof options.height !== 'number' || isNaN(options.height) || options.height <= 0) {
      errors.push('Height must be a positive number');
    }

    // Validate unit
    if (!this.SUPPORTED_UNITS.includes(options.unit)) {
      errors.push(`Unit must be one of: ${this.SUPPORTED_UNITS.join(', ')}`);
    }

    // Validate minimum size
    if (options.width < this.MIN_CROP_SIZE || options.height < this.MIN_CROP_SIZE) {
      errors.push(`Crop dimensions must be at least ${this.MIN_CROP_SIZE} points`);
    }

    // Validate maximum size
    if (options.width > this.MAX_CROP_SIZE || options.height > this.MAX_CROP_SIZE) {
      errors.push(`Crop dimensions cannot exceed ${this.MAX_CROP_SIZE} points`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateMultiCropOptions(options: MultiCropOptions): ValidationResult {
    const errors: string[] = [];

    // Validate crops array
    if (!Array.isArray(options.crops) || options.crops.length === 0) {
      errors.push('At least one crop option is required');
      return { isValid: false, errors };
    }

    // Validate each crop option
    const pageNumbers = new Set<number>();
    for (let i = 0; i < options.crops.length; i++) {
      const crop = options.crops[i];
      const cropValidation = this.validateCropOptions(crop);
      
      if (!cropValidation.isValid) {
        errors.push(`Crop ${i + 1}: ${cropValidation.errors.join(', ')}`);
      }

      // Check for duplicate page numbers when not applying to all pages
      if (!options.applyToAllPages) {
        if (pageNumbers.has(crop.pageNumber)) {
          errors.push(`Crop ${i + 1}: Duplicate page number ${crop.pageNumber}`);
        }
        pageNumbers.add(crop.pageNumber);
      }
    }

    // Validate boolean options
    if (typeof options.applyToAllPages !== 'boolean') {
      errors.push('applyToAllPages must be a boolean');
    }

    if (typeof options.maintainAspectRatio !== 'boolean') {
      errors.push('maintainAspectRatio must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateFilePath(filePath: string): ValidationResult {
    const errors: string[] = [];

    if (!filePath || filePath.trim() === '') {
      errors.push('File path is required');
      return { isValid: false, errors };
    }

    if (typeof filePath !== 'string') {
      errors.push('File path must be a string');
      return { isValid: false, errors };
    }

    // Basic path validation
    if (filePath.length > 500) {
      errors.push('File path is too long');
    }

    // Check for invalid characters (exclude colon for Windows paths)
    // Windows invalid chars: < > " | ? * and control characters
    // Unix invalid chars: null character
    const invalidChars = /[<>"|?*\x00-\x1f]/;
    if (invalidChars.test(filePath)) {
      errors.push('File path contains invalid characters');
    }

    // Check for path traversal attempts
    if (filePath.includes('..')) {
      errors.push('File path contains invalid sequence');
    }

    // Additional validation for common path formats
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (normalizedPath.includes('//')) {
      errors.push('File path contains double slashes');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validatePageRange(pageNumbers: number[], totalPages: number): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      errors.push('Page numbers array is required');
      return { isValid: false, errors };
    }

    for (const pageNum of pageNumbers) {
      if (!Number.isInteger(pageNum) || pageNum < 1) {
        errors.push(`Invalid page number: ${pageNum}`);
        continue;
      }

      if (pageNum > totalPages) {
        errors.push(`Page number ${pageNum} exceeds total pages (${totalPages})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static sanitizeCropOptions(options: CropOptions): CropOptions {
    return {
      ...options,
      x: Math.max(0, Math.round(options.x * 100) / 100), // Round to 2 decimal places
      y: Math.max(0, Math.round(options.y * 100) / 100),
      width: Math.max(this.MIN_CROP_SIZE, Math.round(options.width * 100) / 100),
      height: Math.max(this.MIN_CROP_SIZE, Math.round(options.height * 100) / 100),
      pageNumber: Math.max(1, Math.floor(options.pageNumber)),
    };
  }

  static getValidationRules(): Record<string, number | readonly string[]> {
    return {
      minCropSize: this.MIN_CROP_SIZE,
      maxCropSize: this.MAX_CROP_SIZE,
      supportedUnits: this.SUPPORTED_UNITS,
      coordinatePrecision: this.COORDINATE_PRECISION
    };
  }
}