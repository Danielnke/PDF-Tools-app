"use client";
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pdfApi } from '@/lib/api-client/pdf-api';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Archive } from 'lucide-react';
import { PDF_TOOLS } from '@/lib/constants/tools';
import { ProcessedFile } from '@/types/api';

interface UploadedFile extends ProcessedFile {
  id: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
  originalSize: number;
  originalName: string;
  filePath: string;
}

interface CompressResult {
  fileName: string;
  downloadUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

export default function CompressPdfPage() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');
  const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'high'>('medium');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setResult(null);
    
    if (acceptedFiles.length !== 1) {
      setError('Please upload exactly one PDF file');
      return;
    }

    const fileToUpload = acceptedFiles[0];
    
    // Validate file
    const validation = await pdfApi.validateFiles([fileToUpload], 'compress');
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    const newFile: UploadedFile = {
      id: crypto.randomUUID(),
      originalName: fileToUpload.name,
      fileName: '',
      filePath: '',
      size: fileToUpload.size,
      originalSize: fileToUpload.size,
      type: fileToUpload.type,
      status: 'uploading' as const,
      progress: 0,
    };

    setFile(newFile);

    try {
      const uploadResult = await pdfApi.uploadFiles([fileToUpload]);

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
        }
    } catch (err) {
      setError('Upload failed. Please try again.');
      setFile(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const handleCompress = async () => {
    if (!file || !uploadDir) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      const result = await pdfApi.compressPdf({
        filePath: `${uploadDir}/${file.fileName}`,
        quality: compressionLevel,
      });

      if (result.success && result.data) {
        setResult({
          fileName: result.data.fileName,
          downloadUrl: result.data.downloadUrl,
          originalSize: file.originalSize,
          compressedSize: result.data.compressedSize,
          compressionRatio: result.data.compressionRatio,
        });
      } else {
        setError(result.error || 'Failed to compress PDF');
      }
    } catch (err) {
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
  };

  const removeFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Compress PDF</h1>
            <p className="text-muted-foreground">
              Reduce your PDF file size while maintaining quality
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Upload PDF to Compress
              </CardTitle>
              <CardDescription>
                Select a PDF file to reduce its file size
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!file && (
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
                  <p className="text-lg font-medium mb-2">
                    {isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to select file
                  </p>
                </div>
              )}

              {file && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-accent" />
                      <div>
                        <p className="font-medium">{file.originalName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.originalSize)}
                        </p>
                      </div>
                    </div>
                    {file.status === 'uploading' && (
                      <div className="w-32">
                        <Progress value={file.progress} />
                      </div>
                    )}
                    {file.status === 'uploaded' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  {file.status === 'uploaded' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Compression Level
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={compressionLevel === 'low' ? 'default' : 'outline'}
                            onClick={() => setCompressionLevel('low')}
                            className="text-sm"
                          >
                            Low
                          </Button>
                          <Button
                            variant={compressionLevel === 'medium' ? 'default' : 'outline'}
                            onClick={() => setCompressionLevel('medium')}
                            className="text-sm"
                          >
                            Medium
                          </Button>
                          <Button
                            variant={compressionLevel === 'high' ? 'default' : 'outline'}
                            onClick={() => setCompressionLevel('high')}
                            className="text-sm"
                          >
                            High
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Higher compression = smaller file size, potentially lower quality
                        </p>
                      </div>

                      <Button
                        onClick={handleCompress}
                        disabled={isProcessing}
                        className="w-full"
                      >
                        {isProcessing ? 'Compressing...' : 'Compress PDF'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={processingProgress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Processing... {processingProgress}%
                  </p>
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
                      Successfully compressed PDF ({Math.round(parseFloat(result.compressionRatio))}% reduction)
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div>
                        <p className="font-medium">{result.fileName}</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Original: {formatFileSize(result.originalSize)}</p>
                          <p>Compressed: {formatFileSize(result.compressedSize)}</p>
                          <p className="text-accent">
                            Saved: {formatFileSize(result.originalSize - result.compressedSize)} ({Math.round(parseFloat(result.compressionRatio))}%)
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(result.downloadUrl, result.fileName)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="w-full"
                    >
                      Compress Another PDF
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <h4 className="font-semibold mb-2">Size Reduction</h4>
              <p className="text-sm text-muted-foreground">
                Up to 90% file size reduction with high compression
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Quality Control</h4>
              <p className="text-sm text-muted-foreground">
                Choose compression level to balance size and quality
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Fast Processing</h4>
              <p className="text-sm text-muted-foreground">
                Compress large PDFs in seconds
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}