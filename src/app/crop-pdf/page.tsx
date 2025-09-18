'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FileUploadSection } from '@/components/crop-pdf/file-upload-section';
import { PdfViewer } from '@/components/crop-pdf/pdf-viewer';
import { ProcessingStatus } from '@/components/crop-pdf/processing-status';
import { ResultsDisplay } from '@/components/crop-pdf/results-display';
import { analyzePDF, cropPDF, type CropArea, type PageInfo, type CropResult } from '@/lib/pdf-crop-utils';

export default function CropPDFPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [cropAreas, setCropAreas] = useState<{ [pageNumber: number]: CropArea }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [result, setResult] = useState<CropResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Configure PDF.js worker on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('react-pdf').then(({ pdfjs }) => {
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
      });
    }
  }, []);

  const handleFileDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setUploadedFile(file);
    setError(null);
    setResult(null);
    setCropAreas({});
    setCurrentPage(1);
    setIsAnalyzing(true);

    try {
      const pages = await analyzePDF(file);
      setPageInfo(pages);
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      setError('Failed to analyze PDF file');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    setPageInfo([]);
    setCurrentPage(1);
    setCropAreas({});
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  const handleCropAreaChange = useCallback((pageNumber: number, cropArea: CropArea) => {
    setCropAreas(prev => ({
      ...prev,
      [pageNumber]: cropArea
    }));
  }, []);

  const handleCrop = useCallback(async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      const cropResult = await cropPDF(uploadedFile, cropAreas, (progress) => {
        setProcessingProgress(progress);
      });
      setResult(cropResult);
    } catch (error) {
      console.error('Error cropping PDF:', error);
      setError(error instanceof Error ? error.message : 'Failed to crop PDF');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [uploadedFile, cropAreas]);

  const handleDownload = useCallback((downloadUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL after download
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  }, []);

  const handleReset = useCallback(() => {
    setUploadedFile(null);
    setPageInfo([]);
    setCurrentPage(1);
    setCropAreas({});
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">PDF Crop Tool</h1>
            <p className="text-muted-foreground">
              Upload a PDF and crop specific areas from each page with precision
            </p>
          </div>

          {/* File Upload Section */}
          {!uploadedFile && !result && (
            <FileUploadSection
              onFileDrop={handleFileDrop}
              isAnalyzing={isAnalyzing}
            />
          )}

          {/* PDF Viewer */}
          {uploadedFile && pageInfo.length > 0 && !result && (
            <PdfViewer
              file={uploadedFile}
              pageInfo={pageInfo}
              currentPage={currentPage}
              cropAreas={cropAreas}
              onPageChange={setCurrentPage}
              onCropAreaChange={handleCropAreaChange}
              onRemoveFile={handleRemoveFile}
              onCrop={handleCrop}
              isProcessing={isProcessing}
            />
          )}

          {/* Processing Status */}
          {(isProcessing || error) && (
            <ProcessingStatus
              isProcessing={isProcessing}
              processingProgress={processingProgress}
              error={error}
            />
          )}

          {/* Results Display */}
          {result && (
            <ResultsDisplay
              result={result}
              onDownload={handleDownload}
              onReset={handleReset}
            />
          )}

          {/* Feature Highlights */}
          {!uploadedFile && !result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center space-y-2 p-4 bg-card rounded-lg border">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.122 2.122" />
                  </svg>
                </div>
                <h3 className="font-semibold">Visual Selection</h3>
                <p className="text-sm text-muted-foreground">
                  Click and drag to select crop areas directly on the PDF preview
                </p>
              </div>
              <div className="text-center space-y-2 p-4 bg-card rounded-lg border">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold">Multi-Page Support</h3>
                <p className="text-sm text-muted-foreground">
                  Crop different areas on each page or apply the same crop to all pages
                </p>
              </div>
              <div className="text-center space-y-2 p-4 bg-card rounded-lg border">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold">Real-time Preview</h3>
                <p className="text-sm text-muted-foreground">
                  See exactly what will be cropped before processing your PDF
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}