import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
  try {
    const { filePath, splitMode, ranges, pageNumbers } = await request.json();

    if (!filePath || filePath.trim() === '' || filePath.includes('undefined')) {
      return NextResponse.json(
        { error: 'Invalid file path provided' },
        { status: 400 }
      );
    }

    const fileBytes = await readFile(filePath);
    const pdf = await PDFDocument.load(fileBytes);
    const totalPages = pdf.getPageCount();

    const outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });

    const splitFiles = [];

    if (splitMode === 'ranges' && ranges) {
      // Split by page ranges
      for (const range of ranges) {
        const [start, end] = range.split('-').map(Number);
        if (start < 1 || end > totalPages || start > end) {
          return NextResponse.json(
            { error: `Invalid range: ${range}` },
            { status: 400 }
          );
        }

        const newPdf = await PDFDocument.create();
        const pagesToCopy = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
        const copiedPages = await newPdf.copyPages(pdf, pagesToCopy);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const fileName = `split-${start}-${end}.pdf`;
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
          return NextResponse.json(
            { error: `Invalid page number: ${pageNum}` },
            { status: 400 }
          );
        }

        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdf, [pageNum - 1]);
        newPdf.addPage(copiedPage);

        const fileName = `page-${pageNum}.pdf`;
        const filePath = join(outputDir, fileName);
        await writeFile(filePath, await newPdf.save());

        splitFiles.push({
          fileName,
          filePath,
          pages: `${pageNum}`,
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid split mode or missing parameters' },
        { status: 400 }
      );
    }

    const files = splitFiles.map(file => ({
      fileName: file.fileName,
      filePath: file.filePath,
      pages: file.pages,
      size: 0, // Will be calculated by frontend if needed
      type: 'application/pdf'
    }));
    


    return NextResponse.json({
      success: true,
      data: { 
        files,
        outputDir: basename(outputDir)
      },
      message: 'PDF split successfully',
    });

  } catch (error) {
    console.error('Split error:', error);
    return NextResponse.json(
      { error: 'Failed to split PDF' },
      { status: 500 }
    );
  }
}