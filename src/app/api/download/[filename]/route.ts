import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, readdirSync, Dirent } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const url = new URL(request.url);
    const outputDir = url.searchParams.get('dir');
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Security check: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    let filePath = null;
    
    // If outputDir is provided, try that first
    if (outputDir) {
      const dirPath = join(tmpdir(), 'pdf-tools-results', outputDir);
      const fullPath = join(dirPath, filename);
      if (existsSync(fullPath)) {
        filePath = fullPath;
      }
    }
    
    // If not found, search in common directories
    if (!filePath) {
      const searchPaths = [
        join(tmpdir(), 'pdf-tools-results'),
        join(tmpdir(), 'pdf-tools-uploads'),
      ];
      
      // First, check the immediate directories
      for (const basePath of searchPaths) {
        const fullPath = join(basePath, filename);
        if (existsSync(fullPath)) {
          filePath = fullPath;
          break;
        }
      }
      
      // If not found, check subdirectories
      if (!filePath) {
        for (const basePath of searchPaths) {
          if (!existsSync(basePath)) continue;
          
          try {
            const dirs = readdirSync(basePath, { withFileTypes: true })
              .filter((dirent: Dirent) => dirent.isDirectory())
              .map((dirent: Dirent) => dirent.name);
              
            for (const dir of dirs) {
              const filePathToCheck = join(basePath, dir, filename);
              if (existsSync(filePathToCheck)) {
                filePath = filePathToCheck;
                break;
              }
            }
            if (filePath) break;
          } catch (err) {
            console.warn(`Error reading directory ${basePath}:`, err);
          }
        }
      }
    }

    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    
    const contentTypes: { [key: string]: string } = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      zip: 'application/zip',
    };

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentTypes[fileExtension || 'pdf'] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}