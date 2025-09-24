import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { withCors, preflight } from '@/lib/api-utils/cors';

export async function OPTIONS() { return preflight(); }

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let files: Array<{ filePath: string; originalName: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const incomingFiles = form.getAll('files') as File[];
      if (!incomingFiles || incomingFiles.length < 2) {
        return withCors(NextResponse.json(
          { error: 'At least 2 files are required for merging' },
          { status: 400 }
        ));
      }
      const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
      await mkdir(uploadDir, { recursive: true });
      for (const f of incomingFiles) {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf') {
          return withCors(NextResponse.json(
            { error: `Only PDF files are supported. Invalid file: ${f.name}` },
            { status: 400 }
          ));
        }
        const fileName = `${uuidv4()}.pdf`;
        const path = join(uploadDir, fileName);
        const buf = Buffer.from(await f.arrayBuffer());
        await writeFile(path, buf);
        files.push({ filePath: path, originalName: f.name });
      }
    } else {
      const body = await request.json();
      files = body.files || [];
    }

    if (!files || files.length < 2) {
      return withCors(NextResponse.json(
        { error: 'At least 2 files are required for merging' },
        { status: 400 }
      ));
    }

    const mergedPdf = await PDFDocument.create();

    for (const fileInfo of files) {
      const filePath = fileInfo.filePath;
      
      if (!filePath || filePath.trim() === '' || filePath.includes('undefined')) {
        return withCors(NextResponse.json(
          { error: 'Invalid file path provided' },
          { status: 400 }
        ));
      }
      
      const fileBytes = await readFile(filePath);
      
      try {
        const pdf = await PDFDocument.load(fileBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing file ${fileInfo.originalName}:`, error);
        return withCors(NextResponse.json(
          { error: `Invalid PDF file: ${fileInfo.originalName}` },
          { status: 400 }
        ));
      }
    }

    const mergedPdfBytes = await mergedPdf.save();

    // Create output file
    const outputFileName = buildOutputFileName(files[0]?.originalName, 'merge-pdf');
    const outputPath = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputPath, { recursive: true });
    await writeFile(join(outputPath, outputFileName), mergedPdfBytes);

    // Clean up temporary files
    for (const fileInfo of files) {
      try {
        await unlink(fileInfo.filePath);
      } catch {
        console.warn(`Could not delete temp file: ${fileInfo.filePath}`);
      }
    }

    const dirName = outputPath.split(/[\\/]/).pop() || '';

    return withCors(NextResponse.json({
      message: 'PDFs merged successfully',
      fileName: outputFileName,
      filePath: join(outputPath, outputFileName),
      downloadUrl: `/api/download/${outputFileName}?dir=${dirName}`,
    }));

  } catch (error) {
    console.error('Merge error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to merge PDFs' },
      { status: 500 }
    ));
  }
}
