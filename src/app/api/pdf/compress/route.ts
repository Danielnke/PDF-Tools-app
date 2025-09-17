import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { filePath, quality } = await request.json();

    if (!filePath || filePath.trim() === '') {
      return NextResponse.json(
        { error: 'File path is required and cannot be empty' },
        { status: 400 }
      );
    }

    // For compression, we'll use Ghostscript if available, otherwise basic optimization
    const outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });
    
    const outputPath = join(outputDir, `compressed-${uuidv4()}.pdf`);

    try {
      // Try using Ghostscript for compression
      const qualitySettings = {
        low: '/screen',
        medium: '/ebook',
        high: '/printer',
        default: '/ebook',
      };

      const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${qualitySettings[quality as keyof typeof qualitySettings] || qualitySettings.default} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${filePath}"`;
      
      await execAsync(gsCommand);
      
      // Read the compressed file
      const compressedBytes = await readFile(outputPath);
      const originalBytes = await readFile(filePath);
      
      const compressionRatio = ((originalBytes.length - compressedBytes.length) / originalBytes.length * 100).toFixed(2);

      return NextResponse.json({
        message: 'PDF compressed successfully',
        fileName: `compressed-${uuidv4()}.pdf`,
        filePath: outputPath,
        originalSize: originalBytes.length,
        compressedSize: compressedBytes.length,
        compressionRatio: `${compressionRatio}%`,
        downloadUrl: `/api/download/${outputPath.split('/').pop()}`,
      });

    } catch (gsError) {
      console.warn('Ghostscript not available, falling back to basic PDF optimization');
      
      // Fallback: Basic PDF optimization using pdf-lib
      const { PDFDocument } = await import('pdf-lib');
      const fileBytes = await readFile(filePath);
      const pdf = await PDFDocument.load(fileBytes);
      
      // Basic optimization: remove unused objects and compress streams
      const optimizedBytes = await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      await writeFile(outputPath, optimizedBytes);
      
      const originalBytes = await readFile(filePath);
      const compressionRatio = ((originalBytes.length - optimizedBytes.length) / originalBytes.length * 100).toFixed(2);

      return NextResponse.json({
        message: 'PDF optimized successfully',
        fileName: `optimized-${uuidv4()}.pdf`,
        filePath: outputPath,
        originalSize: originalBytes.length,
        compressedSize: optimizedBytes.length,
        compressionRatio: `${compressionRatio}%`,
        downloadUrl: `/api/download/${outputPath.split('/').pop()}`,
      });
    }

  } catch (error) {
    console.error('Compression error:', error);
    return NextResponse.json(
      { error: 'Failed to compress PDF' },
      { status: 500 }
    );
  }
}