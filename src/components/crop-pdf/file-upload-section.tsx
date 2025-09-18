'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pdfApi } from '@/lib/api-client/pdf-api';

interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  originalSize: number;
  type: string;
  status: 'uploading' | 'uploaded' | 'processing';
  progress: number;
}

interface FileUploadSectionProps {
  onFileDrop: (files: File[]) => Promise<void>;
  isAnalyzing: boolean;
}

export function FileUploadSection({
  onFileDrop,
  isAnalyzing,
}: FileUploadSectionProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length !== 1) {
      return;
    }
    await onFileDrop(acceptedFiles);
  }, [onFileDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isAnalyzing,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload PDF to Crop
        </CardTitle>
        <CardDescription>
          Select a PDF file and define crop areas for each page
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : isAnalyzing
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-border hover:border-primary/60'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            {isAnalyzing ? 'Validating file...' : 
             isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}
          </p>
          <p className="text-sm text-muted-foreground">
            {isAnalyzing ? 'Checking file format and size...' : 'or click to select file'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}