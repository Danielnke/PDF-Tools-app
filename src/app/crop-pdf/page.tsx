'use client';

import { useState, useCallback, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { FileUploadSection } from '@/components/crop-pdf/file-upload-section';
import { PdfViewerSimple } from '@/components/crop-pdf/pdf-viewer-simple';
import { ProcessingStatus } from '@/components/crop-pdf/processing-status';
import { ResultsDisplay } from '@/components/crop-pdf/results-display';
import { type CropArea, type PageInfo, type CropResult } from '@/lib/pdf-crop-utils';

interface UploadedFileData {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  type: string;
}

export default function CropPDFPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileData, setUploadedFileData] = useState<UploadedFileData | null>(null);
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
        // Use a local worker source instead of external CDN to avoid CORS issues
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        console.log('PDF.js worker configured successfully');
      }).catch(error => {
        console.error('Failed to configure PDF.js worker:', error);
        setError('Failed to initialize PDF viewer. Please refresh the page.');
      });
    }
  }, []);

  const handleFileUploaded = useCallback(async (fileData: UploadedFileData) => {
    setUploadedFileData(fileData);
    setError(null);
    setResult(null);
    setCropAreas({});
    setCurrentPage(1);
    setIsAnalyzing(true);

    try {
      // For the crop functionality, we need to read the actual file from the upload
      // Create a File object from the original file in memory
      const originalFileData = fileData;
      
      // Read the file from the server path for analysis
      const response = await fetch(`/api/pdf/crop?filePath=${encodeURIComponent(originalFileData.filePath)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const analysisData = await response.json();
      
      if (analysisData.success) {
        const pages: PageInfo[] = analysisData.pageDimensions.map((dim: { pageNumber: number; width: number; height: number }) => ({
          pageNumber: dim.pageNumber,
          width: dim.width,
          height: dim.height,
        }));
        setPageInfo(pages);
        
        // For display purposes, we'll fetch the file blob
        const fileResponse = await fetch(`/api/download/${originalFileData.fileName}`);
        if (fileResponse.ok) {
          const blob = await fileResponse.blob();
          const file = new File([blob], originalFileData.originalName, { type: 'application/pdf' });
          setUploadedFile(file);
        } else {
          throw new Error('Failed to load PDF file for viewing');
        }
      } else {
        throw new Error(analysisData.error || 'Failed to analyze PDF');
      }
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to analyze PDF file: ${errorMessage}`);
      // Clean up on error
      setUploadedFileData(null);
      setUploadedFile(null);
      setPageInfo([]);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    setUploadedFileData(null);
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

  const handleCrop = useCallback(async (cropMode: 'single' | 'all', selectedPages: number[], cropAreas: { [pageNumber: number]: CropArea }) => {
    if (!uploadedFileData) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      // Convert crop areas to the format expected by the API
      const cropData = Object.entries(cropAreas).map(([pageNumber, area]) => ({
        pageNumber: parseInt(pageNumber),
        cropArea: area
      }));

      const response = await fetch('/api/pdf/crop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: uploadedFileData.filePath,
          cropData: cropData,
          cropMode: cropMode === 'all' ? 'all' : 'single',
          selectedPages: selectedPages
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to crop PDF');
      }

      setResult(result);
      setProcessingProgress(100);
    } catch (error) {
      console.error('Crop error:', error);
      setError(error instanceof Error ? error.message : 'Failed to crop PDF');
      setProcessingProgress(0);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFileData]);

  const handleDownload = useCallback(async (downloadUrl: string, fileName: string) => {
    try {
      // Use the API download endpoint
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file');
    }
  }, []);

  const handleReset = useCallback(() => {
    setUploadedFile(null);
    setUploadedFileData(null);
    setPageInfo([]);
    setCurrentPage(1);
    setCropAreas({});
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
    setIsProcessing(false);
    setProcessingProgress(0);
  }, []);

  return (
    <MainLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex-shrink-0">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">PDF Crop Tool</h1>
            <p className="text-sm text-muted-foreground">
              Upload a PDF and crop specific areas from each page with precision
            </p>
          </div>
        </div>

        <div className="flex-1 p-4 min-h-0">
          {/* File Upload Section */}
          {!uploadedFile && !result && (
            <div className="flex items-center justify-center h-full">
              <div className="w-full max-w-2xl">
                <FileUploadSection
                  onFileUploaded={handleFileUploaded}
                  isAnalyzing={isAnalyzing}
                />
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          {uploadedFile && pageInfo.length > 0 && !result && (
            <PdfViewerSimple
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
            <div className="flex items-center justify-center h-full">
              <div className="w-full max-w-md">
                <ProcessingStatus
                  isProcessing={isProcessing}
                  processingProgress={processingProgress}
                  error={error}
                />
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="flex items-center justify-center h-full">
              <div className="w-full max-w-2xl">
                <ResultsDisplay
                  result={result}
                  onDownload={handleDownload}
                  onReset={handleReset}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}