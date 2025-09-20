import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export interface CompressionOptions {
  quality: 'low' | 'medium' | 'high';
  maxFileSize?: number;
  preserveMetadata?: boolean;
  subsetFonts?: boolean;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  techniquesApplied: string[];
  qualityLevel: string;
  processingTime: number;
}

interface InternalQualitySettings {
  dpi: number;
  jpegQuality: number; // 1-100
  grayscale: boolean;
  chromaSubsampling: '4:4:4' | '4:2:0';
}

export class PDFCompressionService {
  private readonly qualitySettings: Record<CompressionOptions['quality'], InternalQualitySettings> = {
    // Low = maximum compression (smallest size)
    low: {
      dpi: 72,
      jpegQuality: 50,
      grayscale: true,
      chromaSubsampling: '4:2:0',
    },
    // Medium = balanced compression
    medium: {
      dpi: 110,
      jpegQuality: 70,
      grayscale: false,
      chromaSubsampling: '4:2:0',
    },
    // High = minimal compression (best quality)
    high: {
      dpi: 150,
      jpegQuality: 85,
      grayscale: false,
      chromaSubsampling: '4:2:0',
    },
  };

  async compressPDF(
    fileBytes: Uint8Array,
    options: CompressionOptions
  ): Promise<{ compressedBytes: Uint8Array; result: CompressionResult }> {
    const startTime = Date.now();
    const originalSize = fileBytes.length;

    // Validate
    if (!['low', 'medium', 'high'].includes(options.quality)) {
      throw new Error('Invalid quality level');
    }

    // Load original to get page sizes in points
    const srcPdf = await PDFDocument.load(fileBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const settings = this.qualitySettings[options.quality];

    // Create a new PDF and rebuild each page from rasterized images
    const outPdf = await PDFDocument.create();
    const techniquesApplied: string[] = [];

    const pageCount = srcPdf.getPageCount();

    try {
      // For each page render to JPEG via sharp at configured DPI/quality
      for (let i = 0; i < pageCount; i++) {
        const srcPage = srcPdf.getPages()[i];
        const { width, height } = srcPage.getSize(); // points (1/72")

        // Render the i-th page to a JPEG buffer
        let pipeline = sharp(Buffer.from(fileBytes), { density: settings.dpi }).extractPage(i);
        if (settings.grayscale) pipeline = pipeline.grayscale();

        const jpegBuffer = await pipeline
          .jpeg({ quality: settings.jpegQuality, chromaSubsampling: settings.chromaSubsampling })
          .toBuffer();

        // Embed image into new PDF page preserving original page size
        const pageImage = await outPdf.embedJpg(jpegBuffer);
        const page = outPdf.addPage([width, height]);
        const imgWidth = pageImage.width;
        const imgHeight = pageImage.height;

        // Fit image to page keeping aspect ratio
        const scaleX = width / imgWidth;
        const scaleY = height / imgHeight;
        const scale = Math.min(scaleX, scaleY);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;

        page.drawImage(pageImage, {
          x: offsetX,
          y: offsetY,
          width: drawWidth,
          height: drawHeight,
        });
      }

      techniquesApplied.push('page-rasterization');
      techniquesApplied.push('jpeg-compression');
      if (settings.grayscale) techniquesApplied.push('grayscale');
    } catch (e) {
      // Rasterization failed (e.g., PDF rendering not supported). Fallback to lightweight compression.
      const fallback = await this.lightweightCompress(srcPdf, options);
      return fallback;
    }

    // Metadata handling
    if (!options.preserveMetadata) {
      outPdf.setTitle('');
      outPdf.setAuthor('');
      outPdf.setSubject('');
      outPdf.setKeywords([]);
      outPdf.setProducer('');
      outPdf.setCreator('');
      outPdf.setCreationDate(new Date(0));
      outPdf.setModificationDate(new Date(0));
      techniquesApplied.push('metadata-removal');
    }

    const compressedBytes = await outPdf.save({ useObjectStreams: true, addDefaultPage: false });
    const processingTime = Date.now() - startTime;
    const compressionRatio = ((originalSize - compressedBytes.length) / originalSize) * 100;

    const result: CompressionResult = {
      originalSize,
      compressedSize: compressedBytes.length,
      compressionRatio,
      techniquesApplied,
      qualityLevel: options.quality,
      processingTime,
    };

    // Progressive fallback to stronger compression if reduction is too small (except for low)
    if (compressionRatio < 5) {
      const stronger = this.getStrongerSettings(options.quality);
      if (stronger) {
        return this.compressPDF(fileBytes, { ...options, quality: stronger });
      }
    }

    return { compressedBytes, result };
  }

  private getStrongerSettings(level: CompressionOptions['quality']): CompressionOptions['quality'] | null {
    if (level === 'high') return 'medium';
    if (level === 'medium') return 'low';
    return null; // already at strongest
  }

  async validatePDF(fileBytes: Uint8Array): Promise<boolean> {
    try {
      await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      return true;
    } catch {
      return false;
    }
  }

  async estimateCompression(fileBytes: Uint8Array, options: CompressionOptions): Promise<number> {
    const base = fileBytes.length > 10 * 1024 * 1024 ? 20 : 10;
    const bonus = options.quality === 'low' ? 30 : options.quality === 'medium' ? 15 : 5;
    return Math.min(base + bonus, 90);
  }
}
