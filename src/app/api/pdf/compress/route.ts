import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { PDFCompressionService } from '@/lib/pdfCompression';

export async function POST(request: NextRequest) {
  let outputDir: string | null = null;
  
  try {
    const { filePath, quality } = await request.json();

    if (!filePath || filePath.trim() === '') {
      return NextResponse.json(
        { error: 'File path is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate quality parameter
    if (!['low', 'medium', 'high'].includes(quality)) {
      return NextResponse.json(
        { error: 'Quality must be one of: low, medium, high' },
        { status: 400 }
      );
    }

    outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });
    
    const outputFileName = `compressed-${uuidv4()}.pdf`;
    const outputPath = join(outputDir, outputFileName);

    try {
      // Use the new PDFCompressionService for pure pdf-lib compression
      const compressionService = new PDFCompressionService();
      const fileBytes = await readFile(filePath);
      
      // Validate PDF before processing
      const isValid = await compressionService.validatePDF(fileBytes);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid or corrupted PDF file' },
          { status: 400 }
        );
      }

      // Compress using quality-based settings
      const { compressedBytes, result } = await compressionService.compressPDF(fileBytes, {
        quality: quality as 'low' | 'medium' | 'high',
        preserveMetadata: false,
        subsetFonts: true,
      });

      await writeFile(outputPath, compressedBytes);

      return NextResponse.json({
        message: 'PDF compressed successfully',
        fileName: `compressed-${uuidv4()}.pdf`,
        filePath: outputPath,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: `${result.compressionRatio.toFixed(2)}%`,
        downloadUrl: `/api/download/${result.compressionRatio.toFixed(2)}%.pdf`,
        qualityLevel: result.qualityLevel,
        techniquesApplied: result.techniquesApplied,
        processingTime: result.processingTime,
      });

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
        
        return NextResponse.json(
          { error: errorMessage },
          { status: statusCode }
        );
    }
  } catch (error) {
    console.error('Error in compression API:', error);
    
    return NextResponse.json(
      { error: 'Internal server error during compression' },
      { status: 500 }
    );
  }
}
