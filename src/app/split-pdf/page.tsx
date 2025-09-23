'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pdfApi } from '@/lib/api-client/pdf-api';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Scissors } from 'lucide-react';
import { PDF_TOOLS } from '@/lib/constants/tools';
import { ProcessedFile } from '@/types/api';

interface UploadedFile extends ProcessedFile {
  id: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
  originalName: string;
  filePath: string;
}

interface SplitResult {
  fileName: string;
  downloadUrl: string;
  pages: string;
  filePath: string;
}

export default function SplitPdfPage() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [results, setResults] = useState<SplitResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');
  const [outputDir, setOutputDir] = useState<string>('');
  const [splitMode, setSplitMode] = useState<'range' | 'individual'>('individual');
  const [pageRanges, setPageRanges] = useState<string>('');

  const handleDownload = async (downloadUrl: string, fileName: string) => {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file. Please try again.');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResults([]);
    setError(null);
    setPageRanges('');
    setProcessingProgress(0);
  };

  const removeFile = () => {
    setFile(null);
    setResults([]);
    setError(null);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) return;
    
    const pdfFile = acceptedFiles[0];
    
    // Validate file
    if (!pdfFile.type.includes('pdf')) {
      setError('Please select a valid PDF file');
      return;
    }

    const fileId = Date.now().toString();
    const newFile: UploadedFile = {
      id: fileId,
      originalName: pdfFile.name,
      fileName: pdfFile.name,
      filePath: '',
      size: pdfFile.size,
      type: pdfFile.type,
      status: 'uploading',
      progress: 0
    };

    setFile(newFile);

    try {
      const uploadResult = await pdfApi.uploadFiles([pdfFile]);
      if (uploadResult.success && uploadResult.data?.files && uploadResult.data.files.length > 0) {
        const uploadedFile = uploadResult.data.files[0];
        setFile(prev => prev ? {
          ...prev,
          status: 'uploaded',
          progress: 100,
          fileName: uploadedFile.fileName,
          size: uploadedFile.size,
          type: 'application/pdf',
          filePath: uploadedFile.filePath
        } : null);
        setUploadDir(uploadResult.data.uploadDir || '');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      setFile(prev => prev ? { ...prev, status: 'error' } : null);
      setError('Failed to upload file. Please try again.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleSplit = async () => {
    if (!file || !uploadDir) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      console.log('Split request:', {
        filePath: file.filePath,
        splitMode: splitMode === 'range' ? 'ranges' : 'individual',
        ranges: splitMode === 'range' ? pageRanges.split(',').map(range => range.trim()) : undefined,
      });

      const result = await pdfApi.splitPdf({
        filePath: file.filePath,
        splitMode: splitMode === 'range' ? 'ranges' : 'individual',
        ranges: splitMode === 'range' ? pageRanges.split(',').map(range => range.trim()) : undefined,
        originalName: file.originalName,
      });

      console.log('Split result:', result);


      if (result.success && result.data?.data?.files && result.data.data.files.length > 0) {
        const outputDirectory = result.data.data.outputDir || '';
        const splitResults: SplitResult[] = result.data.data.files.map((f: { fileName: string; filePath: string; pages: string }) => ({
          fileName: f.fileName,
          downloadUrl: `/api/download/${f.fileName}${outputDirectory ? `?dir=${outputDirectory}` : ''}`,
          pages: f.pages || '1',
          filePath: f.filePath || ''
        }));
        setResults(splitResults);
        if (outputDirectory) {
          setOutputDir(outputDirectory);
        }
      } else {
        console.error('Split failed - no files returned:', result);
        throw new Error(result.message || 'Split failed - no files were created');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split PDF');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Split PDF</h1>
          <p className="text-lg text-muted-foreground">
            Split your PDF into multiple files by page ranges or individual pages
          </p>
        </div>

        {!file ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload PDF File</CardTitle>
              <CardDescription>
                Drag and drop your PDF file here or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop PDF here' : 'Drag & drop PDF here'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  or click to select file
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>File Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{file.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>

            {file.status === 'uploaded' && results.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Split Options</CardTitle>
                  <CardDescription>
                    Choose how you want to split your PDF
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Split Mode</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="individual"
                          checked={splitMode === 'individual'}
                          onChange={(e) => setSplitMode(e.target.value as 'individual')}
                          className="mr-2"
                        />
                        Individual Pages
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="range"
                          checked={splitMode === 'range'}
                          onChange={(e) => setSplitMode(e.target.value as 'range')}
                          className="mr-2"
                        />
                        Page Ranges
                      </label>
                    </div>
                  </div>

                  {splitMode === 'range' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Page Ranges</label>
                      <input
                        type="text"
                        value={pageRanges}
                        onChange={(e) => setPageRanges(e.target.value)}
                        placeholder="e.g., 1-3, 4-6, 8"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter page ranges separated by commas
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSplit}
                    disabled={isProcessing || (splitMode === 'range' && !pageRanges.trim())}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Scissors className="h-4 w-4 mr-2 animate-pulse" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Scissors className="h-4 w-4 mr-2" />
                        Split PDF
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {isProcessing && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                      <span>{processingProgress}%</span>
                    </div>
                    <Progress value={processingProgress} />
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Split Results</CardTitle>
                  <CardDescription>
                    {results.length} file{results.length > 1 ? 's' : ''} created
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="font-medium">{result.fileName}</p>
                            <p className="text-sm text-muted-foreground">
                              {result.pages} page{parseInt(result.pages) > 1 ? 's' : ''}
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
                    ))}
                  </div>
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="w-full"
                    >
                      Split Another PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <h4 className="font-semibold mb-2">Flexible Splitting</h4>
            <p className="text-sm text-muted-foreground">
              Split by page ranges or individual pages
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Preserve Quality</h4>
            <p className="text-sm text-muted-foreground">
              Maintain original PDF quality in all splits
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Batch Processing</h4>
            <p className="text-sm text-muted-foreground">
              Create multiple files in one operation
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
