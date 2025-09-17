import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
  try {
    const { files, uploadDir } = await request.json();

    if (!files || files.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 files are required for merging' },
        { status: 400 }
      );
    }

    const mergedPdf = await PDFDocument.create();

    for (const fileInfo of files) {
      const filePath = fileInfo.filePath;
      
      if (!filePath || filePath.trim() === '' || filePath.includes('undefined')) {
        return NextResponse.json(
          { error: 'Invalid file path provided' },
          { status: 400 }
        );
      }
      
      const fileBytes = await readFile(filePath);
      
      try {
        const pdf = await PDFDocument.load(fileBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing file ${fileInfo.originalName}:`, error);
        return NextResponse.json(
          { error: `Invalid PDF file: ${fileInfo.originalName}` },
          { status: 400 }
        );
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    
    // Create output file
    const outputFileName = `merged-${uuidv4()}.pdf`;
    const outputPath = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputPath, { recursive: true });
    await writeFile(join(outputPath, outputFileName), mergedPdfBytes);

    // Clean up temporary files
    for (const fileInfo of files) {
      try {
        await unlink(fileInfo.filePath);
      } catch (error) {
        console.warn(`Could not delete temp file: ${fileInfo.filePath}`);
      }
    }

    return NextResponse.json({
      message: 'PDFs merged successfully',
      fileName: outputFileName,
      filePath: join(outputPath, outputFileName),
      downloadUrl: `/api/download/${outputFileName}`,
    });

  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json(
      { error: 'Failed to merge PDFs' },
      { status: 500 }
    );
  }
}