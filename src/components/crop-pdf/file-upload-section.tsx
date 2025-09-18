'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  onFileUploaded: (file: UploadedFile) => Promise<void>;
  isAnalyzing: boolean;
}

export function FileUploadSection({
  onFileUploaded,
  isAnalyzing,
}: FileUploadSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length !== 1) {
      setUploadError('Please select only one PDF file');
      return;
    }

    const file = acceptedFiles[0];
    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await pdfApi.uploadFiles([file]);
      if (response.success && response.data && response.data.files.length > 0) {
        const uploadedFile = response.data.files[0];
        const fileData: UploadedFile = {
          id: uploadedFile.fileName,
          originalName: uploadedFile.originalName,
          fileName: uploadedFile.fileName,
          filePath: uploadedFile.filePath,
          size: uploadedFile.size,
          originalSize: uploadedFile.size,
          type: uploadedFile.type,
          status: 'uploaded',
          progress: 100,
        };
        await onFileUploaded(fileData);
      } else {
        setUploadError('Failed to upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [onFileUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isAnalyzing || isUploading,
  });

  const isProcessing = isAnalyzing || isUploading;

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
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : isProcessing
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
              : 'border-border hover:border-primary/60'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            {isUploading ? 'Uploading...' :
             isAnalyzing ? 'Analyzing PDF...' : 
             isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}
          </p>
          <p className="text-sm text-muted-foreground">
            {isProcessing ? 'Please wait...' : 'or click to select file'}
          </p>
        </div>
        
        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}