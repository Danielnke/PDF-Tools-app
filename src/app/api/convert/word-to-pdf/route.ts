import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';
import { withCors, preflight } from '@/lib/api-utils/cors';

// Simple text wrapping utility
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      // Long single words fallback: hard break
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          const testChunk = chunk + ch;
          if (font.widthOfTextAtSize(testChunk, fontSize) > maxWidth) {
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else {
            chunk = testChunk;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function OPTIONS() { return preflight(); }

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let filePath: string | null = null;
    let originalName: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const primary = form.get('file');
      const fallback = form.getAll('files').find((v) => v instanceof File) ?? null;
      const file = (primary instanceof File ? primary : (fallback instanceof File ? fallback : null));
      const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
      await mkdir(uploadDir, { recursive: true });
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const out = join(uploadDir, `${uuidv4()}.${ext || 'docx'}`);
        await writeFile(out, Buffer.from(await file.arrayBuffer()));
        filePath = out;
        originalName = file.name;
      }
    } else {
      const body = await request.json();
      filePath = body.filePath;
      originalName = body.originalName;
    }

    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '' || filePath.includes('undefined')) {
      return withCors(NextResponse.json({ error: 'Invalid file path provided' }, { status: 400 }));
    }

    if (!filePath.toLowerCase().endsWith('.docx')) {
      return withCors(NextResponse.json({ error: 'Only .docx files are supported for conversion' }, { status: 400 }));
    }

    const fileBuffer = await readFile(filePath);

    // Extract raw text from DOCX
    const { value: rawText } = await mammoth.extractRawText({ buffer: fileBuffer });
    if (!rawText || rawText.trim() === '') {
      return withCors(NextResponse.json({ error: 'Could not extract text from the DOCX file' }, { status: 400 }));
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // A4 page size (points)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const fontSize = 12;
    const lineHeight = fontSize * 1.25;
    const usableWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Split into paragraphs by newline blocks
    const paragraphs = rawText.replace(/\r\n/g, '\n').split(/\n\n+/);

    for (const para of paragraphs) {
      const normalized = para.replace(/\s+/g, ' ').trim();
      if (!normalized) {
        // Paragraph spacing
        y -= lineHeight;
        continue;
      }

      const lines = wrapText(normalized, font, fontSize, usableWidth);
      for (const line of lines) {
        if (y - lineHeight < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, {
          x: margin,
          y: y - lineHeight,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
      }

      // Paragraph spacing
      y -= lineHeight * 0.5;
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });

    // Save to temp results dir
    const outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });
    const outputFileName = buildOutputFileName(originalName, 'word-pdf');
    const outputPath = join(outputDir, outputFileName);

    await writeFile(outputPath, pdfBytes);

    const dirName = outputDir.split(/[\\/]/).pop() || '';

    return withCors(NextResponse.json({
      message: 'Converted DOCX to PDF successfully',
      fileName: outputFileName,
      filePath: outputPath,
      downloadUrl: `/api/download/${outputFileName}?dir=${dirName}`,
    }));
  } catch (error) {
    console.error('Word to PDF conversion error:', error);
    let errorMessage = 'Failed to convert DOCX to PDF';
    if (error instanceof Error) errorMessage = error.message;
    return withCors(NextResponse.json({ error: errorMessage }, { status: 500 }));
  }
}
