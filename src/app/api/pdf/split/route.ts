import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { sanitizeBaseName } from '@/lib/api-utils/pdf-helpers';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { withCors, preflight } from '@/lib/api-utils/cors';

export async function OPTIONS() { return preflight(); }

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let filePath: string | null = null;
    let splitMode: string | null = null;
    let ranges: string[] | null = null;
    let pageNumbers: number[] | null = null;
    let originalName: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const primary = form.get('file');
      const fallback = form.getAll('files').find((v) => v instanceof File) ?? null;
      const file = (primary instanceof File ? primary : (fallback instanceof File ? fallback : null));
      splitMode = (form.get('splitMode') as string) || null;
      originalName = file?.name;
      const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
      await mkdir(uploadDir, { recursive: true });
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf') {
          return withCors(NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 }));
        }
        const out = join(uploadDir, `${uuidv4()}.pdf`);
        await writeFile(out, Buffer.from(await file.arrayBuffer()));
        filePath = out;
      }
      const rangesField = form.get('ranges') as string | null;
      const pagesField = form.get('pageNumbers') as string | null;
      if (rangesField) {
        try { ranges = JSON.parse(rangesField); } catch { ranges = rangesField.split(',').map(s => s.trim()).filter(Boolean); }
      }
      if (pagesField) {
        try { pageNumbers = JSON.parse(pagesField); } catch { pageNumbers = pagesField.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)); }
      }
    } else {
      const body = await request.json();
      filePath = body.filePath;
      splitMode = body.splitMode;
      ranges = body.ranges || null;
      pageNumbers = body.pageNumbers || null;
      originalName = body.originalName;
    }

    if (!filePath || filePath.trim() === '' || filePath.includes('undefined')) {
      return withCors(NextResponse.json(
        { error: 'Invalid file path provided' },
        { status: 400 }
      ));
    }

    const fileBytes = await readFile(filePath);
    const pdf = await PDFDocument.load(fileBytes);
    const totalPages = pdf.getPageCount();

    const outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });

    const splitFiles = [];

    const base = sanitizeBaseName(originalName || 'Document');
    let fileCounter = 1;

    if (splitMode === 'ranges' && ranges) {
      // Split by page ranges
      for (const range of ranges) {
        const [start, end] = range.split('-').map(Number);
        if (start < 1 || end > totalPages || start > end) {
          return withCors(NextResponse.json(
            { error: `Invalid range: ${range}` },
            { status: 400 }
          ));
        }

        const newPdf = await PDFDocument.create();
        const pagesToCopy = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
        const copiedPages = await newPdf.copyPages(pdf, pagesToCopy);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const fileName = `${base} (split-pdf)-${fileCounter++}.pdf`;
        const filePath = join(outputDir, fileName);
        await writeFile(filePath, await newPdf.save());

        splitFiles.push({
          fileName,
          filePath,
          pages: `${start}-${end}`,
        });
      }
    } else if (splitMode === 'individual') {
      // Split into individual pages
      const pageNumbersToSplit = pageNumbers || Array.from({length: totalPages}, (_, i) => i + 1);
      
      for (const pageNum of pageNumbersToSplit) {
        if (pageNum < 1 || pageNum > totalPages) {
          return withCors(NextResponse.json(
            { error: `Invalid page number: ${pageNum}` },
            { status: 400 }
          ));
        }

        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdf, [pageNum - 1]);
        newPdf.addPage(copiedPage);

        const fileName = `${base} (split-pdf)-${fileCounter++}.pdf`;
        const filePath = join(outputDir, fileName);
        await writeFile(filePath, await newPdf.save());

        splitFiles.push({
          fileName,
          filePath,
          pages: `${pageNum}`,
        });
      }
    } else {
      return withCors(NextResponse.json(
        { error: 'Invalid split mode or missing parameters' },
        { status: 400 }
      ));
    }

    const files = splitFiles.map(file => ({
      fileName: file.fileName,
      filePath: file.filePath,
      pages: file.pages,
      size: 0, // Will be calculated by frontend if needed
      type: 'application/pdf'
    }));
    


    return withCors(NextResponse.json({
      success: true,
      data: {
        files,
        outputDir: basename(outputDir)
      },
      message: 'PDF split successfully',
    }));

  } catch (error) {
    console.error('Split error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to split PDF' },
      { status: 500 }
    ));
  }
}
