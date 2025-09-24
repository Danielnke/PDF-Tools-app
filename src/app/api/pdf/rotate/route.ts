import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, degrees } from 'pdf-lib';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';
import { withCors, preflight } from '@/lib/api-utils/cors';

export async function OPTIONS() { return preflight(); }

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let filePath: string | null = null;
    let angle: number | null = null;
    let pages: number[] | null = null;
    let originalName: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = (form.get('file') || (form.getAll('files')[0] as any)) as File | null;
      if (file) {
        const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
        await mkdir(uploadDir, { recursive: true });
        const out = join(uploadDir, `${uuidv4()}.pdf`);
        await writeFile(out, Buffer.from(await file.arrayBuffer()));
        filePath = out;
        originalName = file.name;
      }
      const angleField = form.get('angle') as string | null;
      angle = angleField ? Number(angleField) : null;
      const pagesField = form.get('pages') as string | null;
      if (pagesField) {
        try { pages = JSON.parse(pagesField); } catch { pages = pagesField.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)); }
      }
    } else {
      const body = await request.json();
      filePath = body.filePath;
      angle = body.angle;
      pages = body.pages || null;
      originalName = body.originalName;
    }

    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '' || filePath.includes('undefined')) {
      return withCors(NextResponse.json({ error: 'Invalid file path provided' }, { status: 400 }));
    }

    const allowedAngles = new Set([-270, -180, -90, 90, 180, 270, 0]);
    if (typeof angle !== 'number' || !allowedAngles.has(angle)) {
      return withCors(NextResponse.json({ error: 'Angle must be one of -270, -180, -90, 0, 90, 180, 270' }, { status: 400 }));
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
        return withCors(NextResponse.json({ error: 'No valid page numbers provided' }, { status: 400 }));
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
    const outputFileName = buildOutputFileName(originalName, 'rotate-pdf');
    const outputPath = join(outputDir, outputFileName);

    const outBytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
    await writeFile(outputPath, outBytes);

    const dirName = outputDir.split(/[\\/]/).pop() || '';

    return withCors(NextResponse.json({
      success: true,
      message: 'PDF rotated successfully',
      fileName: outputFileName,
      filePath: outputPath,
      rotatedPages: targetPages,
      downloadUrl: `/api/download/${outputFileName}?dir=${dirName}`,
    }));
  } catch (error) {
    console.error('Rotate error:', error);
    let errorMessage = 'Failed to rotate PDF';
    if (error instanceof Error && (error.message.includes('password') || error.message.includes('encrypted'))) {
      errorMessage = 'Cannot rotate password-protected PDF';
    }
    return withCors(NextResponse.json({ error: errorMessage }, { status: 500 }));
  }
}
