"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { pdfApi } from '@/lib/api-client/pdf-api';

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

interface ConvertResult {
  fileName: string;
  downloadUrl: string;
}

export default function WordToPdfPage() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setResult(null);
    setProcessingProgress(0);
    setProgressMessage('');

    if (acceptedFiles.length !== 1) {
      setError('Please upload exactly one DOCX file');
      return;
    }

    const fileToUpload = acceptedFiles[0];

    if (fileToUpload.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && !fileToUpload.name.toLowerCase().endsWith('.docx')) {
      setError('Only .docx files are supported');
      return;
    }

    const newFile: UploadedFile = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      originalName: fileToUpload.name,
      fileName: '',
      filePath: '',
      size: fileToUpload.size,
      type: fileToUpload.type,
      status: 'uploading',
      progress: 0,
    };

    setFile(newFile);

    try {
      const uploadProgress = setInterval(() => {
        setFile(prev => prev ? { ...prev, progress: Math.min(prev.progress + 20, 90) } : null);
      }, 200);

      const uploadResult = await pdfApi.uploadFiles([fileToUpload]);
      clearInterval(uploadProgress);

      if (uploadResult.success && uploadResult.data?.files[0]) {
        const uploadedFile = uploadResult.data.files[0];
        setFile({
          ...newFile,
          ...uploadedFile,
          fileName: uploadedFile.fileName,
          status: 'uploaded',
          progress: 100,
        });
        setUploadDir(uploadResult.data.uploadDir);
      } else {
        setError(uploadResult.error || 'Failed to upload file');
        setFile(prev => prev ? { ...prev, status: 'error' } : null);
      }
    } catch (e) {
      setError('Failed to upload file. Please try again.');
      setFile(prev => prev ? { ...prev, status: 'error' } : null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const handleConvert = async () => {
    if (!file || !uploadDir) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProgressMessage('Initializing...');
    setError(null);

    const progressSteps = [
      { progress: 10, message: 'Reading DOCX...' },
      { progress: 35, message: 'Extracting content...' },
      { progress: 70, message: 'Building PDF...' },
      { progress: 95, message: 'Finalizing...' },
    ];

    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < progressSteps.length) {
        setProcessingProgress(progressSteps[currentStep].progress);
        setProgressMessage(progressSteps[currentStep].message);
        currentStep++;
      } else {
        clearInterval(progressInterval);
      }
    }, 800);

    try {
      const res = await pdfApi.convertDocxToPdf({ filePath: `${uploadDir}/${file.fileName}` });
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setProgressMessage('Conversion completed!');

      if (res.success && res.data) {
        setResult({ fileName: (res.data as any).fileName, downloadUrl: (res.data as any).downloadUrl });
      } else {
        setError(res.error || 'Conversion failed');
      }
    } catch (e) {
      clearInterval(progressInterval);
      setError('Conversion failed. Please try again.');
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
    setProgressMessage('');
    setIsProcessing(false);
  };

  const removeFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProcessingProgress(0);
    setProgressMessage('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Word to PDF</h1>
            <p className="text-muted-foreground">Convert your DOCX documents to PDF</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload Word Document
              </CardTitle>
              <CardDescription>Select a .docx file to convert to PDF</CardDescription>
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
                  <p className="text-lg font-medium mb-2">{isDragActive ? 'Drop DOCX here' : 'Drag & drop DOCX here'}</p>
                  <p className="text-sm text-muted-foreground">or click to select file</p>
                </div>
              )}

              {file && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-accent" />
                      <div>
                        <p className="font-medium">{file.originalName}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    {file.status === 'uploading' && (
                      <div className="w-32">
                        <Progress value={file.progress} />
                      </div>
                    )}
                    {file.status === 'uploaded' && (
                      <Button variant="ghost" size="sm" onClick={removeFile} className="text-destructive">
                        Remove
                      </Button>
                    )}
                  </div>

                  {file.status === 'uploaded' && (
                    <div className="space-y-4">
                      <Button onClick={handleConvert} disabled={isProcessing} className="w-full">
                        {isProcessing ? 'Converting...' : 'Convert to PDF'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={processingProgress} />
                  <p className="text-sm text-center text-muted-foreground">{progressMessage} {processingProgress}%</p>
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
                    <AlertDescription>Successfully converted to PDF</AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                    <div>
                      <p className="font-medium">{result.fileName}</p>
                    </div>
                    <Button size="sm" onClick={() => handleDownload(result.downloadUrl, result.fileName)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={handleReset} className="w-full">
                      Convert Another File
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
