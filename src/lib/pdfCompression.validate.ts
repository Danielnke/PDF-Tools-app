import { PDFDocument } from 'pdf-lib';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    pageCount: number;
    fileSize: number;
    hasImages: boolean;
    hasFonts: boolean;
    isEncrypted: boolean;
    pdfVersion: string;
  };
}

export class PDFValidationService {
  async validatePDF(fileBytes: Uint8Array): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata = {
      pageCount: 0,
      fileSize: fileBytes.length,
      hasImages: false,
      hasFonts: false,
      isEncrypted: false,
      pdfVersion: 'unknown',
    };

    try {
      // Check file size limits
      if (fileBytes.length === 0) {
        errors.push('File is empty');
        return { isValid: false, errors, warnings, metadata };
      }

      if (fileBytes.length > 100 * 1024 * 1024) { // 100MB limit
        errors.push('File size exceeds 100MB limit');
        return { isValid: false, errors, warnings, metadata };
      }

      // Try to load PDF
      let pdf;
      try {
        pdf = await PDFDocument.load(fileBytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
      } catch {
        errors.push('Invalid PDF format or corrupted file');
        return { isValid: false, errors, warnings, metadata };
      }

      // Check encryption
      const isEncrypted = pdf.isEncrypted;
      if (isEncrypted) {
        errors.push('Encrypted PDF files are not supported');
        return { isValid: false, errors, warnings, metadata };
      }

      // Get PDF metadata
      metadata.pageCount = pdf.getPageCount();
      metadata.isEncrypted = isEncrypted;
      metadata.pdfVersion = this.detectPDFVersion(fileBytes);

      // Check page count
      if (metadata.pageCount === 0) {
        errors.push('PDF contains no pages');
        return { isValid: false, errors, warnings, metadata };
      }

      if (metadata.pageCount > 1000) {
        warnings.push('Large document detected - processing may take longer');
      }

      // Check for images and fonts
      metadata.hasImages = await this.hasImages();
      metadata.hasFonts = await this.hasFonts();

      // Additional warnings
      if (metadata.fileSize > 50 * 1024 * 1024) {
        warnings.push('Large file - processing may take several minutes');
      }

      if (metadata.pageCount > 100) {
        warnings.push('Document has many pages - consider splitting for better performance');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata,
      };

    } catch (error) {
      errors.push('Failed to validate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return { isValid: false, errors, warnings, metadata };
    }
  }

  private detectPDFVersion(fileBytes: Uint8Array): string {
    try {
      const header = new TextDecoder().decode(fileBytes.slice(0, 10));
      const match = header.match(/%PDF-(\d\.\d)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async hasImages(): Promise<boolean> {
    try {
      // Simplified check - assume PDFs with reasonable size likely have images
      return true;
    } catch {
      return false;
    }
  }

  private async hasFonts(): Promise<boolean> {
    try {
      // Simplified check - assume PDFs have fonts
      return true;
    } catch {
      return false;
    }
  }

  validateCompressionOptions(options: unknown): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!options || typeof options !== 'object') {
      errors.push('Invalid options object');
      return { isValid: false, errors };
    }

    const opts = options as Record<string, unknown>;

    if (!['low', 'medium', 'high'].includes(opts.quality as string)) {
      errors.push('Quality must be one of: low, medium, high');
    }

    if (opts.maxFileSize !== undefined && 
        (typeof opts.maxFileSize !== 'number' || opts.maxFileSize <= 0)) {
      errors.push('maxFileSize must be a positive number');
    }

    if (opts.preserveMetadata !== undefined && typeof opts.preserveMetadata !== 'boolean') {
      errors.push('preserveMetadata must be a boolean');
    }

    if (opts.subsetFonts !== undefined && typeof opts.subsetFonts !== 'boolean') {
      errors.push('subsetFonts must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async estimateCompressionRatio(fileBytes: Uint8Array): Promise<number> {
    try {
      const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      
      let estimatedRatio = 10; // Base 10% compression

      // Increase based on file size
      if (fileBytes.length > 10 * 1024 * 1024) estimatedRatio += 15;
      if (fileBytes.length > 50 * 1024 * 1024) estimatedRatio += 10;

      // Increase based on page count
      const pageCount = pdf.getPageCount();
      if (pageCount > 50) estimatedRatio += 5;
      if (pageCount > 100) estimatedRatio += 5;

      // Cap at reasonable maximum
      return Math.min(estimatedRatio, 90);

    } catch {
      return 10; // Default fallback
    }
  }
}

export const pdfValidationService = new PDFValidationService();