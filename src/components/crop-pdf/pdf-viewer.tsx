'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crop,
  RotateCw
} from 'lucide-react';

// Import react-pdf CSS for TextLayer and AnnotationLayer
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { ssr: false });

// Configure PDF.js worker on client side only
if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
    // Use local worker to avoid CORS and CDN issues
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }).catch(error => {
    console.error('Failed to configure PDF.js worker:', error);
  });
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

interface PdfViewerProps {
  file: File | null;
  pageInfo: PageInfo[];
  currentPage: number;
  cropAreas: { [pageNumber: number]: CropArea };
  onPageChange: (page: number) => void;
  onCropAreaChange: (pageNumber: number, cropArea: CropArea) => void;
  onRemoveFile: () => void;
  onCrop: (cropMode: CropMode, selectedPages: number[], cropAreas: { [pageNumber: number]: CropArea }) => void;
  isProcessing: boolean;
}

type CropMode = 'single' | 'multiple' | 'all' | 'copy-to-all';

export function PdfViewer({
  file,
  pageInfo,
  currentPage,
  cropAreas,
  onPageChange,
  onCropAreaChange,
  onRemoveFile,
  onCrop,
  isProcessing,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cropMode, setCropMode] = useState<CropMode>('copy-to-all');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rotation, setRotation] = useState(0);
  const [selectedCropAreas, setSelectedCropAreas] = useState<{ [pageNumber: number]: CropArea }>({});

  // Manual crop area definition
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(0);
  const [cropHeight, setCropHeight] = useState(0);

  // Handle crop area definition
  const handleDefineCropArea = () => {
    if (cropWidth <= 0 || cropHeight <= 0) {
      alert('Please enter valid crop dimensions');
      return;
    }

    const cropArea: CropArea = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
    
    if (cropMode === 'copy-to-all') {
      // Apply to all pages
      pageInfo.forEach(page => {
        onCropAreaChange(page.pageNumber, cropArea);
        setSelectedCropAreas(prev => ({ ...prev, [page.pageNumber]: cropArea }));
      });
    } else {
      // Apply to current page only
      onCropAreaChange(currentPage, cropArea);
      setSelectedCropAreas(prev => ({ ...prev, [currentPage]: cropArea }));
    }
  };

  const handleCropClick = () => {
    if (cropMode === 'copy-to-all') {
      const existingCrop = Object.values(selectedCropAreas).find(area => area.width > 0 && area.height > 0) || 
                          Object.values(cropAreas).find(area => area.width > 0 && area.height > 0);
      if (!existingCrop) {
        alert('Please define a crop area first using the controls in the sidebar.');
        return;
      }
      const allPages = Array.from({ length: pageInfo.length }, (_, i) => i + 1);
      const allPageCrops = allPages.reduce((acc, pageNum) => {
        acc[pageNum] = existingCrop;
        return acc;
      }, {} as { [pageNumber: number]: CropArea });
      onCrop('copy-to-all', allPages, allPageCrops);
    } else if (cropMode === 'single') {
      const cropArea = selectedCropAreas[currentPage] || cropAreas[currentPage];
      if (!cropArea || cropArea.width <= 0 || cropArea.height <= 0) {
        alert('Please define a crop area for the current page.');
        return;
      }
      onCrop('single', [currentPage], { [currentPage]: cropArea });
    } else if (cropMode === 'multiple') {
      if (selectedPages.length === 0) {
        alert('Please select at least one page to crop.');
        return;
      }
      const selectedCropAreasFiltered = selectedPages.reduce((acc, pageNum) => {
        const cropArea = selectedCropAreas[pageNum] || cropAreas[pageNum];
        if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
          acc[pageNum] = cropArea;
        }
        return acc;
      }, {} as { [pageNumber: number]: CropArea });
      
      if (Object.keys(selectedCropAreasFiltered).length === 0) {
        alert('Please define crop areas for the selected pages.');
        return;
      }
      onCrop('multiple', selectedPages, selectedCropAreasFiltered);
    } else { // all
      const allPages = Array.from({ length: pageInfo.length }, (_, i) => i + 1);
      const allCropAreas = { ...cropAreas, ...selectedCropAreas };
      if (Object.keys(allCropAreas).length === 0 || !Object.values(allCropAreas).some(area => area.width > 0 && area.height > 0)) {
        alert('Please define at least one crop area.');
        return;
      }
      onCrop('all', allPages, allCropAreas);
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] bg-background gap-4">
      {/* Fixed Left Sidebar - Controls */}
      <div className="w-80 bg-card border border-border rounded-lg flex-shrink-0 sticky top-4 h-fit max-h-[calc(100vh-220px)] overflow-y-auto">
        <div className="p-4">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Crop Settings</h2>
            <p className="text-xs text-muted-foreground">
              Define crop area manually - PDF preview shows clean view
            </p>
          </div>

          {/* Crop Mode Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Crop Mode</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <input
                  type="radio"
                  name="cropMode"
                  value="copy-to-all"
                  checked={cropMode === 'copy-to-all'}
                  onChange={() => {
                    setCropMode('copy-to-all');
                    setSelectedPages([currentPage]);
                  }}
                  className="text-blue-600"
                />
                <div>
                  <div className="text-sm font-medium">Copy to All Pages</div>
                  <div className="text-xs text-muted-foreground">Recommended</div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <input
                  type="radio"
                  name="cropMode"
                  value="single"
                  checked={cropMode === 'single'}
                  onChange={() => {
                    setCropMode('single');
                    setSelectedPages([currentPage]);
                  }}
                  className="text-blue-600"
                />
                <div className="text-sm">Single Page</div>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <input
                  type="radio"
                  name="cropMode"
                  value="multiple"
                  checked={cropMode === 'multiple'}
                  onChange={() => {
                    setCropMode('multiple');
                    setSelectedPages([currentPage]);
                  }}
                  className="text-blue-600"
                />
                <div className="text-sm">Multiple Pages</div>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <input
                  type="radio"
                  name="cropMode"
                  value="all"
                  checked={cropMode === 'all'}
                  onChange={() => {
                    setCropMode('all');
                    const allPages = Array.from({ length: pageInfo.length }, (_, i) => i + 1);
                    setSelectedPages(allPages);
                  }}
                  className="text-blue-600"
                />
                <div className="text-sm">All Pages</div>
              </label>
            </div>
          </div>
          
          {/* Page Selection for Multiple Mode */}
          {cropMode === 'multiple' && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">Select Pages to Crop</h3>
              <div className="grid grid-cols-6 gap-1">
                {pageInfo.map((_, index) => {
                  const pageNum = index + 1;
                  const isSelected = selectedPages.includes(pageNum);
                  return (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPages(prev => prev.filter(p => p !== pageNum));
                        } else {
                          setSelectedPages(prev => [...prev, pageNum]);
                        }
                      }}
                      className="w-8 h-8 p-0 text-xs"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              {selectedPages.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Please select at least one page to crop.</p>
              )}
            </div>
          )}
          
          {/* Manual Crop Area Definition */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Define Crop Area</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">X Position</label>
                  <input
                    type="number"
                    value={cropX}
                    onChange={(e) => setCropX(Number(e.target.value))}
                    className="w-full text-xs border rounded px-2 py-1"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Y Position</label>
                  <input
                    type="number"
                    value={cropY}
                    onChange={(e) => setCropY(Number(e.target.value))}
                    className="w-full text-xs border rounded px-2 py-1"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Width</label>
                  <input
                    type="number"
                    value={cropWidth}
                    onChange={(e) => setCropWidth(Number(e.target.value))}
                    className="w-full text-xs border rounded px-2 py-1"
                    placeholder="200"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Height</label>
                  <input
                    type="number"
                    value={cropHeight}
                    onChange={(e) => setCropHeight(Number(e.target.value))}
                    className="w-full text-xs border rounded px-2 py-1"
                    placeholder="200"
                    min="1"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleDefineCropArea}
                className="w-full"
                variant="outline"
              >
                Apply Crop Area
              </Button>
            </div>
          </div>
          
          {/* Rotation Control */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Rotation</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const newRotation = (rotation + 90) % 360;
                setRotation(newRotation);
              }}
              className="w-full justify-start"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Rotate ({rotation}°)
            </Button>
          </div>
          
          {/* Zoom Controls */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Zoom</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="flex-1"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-mono min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                className="flex-1"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Page Navigation */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Navigation</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="flex-1"
              >
                Prev
              </Button>
              <span className="text-xs font-medium text-center min-w-[60px]">
                {currentPage} / {pageInfo.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(Math.min(pageInfo.length, currentPage + 1))}
                disabled={currentPage >= pageInfo.length}
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </div>
          
          {/* Current Crop Area Info */}
          {(selectedCropAreas[currentPage] || cropAreas[currentPage]) && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">Current Crop Area</h3>
              <div className="bg-blue-50/50 p-3 rounded text-xs space-y-1">
                {(() => {
                  const area = selectedCropAreas[currentPage] || cropAreas[currentPage];
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div>X: {Math.round(area.x)}px</div>
                      <div>Y: {Math.round(area.y)}px</div>
                      <div>W: {Math.round(area.width)}px</div>
                      <div>H: {Math.round(area.height)}px</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleCropClick}
              disabled={isProcessing || (cropMode === 'multiple' && selectedPages.length === 0)}
              className="w-full"
            >
              {isProcessing ? 'Cropping...' : 'Crop PDF'}
            </Button>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setZoom(1);
                  setCropX(0);
                  setCropY(0);
                  setCropWidth(0);
                  setCropHeight(0);
                  setSelectedCropAreas({});
                }}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={onRemoveFile}
                className="flex-1"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Side - Clean PDF Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-background">
          {/* Simple Header */}
          <div className="mb-4 px-4 py-2 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">PDF Preview</h2>
                <p className="text-xs text-muted-foreground">
                  Clean view - use sidebar controls to define crop areas
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {pageInfo.length}
              </div>
            </div>
          </div>
          
          {/* Clean PDF Container - No Canvas Overlay */}
          <div 
            className="h-[calc(100vh-320px)] overflow-y-auto border border-border rounded-lg bg-gray-50/50 p-4" 
            ref={containerRef}
          >
            <div className="space-y-4">
              {file && !pdfError && (
                <Document 
                  file={file}
                  onLoadSuccess={() => {
                    setIsLoading(false);
                    setPdfError(null);
                  }}
                  onLoadError={(error) => {
                    console.error('PDF load error:', error);
                    setPdfError('Failed to load PDF file');
                    setIsLoading(false);
                  }}
                  loading={
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted-foreground">Loading PDF...</div>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center py-8">
                      <div className="text-error">Failed to load PDF</div>
                    </div>
                  }
                >
                  {/* Render pages with clean display */}
                  {pageInfo.map((page, index) => {
                    const pageNumber = page.pageNumber;
                    const isCurrentPage = pageNumber === currentPage;
                    
                    // Calculate appropriate sizing - ensure at least one page is visible
                    const containerWidth = containerRef.current?.clientWidth || 600;
                    const maxPageWidth = Math.min(containerWidth - 80, 500);
                    const scale = Math.min(maxPageWidth / page.width, 0.7) * zoom;
                    const pageWidth = Math.floor(page.width * scale);
                    const pageHeight = Math.floor(page.height * scale);
                    
                    return (
                      <div 
                        key={pageNumber}
                        className={`relative border rounded-lg p-3 mb-4 bg-white shadow-sm transition-all duration-200 ${
                          isCurrentPage 
                            ? 'border-blue-500 bg-blue-50/30' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => onPageChange(pageNumber)}
                      >
                        {/* Page number indicator */}
                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded z-10">
                          Page {pageNumber}
                        </div>
                        
                        {/* Clean PDF page display */}
                        <div className="flex justify-center">
                          <div className="relative">
                            <Page
                              pageNumber={pageNumber}
                              width={pageWidth}
                              rotate={rotation}
                              renderMode="canvas"
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={
                                <div className="flex items-center justify-center bg-gray-100" style={{ width: pageWidth, height: pageHeight }}>
                                  <div className="text-muted-foreground text-sm">Loading...</div>
                                </div>
                              }
                              error={
                                <div className="flex items-center justify-center bg-red-50" style={{ width: pageWidth, height: pageHeight }}>
                                  <div className="text-error text-sm">Failed to load</div>
                                </div>
                              }
                            />
                          </div>
                        </div>
                        
                        {/* Crop area info */}
                        {(selectedCropAreas[pageNumber] || cropAreas[pageNumber]) && (
                          <div className="mt-2 bg-green-50 p-2 rounded text-xs border border-green-200">
                            <div className="font-medium text-green-800">Crop Area Defined:</div>
                            <div className="text-green-600">
                              {(() => {
                                const area = selectedCropAreas[pageNumber] || cropAreas[pageNumber];
                                return `${Math.round(area.width)} × ${Math.round(area.height)} px`;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Document>
              )}
              
              {pdfError && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-error text-center">
                    <div>{pdfError}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPdfError(null);
                        setIsLoading(true);
                      }}
                      className="mt-2"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}