import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate files
    const validFiles = files.filter(file => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx', 'pptx'].includes(fileExtension || '');
    });

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid files provided' },
        { status: 400 }
      );
    }

    // Create temporary directory for uploads
    const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];

    for (const file of validFiles) {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = join(uploadDir, fileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      await writeFile(filePath, buffer);

      uploadedFiles.push({
        originalName: file.name,
        fileName,
        filePath,
        size: file.size,
        type: file.type,
      });
    }

    return NextResponse.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      uploadDir,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}