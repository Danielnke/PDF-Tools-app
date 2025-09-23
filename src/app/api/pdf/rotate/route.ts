import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, degrees } from 'pdf-lib';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';

export async function POST(request: NextRequest) {
  try {
    const { filePath, angle, pages, originalName } = await request.json();

    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '' || filePath.includes('undefined')) {
      return NextResponse.json({ error: 'Invalid file path provided' }, { status: 400 });
    }

    const allowedAngles = new Set([-270, -180, -90, 90, 180, 270, 0]);
    if (typeof angle !== 'number' || !allowedAngles.has(angle)) {
      return NextResponse.json({ error: 'Angle must be one of -270, -180, -90, 0, 90, 180, 270' }, { status: 400 });
    }

    const fileBytes = await readFile(filePath);
    const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });

    const totalPages = pdf.getPageCount();

    let targetPages: number[];
    if (Array.isArray(pages) && pages.length > 0) {
      // Validate page numbers are integers within range
      targetPages = pages
        .map((p) => Number(p))
        .filter((p) => Number.isInteger(p) && p >= 1 && p <= totalPages);
      if (targetPages.length === 0) {
        return NextResponse.json({ error: 'No valid page numbers provided' }, { status: 400 });
      }
    } else {
      targetPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Normalize angle to 0..359
    const normAngle = ((angle % 360) + 360) % 360;

    for (const pageNumber of targetPages) {
      const page = pdf.getPage(pageNumber - 1);
      const currentRotation = page.getRotation().angle ?? 0;
      const newAngle = ((currentRotation + normAngle) % 360 + 360) % 360;
      page.setRotation(degrees(newAngle));
    }

    const outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });
    const outputFileName = buildOutputFileName(originalName, 'rotate');
    const outputPath = join(outputDir, outputFileName);

    const outBytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
    await writeFile(outputPath, outBytes);

    const dirName = outputDir.split(/[\\/]/).pop() || '';

    return NextResponse.json({
      success: true,
      message: 'PDF rotated successfully',
      fileName: outputFileName,
      filePath: outputPath,
      rotatedPages: targetPages,
      downloadUrl: `/api/download/${outputFileName}?dir=${dirName}`,
    });
  } catch (error) {
    console.error('Rotate error:', error);
    let errorMessage = 'Failed to rotate PDF';
    if (error instanceof Error && (error.message.includes('password') || error.message.includes('encrypted'))) {
      errorMessage = 'Cannot rotate password-protected PDF';
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
