'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, Archive, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { pdfApi } from '@/lib/api-client/pdf-api';

interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  originalSize: number;
  type: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
}

interface CompressResult {
  fileName: string;
  downloadUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  techniquesApplied?: string[];
  processingTime?: number;
  qualityLevel?: string;
}

export default function CompressPdfPage() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');
  const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isValidating, setIsValidating] = useState(false);
  // const { toast, setToast } = useToast(); // Disabled temporarily for deployment
  const setToast = (options: { title: string; description: string; variant?: string }) => console.log('Toast:', options);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setResult(null);
    setProcessingProgress(0);
    setProgressMessage('');
    setIsValidating(true);
    
    if (acceptedFiles.length !== 1) {
      setError('Please upload exactly one PDF file');
      setIsValidating(false);
      return;
    }

    const fileToUpload = acceptedFiles[0];
    
    // Validate file
    const validation = await pdfApi.validateFiles([fileToUpload], 'compress');
    setIsValidating(false);
    
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    const newFile: UploadedFile = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
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
      // Simulate upload progress
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
        }
    } catch {
      setToast({
        title: 'Error',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
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
    setProgressMessage('Initializing...');
    setError(null);

    // Simulate progress updates
    const progressSteps = [
      { progress: 10, message: 'Starting compression...' },
      { progress: 30, message: 'Analyzing PDF structure...' },
      { progress: 60, message: 'Compressing images...' },
      { progress: 80, message: 'Optimizing content...' },
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
    }, 1000);

    try {
      const result = await pdfApi.compressPdf({
        filePath: `${uploadDir}/${file.fileName}`,
        quality: compressionLevel,
        originalName: file.originalName,
      });

      clearInterval(progressInterval);
      setProcessingProgress(100);
      setProgressMessage('Compression completed!');

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
    } catch {
      clearInterval(progressInterval);
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
                      : isValidating
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-border hover:border-primary/60'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    {isValidating ? 'Validating file...' : 
                     isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isValidating ? 'Checking file format and size...' : 'or click to select file'}
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
                          Compression Quality
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={compressionLevel === 'low' ? 'default' : 'outline'}
                            onClick={() => setCompressionLevel('low')}
                            className="w-full"
                            disabled={isProcessing}
                          >
                            <div className="text-center">
                              <div className="font-medium">Low</div>
                              <div className="text-xs">50% quality</div>
                            </div>
                          </Button>
                          <Button
                            variant={compressionLevel === 'medium' ? 'default' : 'outline'}
                            onClick={() => setCompressionLevel('medium')}
                            className="w-full"
                            disabled={isProcessing}
                          >
                            <div className="text-center">
                              <div className="font-medium">Medium</div>
                              <div className="text-xs">75% quality</div>
                            </div>
                          </Button>
                          <Button
                            variant={compressionLevel === 'high' ? 'default' : 'outline'}
                            onClick={() => setCompressionLevel('high')}
                            className="w-full"
                            disabled={isProcessing}
                          >
                            <div className="text-center">
                              <div className="font-medium">High</div>
                              <div className="text-xs">90% quality</div>
                            </div>
                          </Button>
                        </div>
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Quality Details:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• <strong>Low:</strong> Maximum compression, smaller file size</li>
                          <li>• <strong>Medium:</strong> Balanced compression with font subsetting</li>
                          <li>• <strong>High:</strong> Minimal compression, preserves original quality</li>
                        </ul>
                        </div>
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
                    {progressMessage} {processingProgress}%
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

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-card p-3 rounded-md border">
                        <div className="text-sm text-muted-foreground">Original Size</div>
                        <div className="text-lg font-bold">{formatFileSize(result.originalSize)}</div>
                      </div>
                      <div className="bg-card p-3 rounded-md border">
                        <div className="text-sm text-muted-foreground">Compressed Size</div>
                        <div className="text-lg font-bold">{formatFileSize(result.compressedSize)}</div>
                      </div>
                    </div>
                    
                    <div className="bg-card p-3 rounded-md border">
                      <div className="text-sm text-muted-foreground">Compression Achieved</div>
                      <div className="text-2xl font-bold text-green-600">{result.compressionRatio}</div>
                    </div>

                    {result.techniquesApplied && (
                      <div className="bg-card p-3 rounded-md border">
                        <div className="text-sm font-medium mb-2">Techniques Applied:</div>
                        <div className="flex flex-wrap gap-2">
                          {result.techniquesApplied.map((technique: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {technique.replace('-', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.processingTime && (
                      <div className="text-xs text-muted-foreground text-center">
                        Processed in {result.processingTime}ms
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div>
                        <p className="font-medium">{result.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          Saved {formatFileSize(result.originalSize - result.compressedSize)} ({Math.round(parseFloat(result.compressionRatio))}%)
                        </p>
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
