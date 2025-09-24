import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { PDFCompressionService } from '@/lib/pdfCompression';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';
import { withCors, preflight } from '@/lib/api-utils/cors';

export async function OPTIONS() { return preflight(); }

export async function POST(request: NextRequest) {
  let outputDir: string | null = null;
  
  try {
    const contentType = request.headers.get('content-type') || '';
    let filePath: string | null = null;
    let quality: string | null = null;
    let originalName: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const primary = form.get('file');
      const fallback = form.getAll('files').find((v) => v instanceof File) ?? null;
      const file = (primary instanceof File ? primary : (fallback instanceof File ? fallback : null));
      const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
      await mkdir(uploadDir, { recursive: true });
      if (file) {
        const out = join(uploadDir, `${uuidv4()}.pdf`);
        await writeFile(out, Buffer.from(await file.arrayBuffer()));
        filePath = out;
        originalName = file.name;
      }
      quality = (form.get('quality') as string) || null;
    } else {
      const body = await request.json();
      filePath = body.filePath;
      quality = body.quality;
      originalName = body.originalName;
    }

    if (!filePath || filePath.trim() === '') {
      return withCors(NextResponse.json(
        { error: 'File path is required and cannot be empty' },
        { status: 400 }
      ));
    }

    // Validate quality parameter
    if (!['low', 'medium', 'high'].includes(quality)) {
      return withCors(NextResponse.json(
        { error: 'Quality must be one of: low, medium, high' },
        { status: 400 }
      ));
    }

    outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });
    
    const outputFileName = buildOutputFileName(originalName, 'compress-pdf');
    const outputPath = join(outputDir, outputFileName);

    try {
      // Use the new PDFCompressionService for pure pdf-lib compression
      const compressionService = new PDFCompressionService();
      const fileBytes = await readFile(filePath);
      
      // Validate PDF before processing
      const isValid = await compressionService.validatePDF(fileBytes);
      if (!isValid) {
        return withCors(NextResponse.json(
          { error: 'Invalid or corrupted PDF file' },
          { status: 400 }
        ));
      }

      // Compress using quality-based settings
      const { compressedBytes, result } = await compressionService.compressPDF(fileBytes, {
        quality: quality as 'low' | 'medium' | 'high',
        preserveMetadata: false,
        subsetFonts: true,
      });

      await writeFile(outputPath, compressedBytes);

      const dirName = outputDir.split(/[\\/]/).pop() || '';
      return withCors(NextResponse.json({
        message: 'PDF compressed successfully',
        fileName: outputFileName,
        filePath: outputPath,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: `${result.compressionRatio.toFixed(2)}%`,
        downloadUrl: `/api/download/${outputFileName}?dir=${dirName}`,
        qualityLevel: result.qualityLevel,
        techniquesApplied: result.techniquesApplied,
        processingTime: result.processingTime,
      }));

    } catch (compressionError) {
        console.error('Error compressing PDF:', compressionError);
        
        // Cleanup on error
        if (outputDir) {
          try {
            await rm(outputDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.warn('Error cleaning up temporary directory:', cleanupError);
          }
        }
        
        // Provide detailed error messages based on error type
        let errorMessage = 'Failed to compress PDF';
        let statusCode = 500;
        
        if (compressionError instanceof Error) {
          const error = compressionError as Error;
          
          if (error.message.includes('password') || error.message.includes('encrypted')) {
            errorMessage = 'Cannot compress password-protected PDF';
            statusCode = 400;
          } else if (error.message.includes('corrupt') || error.message.includes('invalid')) {
            errorMessage = 'Invalid or corrupted PDF file';
            statusCode = 400;
          } else if (error.message.includes('memory') || error.message.includes('size')) {
            errorMessage = 'PDF file is too large to process';
            statusCode = 413;
          } else {
            errorMessage = error.message;
          }
        }
        
        return withCors(NextResponse.json(
          { error: errorMessage },
          { status: statusCode }
        ));
    }
  } catch (error) {
    console.error('Error in compression API:', error);
    
    return withCors(NextResponse.json(
      { error: 'Internal server error during compression' },
      { status: 500 }
    ));
  }
}
