import { PDFDocument, PDFPage, degrees } from 'pdf-lib';

export interface CropOptions {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  unit: 'px' | 'pt' | 'mm' | 'in';
}

export interface CropResult {
  originalWidth: number;
  originalHeight: number;
  croppedWidth: number;
  croppedHeight: number;
  pageNumber: number;
  cropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  processingTime: number;
}

export interface MultiCropOptions {
  crops: CropOptions[];
  applyToAllPages?: boolean;
  maintainAspectRatio?: boolean;
}

export class PDFCropService {
  private readonly dpi = 72; // Standard PDF DPI

  async cropPDF(
    fileBytes: Uint8Array,
    options: MultiCropOptions
  ): Promise<{ croppedBytes: Uint8Array; results: CropResult[] }> {
    const startTime = Date.now();
    
    try {
      const pdf = await PDFDocument.load(fileBytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const pages = pdf.getPages();
      const results: CropResult[] = [];

      if (options.applyToAllPages) {
        // Apply the first crop to all pages
        const firstCrop = options.crops[0];
        for (let i = 0; i < pages.length; i++) {
          const result = await this.cropPage(pages[i], firstCrop, i + 1);
          results.push(result);
        }
      } else {
        // Apply specific crops to specific pages
        for (const crop of options.crops) {
          if (crop.pageNumber > 0 && crop.pageNumber <= pages.length) {
            const pageIndex = crop.pageNumber - 1;
            const result = await this.cropPage(pages[pageIndex], crop, crop.pageNumber);
            results.push(result);
          }
        }
      }

      const croppedBytes = await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false,
      });

      const processingTime = Date.now() - startTime;
      results.forEach(result => result.processingTime = processingTime);

      return { croppedBytes, results };

    } catch (error) {
      console.error('PDF cropping failed:', error);
      throw new Error(`Cropping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cropPage(
    page: PDFPage,
    crop: CropOptions,
    pageNumber: number
  ): Promise<CropResult> {
    const startTime = Date.now();
    const { width: originalWidth, height: originalHeight } = page.getSize();
    
    console.log(`Cropping page ${pageNumber}: original=${originalWidth}x${originalHeight}, crop=${crop.x},${crop.y},${crop.width}x${crop.height}`);
    
    // Convert crop coordinates to PDF points if necessary
    const cropInPoints = this.convertToPDFPoints(crop, originalWidth, originalHeight);
    
    console.log(`Converted crop coordinates: ${cropInPoints.x},${cropInPoints.y},${cropInPoints.width}x${cropInPoints.height}`);
    
    // Validate crop area
    this.validateCropArea(cropInPoints, originalWidth, originalHeight);

    // Apply crop by setting the media box and crop box
    // MediaBox defines the boundaries of the physical medium
    page.setMediaBox(
      cropInPoints.x,
      cropInPoints.y,
      cropInPoints.x + cropInPoints.width,
      cropInPoints.y + cropInPoints.height
    );
    
    // CropBox defines the visible page content area
    page.setCropBox(
      cropInPoints.x,
      cropInPoints.y,
      cropInPoints.x + cropInPoints.width,
      cropInPoints.y + cropInPoints.height
    );

    const processingTime = Date.now() - startTime;

    return {
      originalWidth,
      originalHeight,
      croppedWidth: cropInPoints.width,
      croppedHeight: cropInPoints.height,
      pageNumber,
      cropArea: {
        x: cropInPoints.x,
        y: cropInPoints.y,
        width: cropInPoints.width,
        height: cropInPoints.height,
      },
      processingTime,
    };
  }

  private convertToPDFPoints(
    crop: CropOptions,
    pageWidth: number,
    pageHeight: number
  ): CropOptions {
    let x = crop.x;
    let y = crop.y;
    let width = crop.width;
    let height = crop.height;

    switch (crop.unit) {
      case 'px':
        // Convert pixels to points (assuming 72 DPI for PDF, 96 DPI for screen)
        const pxToPt = 72 / 96;
        x *= pxToPt;
        y *= pxToPt;
        width *= pxToPt;
        height *= pxToPt;
        break;
      case 'mm':
        // Convert millimeters to points (1 mm = 2.83465 points)
        const mmToPt = 2.83465;
        x *= mmToPt;
        y *= mmToPt;
        width *= mmToPt;
        height *= mmToPt;
        break;
      case 'in':
        // Convert inches to points (1 inch = 72 points)
        const inToPt = 72;
        x *= inToPt;
        y *= inToPt;
        width *= inToPt;
        height *= inToPt;
        break;
      case 'pt':
        // Already in points, no conversion needed
        break;
    }

    // CRITICAL FIX: Frontend sends coordinates in top-left origin system
    // PDF uses bottom-left origin, so we need to flip Y coordinate
    // The frontend already sends PDF coordinates, so we just need to flip Y
    const flippedY = pageHeight - y - height;

    // Ensure coordinates are within page bounds
    const clampedX = Math.max(0, Math.min(x, pageWidth - width));
    const clampedY = Math.max(0, Math.min(flippedY, pageHeight - height));
    const clampedWidth = Math.max(0, Math.min(width, pageWidth - clampedX));
    const clampedHeight = Math.max(0, Math.min(height, pageHeight - clampedY));

    return {
      ...crop,
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
      unit: 'pt',
    };
  }

  private validateCropArea(
    crop: CropOptions,
    pageWidth: number,
    pageHeight: number
  ): void {
    if (crop.x < 0 || crop.y < 0) {
      throw new Error('Crop area cannot have negative coordinates');
    }

    if (crop.width <= 0 || crop.height <= 0) {
      throw new Error('Crop area must have positive dimensions');
    }

    if (crop.x + crop.width > pageWidth) {
      throw new Error(`Crop area extends beyond page width (${crop.x + crop.width} > ${pageWidth})`);
    }

    if (crop.y + crop.height > pageHeight) {
      throw new Error(`Crop area extends beyond page height (${crop.y + crop.height} > ${pageHeight})`);
    }

    // Minimum size validation (5x5 points for better usability)
    const minSize = 5;
    if (crop.width < minSize || crop.height < minSize) {
      throw new Error(`Crop area too small (minimum ${minSize}x${minSize} points)`);
    }

    // Maximum size validation (cannot be larger than page)
    if (crop.width > pageWidth || crop.height > pageHeight) {
      throw new Error('Crop area cannot be larger than the page');
    }
  }

  async validatePDF(fileBytes: Uint8Array): Promise<boolean> {
    try {
      await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      return true;
    } catch {
      return false;
    }
  }

  async getPageDimensions(fileBytes: Uint8Array): Promise<{ width: number; height: number }[]> {
    try {
      const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      const pages = pdf.getPages();
      
      return pages.map(page => {
        const { width, height } = page.getSize();
        return { width, height };
      });
    } catch (error) {
      console.error('Failed to get page dimensions:', error);
      throw new Error(`Failed to analyze PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}