import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';

export interface ProcessedFile {
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  type: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export class PdfProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = join(tmpdir(), 'pdf-tools');
  }

  async createTempDir(): Promise<string> {
    const dir = join(this.tempDir, uuidv4());
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async loadPdf(filePath: string): Promise<PDFDocument> {
    const fileBytes = await readFile(filePath);
    return PDFDocument.load(fileBytes);
  }

  async savePdf(pdf: PDFDocument, outputPath: string): Promise<void> {
    const pdfBytes = await pdf.save();
    await writeFile(outputPath, pdfBytes);
  }

  async mergePdfs(filePaths: string[]): Promise<string> {
    const mergedPdf = await PDFDocument.create();
    
    for (const filePath of filePaths) {
      const pdf = await this.loadPdf(filePath);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const outputDir = await this.createTempDir();
    const outputPath = join(outputDir, `merged-${uuidv4()}.pdf`);
    await this.savePdf(mergedPdf, outputPath);

    return outputPath;
  }

  async splitPdf(filePath: string, pageRanges: string[]): Promise<string[]> {
    const pdf = await this.loadPdf(filePath);
    const totalPages = pdf.getPageCount();
    const outputDir = await this.createTempDir();
    const outputFiles: string[] = [];

    for (const range of pageRanges) {
      const [start, end] = range.split('-').map(Number);
      
      if (start < 1 || end > totalPages || start > end) {
        throw new Error(`Invalid range: ${range}`);
      }

      const newPdf = await PDFDocument.create();
      const pagesToCopy = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
      const copiedPages = await newPdf.copyPages(pdf, pagesToCopy);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const outputPath = join(outputDir, `split-${start}-${end}-${uuidv4()}.pdf`);
      await this.savePdf(newPdf, outputPath);
      outputFiles.push(outputPath);
    }

    return outputFiles;
  }

  async getFileStats(filePath: string): Promise<{
    size: number;
    pageCount: number;
  }> {
    const stats = await import('fs/promises').then(fs => fs.stat(filePath));
    const pdf = await this.loadPdf(filePath);
    
    return {
      size: stats.size,
      pageCount: pdf.getPageCount(),
    };
  }

  async cleanup(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await unlink(filePath);
      } catch {
        console.warn(`Could not delete file: ${filePath}`);
      }
    }
  }
}

export const validateFileType = (fileName: string, allowedTypes: string[]): boolean => {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  return allowedTypes.includes(fileExtension || '');
};

export const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const createApiResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
  error?: string
): ApiResponse<T> => ({
  success,
  message,
  data,
  error,
});

// File naming helpers
export function sanitizeBaseName(name: string): string {
  const trimmed = name.replace(/\.[^./\\]+$/i, '').trim();
  // Remove illegal filename characters and collapse spaces
  return trimmed.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').slice(0, 200);
}

export function buildOutputFileName(originalName: string | undefined | null, suffix: string, extension: string = 'pdf'): string {
  const base = sanitizeBaseName(originalName || 'Document');
  return `${base} (${suffix}).${extension}`;
}

// Rate limiting utility
export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const record = this.requests.get(identifier);
    if (!record || Date.now() > record.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - record.count);
  }
}
