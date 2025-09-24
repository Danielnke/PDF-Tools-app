import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';
import { withCors, preflight } from '@/lib/api-utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() { return preflight(); }

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

export async function POST(request: NextRequest) {
  let browser: puppeteer.Browser | null = null;
  try {
    const contentType = request.headers.get('content-type') || '';

    let mode: 'url' | 'html-file' | 'html-string' | null = null;
    let url: string | null = null;
    let htmlString: string | null = null;
    let originalName: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const urlField = form.get('url');
      const htmlField = form.get('html');
      const primary = form.get('file');
      const fallback = form.getAll('files').find((v) => v instanceof File) ?? null;
      const file = (primary instanceof File ? primary : (fallback instanceof File ? fallback : null));

      if (typeof urlField === 'string' && urlField.trim()) {
        url = urlField.trim();
        mode = 'url';
      } else if (typeof htmlField === 'string' && htmlField.trim()) {
        htmlString = htmlField;
        mode = 'html-string';
      } else if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        htmlString = buf.toString('utf-8');
        originalName = file.name;
        mode = 'html-file';
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (body && typeof body.url === 'string' && body.url.trim()) {
        url = body.url.trim();
        mode = 'url';
      } else if (body && typeof body.html === 'string' && body.html.trim()) {
        htmlString = body.html;
        originalName = body.originalName;
        mode = 'html-string';
      }
    }

    if (!mode) {
      return withCors(NextResponse.json({ error: 'Provide either `url`, `html`, or an HTML `file`' }, { status: 400 }));
    }

    if (mode === 'url' && (!url || !isHttpUrl(url))) {
      return withCors(NextResponse.json({ error: 'Invalid URL. Only http/https supported.' }, { status: 400 }));
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Reasonable PDF defaults
    const pdfOptions = {
      format: 'A4' as const,
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      preferCSSPageSize: false,
    };

    if (mode === 'url' && url) {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    } else if (htmlString) {
      // Inject <base> if a baseUrl was given for resolving relative paths
      let content = htmlString;
      const baseUrl = (() => {
        try {
          const u = new URL(originalName || '');
          return u.href;
        } catch { return undefined; }
      })();

      if (baseUrl && !/\<base\s/i.test(content)) {
        content = content.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<base href="${baseUrl}">`);
      }

      await page.setContent(content, { waitUntil: 'networkidle0' });
    }

    const pdfBuffer = await page.pdf(pdfOptions);

    const outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });

    const baseName = mode === 'url' && url ? new URL(url).hostname : originalName || 'Document';
    const outputFileName = buildOutputFileName(baseName, 'html-pdf');
    const outputPath = join(outputDir, outputFileName);

    await writeFile(outputPath, pdfBuffer);

    const dirName = outputDir.split(/[\\/]/).pop() || '';

    return withCors(NextResponse.json({
      message: 'Converted to PDF successfully',
      fileName: outputFileName,
      filePath: outputPath,
      downloadUrl: `/api/download/${outputFileName}?dir=${dirName}`,
    }));
  } catch (error) {
    console.error('HTML to PDF error:', error);
    return withCors(NextResponse.json({ error: 'Failed to convert HTML/URL to PDF' }, { status: 500 }));
  } finally {
    try { await browser?.close(); } catch {}
  }
}
