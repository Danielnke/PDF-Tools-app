'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pdfApi } from '@/lib/api-client/pdf-api';
import { Upload, Download, RotateCw, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Document, Page } from 'react-pdf';

interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  type: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
}

interface RotateResult {
  fileName: string;
  downloadUrl: string;
  rotatedPages: number[];
}

function parsePages(input: string): number[] {
  const pages = new Set<number>();
  const trimmed = input.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      pages.add(parseInt(part, 10));
    } else if (/^\d+-\d+$/.test(part)) {
      const [start, end] = part.split('-').map(n => parseInt(n, 10));
      if (start <= end) {
        for (let i = start; i <= end; i++) pages.add(i);
      }
    }
  }
  return Array.from(pages).sort((a,b) => a-b);
}

export default function RotatePdfPage() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [result, setResult] = useState<RotateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');
  const [angle, setAngle] = useState<number>(90);
  const [pagesInput, setPagesInput] = useState<string>('');

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [previewPage, setPreviewPage] = useState<number>(1);

  // Configure PDF.js worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('react-pdf').then(({ pdfjs }) => {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }).catch(() => {});
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setResult(null);
    setProcessingProgress(0);

    if (acceptedFiles.length !== 1) {
      setError('Please upload exactly one PDF file');
      return;
    }

    const pdfFile = acceptedFiles[0];
    if (!pdfFile.type.includes('pdf')) {
      setError('Please select a valid PDF file');
      return;
    }

    const newFile: UploadedFile = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      originalName: pdfFile.name,
      fileName: '',
      filePath: '',
      size: pdfFile.size,
      type: pdfFile.type,
      status: 'uploading',
      progress: 0,
    };

    setFile(newFile);

    try {
      const uploadProgress = setInterval(() => {
        setFile(prev => prev ? { ...prev, progress: Math.min(prev.progress + 20, 90) } : null);
      }, 200);

      const uploadResult = await pdfApi.uploadFiles([pdfFile]);
      clearInterval(uploadProgress);

      if (uploadResult.success && uploadResult.data?.files[0]) {
        const uploadedFile = uploadResult.data.files[0];
        setFile({
          ...newFile,
          ...uploadedFile,
          fileName: uploadedFile.fileName,
          filePath: uploadedFile.filePath,
          status: 'uploaded',
          progress: 100,
        });
        setUploadDir(uploadResult.data.uploadDir);
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (e) {
      setFile(prev => prev ? { ...prev, status: 'error' } : null);
      setError('Failed to upload file. Please try again.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleRotate = async () => {
    if (!file || !uploadDir) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    const progressSteps = [10, 35, 70, 90];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < progressSteps.length) {
        setProcessingProgress(progressSteps[idx]);
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 600);

    try {
      const pages = parsePages(pagesInput);
      const response = await pdfApi.rotatePdf({
        filePath: file.filePath,
        angle,
        pages: pages.length > 0 ? pages : undefined,
      });

      clearInterval(interval);
      setProcessingProgress(100);

      if (response.success && response.data) {
        setResult({
          fileName: (response.data as any).fileName,
          downloadUrl: (response.data as any).downloadUrl,
          rotatedPages: (response.data as any).rotatedPages || [],
        });
      } else {
        setError(response.message || 'Failed to rotate PDF');
      }
    } catch (e) {
      clearInterval(interval);
      setError('Processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (downloadUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProcessingProgress(0);
    setIsProcessing(false);
    setPagesInput('');
    setAngle(90);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Rotate PDF</h1>
            <p className="text-muted-foreground">Rotate selected pages or the whole document in 90° steps</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCw className="h-5 w-5" />
                Upload PDF to Rotate
              </CardTitle>
              <CardDescription>Select a PDF, choose rotation and pages, then apply</CardDescription>
            </CardHeader>
            <CardContent>
              {!file && (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">{isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}</p>
                  <p className="text-sm text-muted-foreground mt-2">or click to select file</p>
                </div>
              )}

              {file && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-accent" />
                      <div>
                        <p className="font-medium">{file.originalName}</p>
                        <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    {file.status === 'uploading' && (
                      <div className="w-32">
                        <Progress value={file.progress} />
                      </div>
                    )}
                    {file.status === 'uploaded' && (
                      <Button variant="ghost" size="sm" onClick={handleReset} className="text-destructive">
                        Remove
                      </Button>
                    )}
                  </div>

                  {file.status === 'uploaded' && !result && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Rotation</label>
                        <div className="grid grid-cols-4 gap-2">
                          <Button variant={angle === 90 ? 'default' : 'outline'} onClick={() => setAngle(90)} disabled={isProcessing}>
                            90° CW
                          </Button>
                          <Button variant={angle === -90 ? 'default' : 'outline'} onClick={() => setAngle(-90)} disabled={isProcessing}>
                            90° CCW
                          </Button>
                          <Button variant={angle === 180 ? 'default' : 'outline'} onClick={() => setAngle(180)} disabled={isProcessing}>
                            180°
                          </Button>
                          <Button variant={angle === 0 ? 'default' : 'outline'} onClick={() => setAngle(0)} disabled={isProcessing}>
                            0°
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Pages (optional)</label>
                        <input
                          type="text"
                          value={pagesInput}
                          onChange={(e) => setPagesInput(e.target.value)}
                          placeholder="e.g., 1,3-5"
                          className="w-full px-3 py-2 border rounded-md"
                          disabled={isProcessing}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Leave empty to rotate all pages</p>
                      </div>

                      <Button onClick={handleRotate} disabled={isProcessing} className="w-full">
                        {isProcessing ? 'Applying...' : 'Apply Rotation'}
                      </Button>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={processingProgress} />
                      <p className="text-sm text-center text-muted-foreground">Processing... {processingProgress}%</p>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {result && (
                    <div className="space-y-4">
                      <Alert className="bg-green-500/10 border-green-500/20">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Rotation applied successfully to {result.rotatedPages.length} page{result.rotatedPages.length !== 1 ? 's' : ''}.
                        </AlertDescription>
                      </Alert>

                      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                        <div>
                          <p className="font-medium">{result.fileName}</p>
                          <p className="text-sm text-muted-foreground">Ready to download</p>
                        </div>
                        <Button size="sm" onClick={() => handleDownload(result.downloadUrl, result.fileName)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>

                      <div className="flex gap-4">
                        <Button variant="outline" onClick={handleReset} className="w-full">
                          Rotate Another PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <h4 className="font-semibold mb-2">90° Increments</h4>
              <p className="text-sm text-muted-foreground">Rotate clockwise, counter-clockwise, or 180°</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Selected Pages</h4>
              <p className="text-sm text-muted-foreground">Target specific pages or apply to all</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Fast & Secure</h4>
              <p className="text-sm text-muted-foreground">Changes happen locally on the server, then auto-delete</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
