'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pdfApi } from '@/lib/api-client/pdf-api';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { PDF_TOOLS } from '@/lib/constants/tools';
import { ProcessedFile } from '@/types/api';

interface UploadedFile extends ProcessedFile {
  id: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
  originalName: string;
  filePath: string;
}

export default function MergePdfPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [result, setResult] = useState<{ fileName: string; downloadUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    
    // Validate files
    const validation = await pdfApi.validateFiles(acceptedFiles, 'merge');
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    // Add files to state with uploading status
    const newFiles = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      originalName: file.name,
      fileName: '',
      filePath: '',
      size: file.size,
      type: file.type,
      status: 'uploading' as const,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Upload files
    try {
      const uploadResponse = await pdfApi.uploadFiles(acceptedFiles);
      
      if (uploadResponse.success && uploadResponse.data) {
        setUploadDir(uploadResponse.data.uploadDir);
        
        setFiles((prev) => 
          prev.map((file) => {
            const uploadedFile = uploadResponse.data!.files.find(
              (f) => f.originalName === file.originalName
            );
            return uploadedFile
              ? { ...file, ...uploadedFile, status: 'uploaded', progress: 100 }
              : file;
          })
        );
      } else {
        setError(uploadResponse.message || 'Upload failed');
        setFiles((prev) => 
          prev.map((file) => ({ ...file, status: 'error' }))
        );
      }
    } catch {
      setError('Failed to upload files');
      setFiles((prev) => 
        prev.map((file) => ({ ...file, status: 'error' }))
      );
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: PDF_TOOLS.find(t => t.id === 'merge')?.maxFiles || 10,
        maxSize: PDF_TOOLS.find(t => t.id === 'merge')?.maxFileSize || 50 * 1024 * 1024,
  });

  const handleMerge = async () => {
    if (files.filter(f => f.status === 'uploaded').length < 2) {
      setError('Please upload at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      const uploadedFiles = files.filter(f => f.status === 'uploaded');
      
      const response = await pdfApi.mergePdfs({
        files: uploadedFiles,
        uploadDir,
      });

      if (response.success && response.data) {
        setResult({
          fileName: response.data.fileName,
          downloadUrl: response.data.downloadUrl,
        });
        setProcessingProgress(100);
      } else {
        setError(response.message || 'Merge failed');
      }
    } catch {
      setError('Failed to merge PDFs');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result) {
      window.open(result.downloadUrl, '_blank');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    setProcessingProgress(0);
    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const moveFile = (id: string, direction: 'up' | 'down') => {
    setFiles(prev => {
      const index = prev.findIndex(file => file.id === id);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newFiles = [...prev];
      [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
      return newFiles;
    });
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Merge PDF Files</h1>
          <p className="text-lg text-muted-foreground">
            Combine multiple PDF documents into a single file with ease
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Files</CardTitle>
            <CardDescription>
              Drag and drop your PDF files or click to select. Upload at least 2 files to merge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/60'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">
                {isDragActive ? 'Drop files here...' : 'Drag & drop PDF files here'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                or click to select files
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Files to Merge</h3>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">{file.originalName}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'uploading' && (
                          <Progress value={file.progress} className="w-20" />
                        )}
                        {file.status === 'uploaded' && (
                          <>
                            <span className="text-sm text-green-600 flex items-center">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Ready
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveFile(file.id, 'up')}
                                disabled={index === 0}
                              >
                                ↑
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveFile(file.id, 'down')}
                                disabled={index === files.length - 1}
                              >
                                ↓
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(file.id)}
                              >
                                ×
                              </Button>
                            </div>
                          </>
                        )}
                        {file.status === 'error' && (
                          <span className="text-sm text-red-600">Error</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.filter(f => f.status === 'uploaded').length >= 2 && !result && (
              <div className="mt-6">
                <Button
                  onClick={handleMerge}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? 'Merging...' : 'Merge PDFs'}
                </Button>
              </div>
            )}

            {isProcessing && (
              <div className="mt-6">
                <Progress value={processingProgress} className="w-full" />
                <p className="text-center mt-2 text-sm text-muted-foreground">
                  Processing your PDFs...
                </p>
              </div>
            )}

            {result && (
              <div className="mt-6 space-y-4">
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    PDF merged successfully! Your merged file is ready for download.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-3">
                  <Button onClick={handleDownload} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Merged PDF
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Merge More PDFs
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <h4 className="font-semibold mb-2">Fast Processing</h4>
            <p className="text-sm text-muted-foreground">
              Merge PDFs in seconds with our optimized processing
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Secure & Private</h4>
            <p className="text-sm text-muted-foreground">
              Your files are processed securely and deleted after processing
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">No Watermarks</h4>
            <p className="text-sm text-muted-foreground">
              Get clean, professional PDFs without any watermarks
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}