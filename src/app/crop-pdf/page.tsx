'use client';

import { useState, useCallback, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { FileUploadSection } from '@/components/crop-pdf/file-upload-section';
import { PdfViewer } from '@/components/crop-pdf/pdf-viewer';
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

  const handleCrop = useCallback(async (cropMode: 'single' | 'multiple' | 'all' | 'copy-to-all', selectedPages: number[], selectedCropAreas: { [pageNumber: number]: CropArea }) => {
    if (!uploadedFileData || !uploadedFile) {
      setError('No file selected for cropping');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      // Convert crop areas to the format expected by the API
      let crops;
      
      if (cropMode === 'single') {
        // Single page mode - use the crop area for the current page
        const pageNum = selectedPages[0];
        const cropArea = selectedCropAreas[pageNum];
        if (!cropArea || cropArea.width <= 0 || cropArea.height <= 0) {
          setError('Please select a crop area by dragging on the PDF page');
          return;
        }
        crops = [{
          pageNumber: pageNum,
          x: cropArea.x,
          y: cropArea.y,
          width: cropArea.width,
          height: cropArea.height,
          unit: 'pt' as const,
        }];
      } else if (cropMode === 'multiple') {
        // Multiple pages mode - use individual crop areas for each selected page
        crops = Object.entries(selectedCropAreas)
          .filter(([pageNumber, cropArea]) => {
            const pageNum = parseInt(pageNumber);
            return selectedPages.includes(pageNum) && cropArea.width > 0 && cropArea.height > 0;
          })
          .map(([pageNumber, cropArea]) => ({
            pageNumber: parseInt(pageNumber),
            x: cropArea.x,
            y: cropArea.y,
            width: cropArea.width,
            height: cropArea.height,
            unit: 'pt' as const,
          }));
      } else { // 'all'
        // All pages mode - use the first available crop area and apply it to all pages
        const firstCropArea = Object.values(selectedCropAreas).find(area => area.width > 0 && area.height > 0);
        if (!firstCropArea) {
          setError('Please create a crop area by dragging on the PDF page');
          return;
        }
        crops = selectedPages.map(pageNum => ({
          pageNumber: pageNum,
          x: firstCropArea.x,
          y: firstCropArea.y,
          width: firstCropArea.width,
          height: firstCropArea.height,
          unit: 'pt' as const,
        }));
      }

      if (crops.length === 0) {
        setError('Please select at least one crop area by dragging on the PDF pages');
        return;
      }

      setProcessingProgress(25);

      // Use the server-side cropping API
      const response = await fetch('/api/pdf/crop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: uploadedFileData.filePath,
          crops: crops,
          applyToAllPages: cropMode === 'all',
          maintainAspectRatio: false,
        }),
      });

      setProcessingProgress(75);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Create a download URL for the cropped file
        const fileName = result.filePath.split('/').pop() || 'cropped.pdf';
        const downloadUrl = `/api/download/${fileName}`;
        
        const cropResult: CropResult = {
          fileName: fileName,
          downloadUrl: downloadUrl,
          originalSize: uploadedFileData.size,
          croppedSize: result.fileSize || uploadedFileData.size,
          results: result.results,
        };
        
        setResult(cropResult);
        setProcessingProgress(100);
      } else {
        throw new Error(result.error || 'Failed to crop PDF');
      }
    } catch (error) {
      console.error('Error cropping PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to crop PDF';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [uploadedFileData, uploadedFile]);

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
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
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
              onFileUploaded={handleFileUploaded}
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

        </div>
      </div>
    </MainLayout>
  );
}