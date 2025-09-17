'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, Page, pdfjs } from 'react-pdf';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  Download, 
  AlertCircle, 
  CheckCircle,
  Crop,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  MousePointer
} from 'lucide-react';
import { pdfApi } from '@/lib/api-client/pdf-api';
import { CropRequest, CropResponse, PageAnalysisResponse } from '@/types/api';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: 'px' | 'pt' | 'mm' | 'in';
}

interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

interface CropResult {
  fileName: string;
  downloadUrl: string;
  originalSize: number;
  croppedSize: number;
  results: Array<{
    pageNumber: number;
    originalDimensions: { width: number; height: number };
    croppedDimensions: { width: number; height: number };
    cropArea: { x: number; y: number; width: number; height: number };
  }>;
}

export default function CropPdfPage() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [uploadDir, setUploadDir] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CropResult | null>(null);
  
  // Crop-specific state
  const [pageInfo, setPageInfo] = useState<PageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [cropAreas, setCropAreas] = useState<CropArea[]>([]);
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [tool, setTool] = useState<'select' | 'move' | 'zoom'>('select');
  const [zoom, setZoom] = useState(1);
  const [applyToAll, setApplyToAll] = useState(false);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(false);
  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // PDF rendering state
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pageSelectionMode, setPageSelectionMode] = useState<'current' | 'all' | 'custom'>('current');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
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
    const validation = await pdfApi.validateFiles([fileToUpload], 'crop');
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
          
          // Set PDF data for rendering
          const fileUrl = URL.createObjectURL(fileToUpload);
          setPdfData(fileUrl);
          
          // Analyze PDF pages
          await analyzePdfPages(`${uploadResult.data.uploadDir}/${uploadedFile.fileName}`);
        }
    } catch {
      setError('Failed to upload file. Please try again.');
    }
  }, []);

  const analyzePdfPages = async (filePath: string) => {
    try {
      const analysis = await pdfApi.analyzePdf(filePath);
      if (analysis.success && analysis.data) {
        setPageInfo(analysis.data.pageDimensions.map(dim => ({
          ...dim,
          scale: 1
        })));
        setCropAreas(new Array(analysis.data.pageCount).fill(null).map((_, i) => ({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          unit: 'px'
        })));
      }
    } catch (error) {
      console.error('Failed to analyze PDF pages:', error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleCrop = async () => {
    if (!file || !uploadDir) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProgressMessage('Initializing crop...');
    setError(null);

    // Simulate progress updates
    const progressSteps = [
      { progress: 10, message: 'Starting crop process...' },
      { progress: 30, message: 'Analyzing PDF structure...' },
      { progress: 60, message: 'Applying crop areas...' },
      { progress: 80, message: 'Generating output...' },
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
      const cropRequest: CropRequest = {
        filePath: `${uploadDir}/${file.fileName}`,
        crops: cropAreas
          .map((area, index) => ({
            pageNumber: index + 1,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            unit: area.unit,
          }))
          .filter(crop => crop.width > 0 && crop.height > 0),
        applyToAllPages: applyToAll,
        maintainAspectRatio,
      };

      const result = await pdfApi.cropPdf(cropRequest);
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setProgressMessage('Crop completed!');

      if (result.success && result.data) {
        setResult({
          fileName: result.data.filePath.split('/').pop() || 'cropped.pdf',
          downloadUrl: `/api/download?filePath=${encodeURIComponent(result.data.filePath)}`,
          originalSize: file.originalSize,
          croppedSize: 0, // Will be updated when we get the actual size
          results: result.data.results,
        });
      } else {
        setError(result.error || 'Failed to crop PDF');
      }
    } catch {
      clearInterval(progressInterval);
      setError('Processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'select') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragStart({ x, y });
    
    const currentPageInfo = pageInfo[currentPage - 1];
    if (currentPageInfo) {
      const scaleX = currentPageInfo.width / canvasSize.width;
      const scaleY = currentPageInfo.height / canvasSize.height;
      
      setCurrentCropArea({
        x: x * scaleX,
        y: y * scaleY,
        width: 0,
        height: 0,
        unit: 'px'
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || tool !== 'select') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const currentPageInfo = pageInfo[currentPage - 1];
    if (currentPageInfo && currentCropArea) {
      const scaleX = currentPageInfo.width / canvasSize.width;
      const scaleY = currentPageInfo.height / canvasSize.height;
      
      const newCropArea = {
        ...currentCropArea,
        width: Math.abs(x - dragStart.x) * scaleX,
        height: Math.abs(y - dragStart.y) * scaleY,
      };
      
      if (maintainAspectRatio && currentPageInfo) {
        const aspectRatio = currentPageInfo.width / currentPageInfo.height;
        if (newCropArea.width / newCropArea.height > aspectRatio) {
          newCropArea.width = newCropArea.height * aspectRatio;
        } else {
          newCropArea.height = newCropArea.width / aspectRatio;
        }
      }
      
      setCurrentCropArea(newCropArea);
      drawCanvas(newCropArea);
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDragging && currentCropArea) {
      const newCropAreas = [...cropAreas];
      newCropAreas[currentPage - 1] = currentCropArea;
      setCropAreas(newCropAreas);
    }
    setIsDragging(false);
  };

  const drawCanvas = (cropArea?: CropArea) => {
    const canvas = canvasRef.current;
    if (!canvas || pageInfo.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const currentPageInfo = pageInfo[currentPage - 1];
    if (!currentPageInfo) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw page background (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Draw page outline
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Draw crop area if exists
    if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
      const scaleX = canvasSize.width / currentPageInfo.width;
      const scaleY = canvasSize.height / currentPageInfo.height;
      
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(
        cropArea.x * scaleX,
        cropArea.y * scaleY,
        cropArea.width * scaleX,
        cropArea.height * scaleY
      );
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        cropArea.x * scaleX,
        cropArea.y * scaleY,
        cropArea.width * scaleX,
        cropArea.height * scaleY
      );
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
    setPageInfo([]);
    setCurrentPage(1);
    setCropAreas([]);
    setCurrentCropArea(null);
  };

  const removeFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProcessingProgress(0);
    setProgressMessage('');
    setPageInfo([]);
    setCurrentPage(1);
    setCropAreas([]);
    setCurrentCropArea(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (pageInfo.length > 0 && canvasRef.current) {
      const canvas = canvasRef.current;
      const currentPageInfo = pageInfo[currentPage - 1];
      if (currentPageInfo) {
        // Set canvas size based on page dimensions
        const maxWidth = 800;
        const maxHeight = 600;
        const scale = Math.min(maxWidth / currentPageInfo.width, maxHeight / currentPageInfo.height, 1);
        
        const newWidth = currentPageInfo.width * scale;
        const newHeight = currentPageInfo.height * scale;
        
        setCanvasSize({ width: newWidth, height: newHeight });
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        drawCanvas(cropAreas[currentPage - 1]);
      }
    }
  }, [pageInfo, currentPage]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Crop PDF</h1>
            <p className="text-muted-foreground">
              Select and crop specific areas from your PDF pages
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crop className="h-5 w-5" />
                Upload PDF to Crop
              </CardTitle>
              <CardDescription>
                Select a PDF file and define crop areas for each page
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
                          {formatFileSize(file.originalSize)} • {pageInfo.length} pages
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

                  {file.status === 'uploaded' && pageInfo.length > 0 && (
                    <div className="space-y-6">
                      {/* Page Navigation */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage <= 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm font-medium">
                            Page {currentPage} of {pageInfo.length}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(Math.min(pageInfo.length, currentPage + 1))}
                            disabled={currentPage >= pageInfo.length}
                          >
                            Next
                          </Button>
                        </div>
                        
                        {/* Tool Selection */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={tool === 'select' ? 'default' : 'outline'}
                            onClick={() => setTool('select')}
                          >
                            <MousePointer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={tool === 'move' ? 'default' : 'outline'}
                            onClick={() => setTool('move')}
                          >
                            <Move className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="text-sm">{Math.round(zoom * 100)}%</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setZoom(1);
                              const newCropAreas = [...cropAreas];
                              newCropAreas[currentPage - 1] = { x: 0, y: 0, width: 0, height: 0, unit: 'px' };
                              setCropAreas(newCropAreas);
                              setCurrentCropArea(null);
                              drawCanvas();
                            }}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Canvas for Crop Selection */}
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <div className="flex justify-center">
                          <canvas
                            ref={canvasRef}
                            className="border border-border rounded bg-white cursor-crosshair"
                            style={{ maxWidth: '100%', height: 'auto' }}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                          />
                        </div>
                      </div>

                      {/* Crop Area Info */}
                      {cropAreas[currentPage - 1] && cropAreas[currentPage - 1].width > 0 && (
                        <div className="bg-card p-3 rounded-md border">
                          <div className="text-sm font-medium mb-2">Current Crop Area:</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>X: {Math.round(cropAreas[currentPage - 1].x)}px</div>
                            <div>Y: {Math.round(cropAreas[currentPage - 1].y)}px</div>
                            <div>Width: {Math.round(cropAreas[currentPage - 1].width)}px</div>
                            <div>Height: {Math.round(cropAreas[currentPage - 1].height)}px</div>
                          </div>
                        </div>
                      )}

                      {/* Options */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="applyToAll"
                            checked={applyToAll}
                            onChange={(e) => setApplyToAll(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="applyToAll" className="text-sm font-medium">
                            Apply crop area to all pages
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="maintainAspectRatio"
                            checked={maintainAspectRatio}
                            onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="maintainAspectRatio" className="text-sm font-medium">
                            Maintain aspect ratio
                          </label>
                        </div>
                      </div>

                      <Button
                        onClick={handleCrop}
                        disabled={isProcessing || cropAreas.every(area => area.width === 0)}
                        className="w-full"
                      >
                        {isProcessing ? 'Cropping...' : 'Crop PDF'}
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
                      Successfully cropped PDF ({result.results.length} pages processed)
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-card p-3 rounded-md border">
                        <div className="text-sm text-muted-foreground">Original Size</div>
                        <div className="text-lg font-bold">{formatFileSize(result.originalSize)}</div>
                      </div>
                      <div className="bg-card p-3 rounded-md border">
                        <div className="text-sm text-muted-foreground">Cropped Size</div>
                        <div className="text-lg font-bold">{formatFileSize(result.croppedSize)}</div>
                      </div>
                    </div>

                    {result.results.length > 0 && (
                      <div className="bg-card p-3 rounded-md border">
                        <div className="text-sm font-medium mb-2">Crop Results:</div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {result.results.map((res, index) => (
                            <div key={index} className="text-xs text-muted-foreground">
                              Page {res.pageNumber}: {Math.round(res.originalDimensions.width)}×{Math.round(res.originalDimensions.height)}px → 
                              {Math.round(res.croppedDimensions.width)}×{Math.round(res.croppedDimensions.height)}px
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div>
                        <p className="font-medium">{result.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.results.length} pages cropped
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
                      Crop Another PDF
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <h4 className="font-semibold mb-2">Visual Selection</h4>
              <p className="text-sm text-muted-foreground">
                Draw crop areas directly on PDF pages with precision
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Multi-Page Support</h4>
              <p className="text-sm text-muted-foreground">
                Crop individual pages or apply same crop to all pages
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Real-time Preview</h4>
              <p className="text-sm text-muted-foreground">
                See crop dimensions and results before processing
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}