'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crop,
  RotateCw,
  Trash2,
  HelpCircle
} from 'lucide-react';

// Import react-pdf CSS
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Dynamically import react-pdf components
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { ssr: false });

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
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

interface PdfViewerSimpleProps {
  file: File | null;
  pageInfo: PageInfo[];
  currentPage: number;
  cropAreas: { [pageNumber: number]: CropArea };
  onPageChange: (page: number) => void;
  onCropAreaChange: (pageNumber: number, cropArea: CropArea) => void;
  onRemoveFile: () => void;
  onCrop: (cropMode: 'single' | 'all', selectedPages: number[], cropAreas: { [pageNumber: number]: CropArea }) => void;
  isProcessing: boolean;
}

export function PdfViewerSimple({
  file,
  pageInfo,
  currentPage,
  cropAreas,
  onPageChange,
  onCropAreaChange,
  onRemoveFile,
  onCrop,
  isProcessing,
}: PdfViewerSimpleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [pageScale, setPageScale] = useState(1);

  // Add keyboard shortcuts and mouse wheel zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '0':
            e.preventDefault();
            setZoom(1);
            setRotation(0);
            break;
          case '+':
          case '=':
            e.preventDefault();
            setZoom(prev => Math.min(prev + 0.1, 3));
            break;
          case '-':
            e.preventDefault();
            setZoom(prev => Math.max(prev - 0.1, 0.5));
            break;
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.max(0.5, Math.min(prev + delta, 3)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Get current page dimensions
  const currentPageInfo = pageInfo.find(p => p.pageNumber === currentPage);
  
  // Handle mouse down for drag-to-crop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!pageContainerRef.current || !currentPageInfo) return;
    
    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragStart({ x, y });
    setCurrentCropArea({ x, y, width: 0, height: 0 });
  }, [currentPageInfo]);

  // Handle mouse move for drag-to-crop
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !pageContainerRef.current) return;
    
    const rect = pageContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);
    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    
    // Ensure crop area stays within page bounds
    const maxWidth = (currentPageInfo?.width ? currentPageInfo.width * pageScale * zoom : width) || width;
    const maxHeight = (currentPageInfo?.height ? currentPageInfo.height * pageScale * zoom : height) || height;
    
    setCurrentCropArea({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, maxWidth - x),
      height: Math.min(height, maxHeight - y)
    });
  }, [isDragging, dragStart, pageScale, zoom, currentPageInfo]);

  // Handle mouse up for drag-to-crop
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !currentCropArea || !currentPageInfo) return;
    
    setIsDragging(false);
    
    // Only save if area is meaningful (at least 20x20 pixels)
    if (currentCropArea.width > 20 && currentCropArea.height > 20) {
      // Convert screen coordinates to PDF coordinates
      const scaleFactor = 1 / (pageScale * zoom);
      const pdfCropArea: CropArea = {
        x: Math.max(0, currentCropArea.x * scaleFactor),
        y: Math.max(0, currentCropArea.y * scaleFactor),
        width: Math.min(currentCropArea.width * scaleFactor, currentPageInfo.width),
        height: Math.min(currentCropArea.height * scaleFactor, currentPageInfo.height)
      };
      
      onCropAreaChange(currentPage, pdfCropArea);
    }
    
    setCurrentCropArea(null);
  }, [isDragging, currentCropArea, currentPageInfo, pageScale, zoom, onCropAreaChange, currentPage]);

  // Handle zoom changes
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Handle rotation
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // Handle crop action
  const handleCrop = () => {
    if (Object.keys(cropAreas).length === 0) {
      alert('Please select a crop area by dragging on the PDF page');
      return;
    }
    onCrop('single', [currentPage], cropAreas);
  };

  // Handle apply to all
  const handleApplyToAll = () => {
    if (!cropAreas[currentPage]) {
      alert('Please select a crop area on the current page first');
      return;
    }
    
    const currentCrop = cropAreas[currentPage];
    const newCropAreas: { [pageNumber: number]: CropArea } = {};
    
    pageInfo.forEach(page => {
      newCropAreas[page.pageNumber] = { ...currentCrop };
    });
    
    onCrop('all', pageInfo.map(p => p.pageNumber), newCropAreas);
  };

  // Page navigation
  const goToPreviousPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < pageInfo.length) onPageChange(currentPage + 1);
  };

  if (!file) {
    return (
      <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-gray-500">No PDF file loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top Toolbar - Minimal and Clean */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
          >
            ← Previous
          </Button>
          <span className="text-sm font-medium px-3">
            Page {currentPage} of {pageInfo.length}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={goToNextPage}
            disabled={currentPage >= pageInfo.length}
          >
            Next →
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:text-gray-700"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <div className="space-y-1">
                <div><strong>Keyboard Shortcuts:</strong></div>
                <div>• Ctrl/Cmd + Scroll: Zoom</div>
                <div>• Ctrl/Cmd + +: Zoom in</div>
                <div>• Ctrl/Cmd + -: Zoom out</div>
                <div>• Ctrl/Cmd + 0: Reset view</div>
                <div className="pt-1"><strong>Mouse:</strong></div>
                <div>• Drag to select crop area</div>
                <div>• Click Remove to clear selection</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col items-center gap-1">
            <input
              type="range"
              min="50"
              max="300"
              value={zoom * 100}
              onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
              className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-medium text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRotate}
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleResetZoom}
            title="Reset zoom and rotation"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setZoom(1);
              setRotation(0);
            }}
            title="Fit to screen"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleCrop}
            disabled={isProcessing || Object.keys(cropAreas).length === 0}
          >
            <Crop className="h-4 w-4 mr-1" />
            Crop Current Page
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyToAll}
            disabled={isProcessing || !cropAreas[currentPage]}
          >
            Apply to All Pages
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onRemoveFile}
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <div 
          ref={containerRef}
          className="h-full w-full overflow-auto flex items-center justify-center bg-gray-50/30"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {file && !pdfError && (
            <Document 
              file={file}
              onLoadSuccess={() => {
                setPdfError(null);
              }}
              onLoadError={(error) => {
                console.error('PDF load error:', error);
                setPdfError('Failed to load PDF file');
              }}
              loading={
                <div className="flex items-center justify-center">
                  <div className="text-muted-foreground">Loading PDF...</div>
                </div>
              }
              error={
                <div className="flex items-center justify-center">
                  <div className="text-error">Failed to load PDF</div>
                </div>
              }
            >
              {currentPageInfo && (
                <div 
                  ref={pageContainerRef}
                  className="relative select-none max-w-full max-h-full"
                  onMouseDown={handleMouseDown}
                  style={{ cursor: isDragging ? 'crosshair' : 'grab' }}
                >
                  {/* PDF Page */}
                  <Page
                    pageNumber={currentPage}
                    scale={zoom}
                    rotate={rotation}
                    renderMode="canvas"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => {
                      // Calculate scale factor for coordinate conversion
                      const viewport = page.getViewport({ scale: zoom, rotation });
                      setPageScale(viewport.width / currentPageInfo.width);
                    }}
                    loading={
                      <div className="flex items-center justify-center bg-gray-100 min-h-[60vh]">
                        <div className="text-muted-foreground text-sm">Loading page...</div>
                      </div>
                    }
                    className="max-w-full max-h-full"
                  />

                  {/* Crop Area Overlay */}
                  {(cropAreas[currentPage] || currentCropArea) && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Existing crop area */}
                      {cropAreas[currentPage] && (
                        <div
                          className="absolute border-2 border-green-500 bg-green-500/10 shadow-lg"
                          style={{
                            left: cropAreas[currentPage].x * pageScale * zoom,
                            top: cropAreas[currentPage].y * pageScale * zoom,
                            width: cropAreas[currentPage].width * pageScale * zoom,
                            height: cropAreas[currentPage].height * pageScale * zoom,
                          }}
                        >
                          <div className="absolute -top-8 left-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded shadow">
                            Cropped Area
                          </div>
                          <button
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCropAreaChange(currentPage, { x: 0, y: 0, width: 0, height: 0 });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {/* Current drag selection */}
                      {currentCropArea && (
                        <div
                          className="absolute border-2 border-blue-500 bg-blue-500/20 shadow-lg"
                          style={{
                            left: currentCropArea.x,
                            top: currentCropArea.y,
                            width: currentCropArea.width,
                            height: currentCropArea.height,
                          }}
                        >
                          <div className="absolute -top-8 left-0 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded shadow">
                            {Math.round(currentCropArea.width)} × {Math.round(currentCropArea.height)} px
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instructions */}
                  {!cropAreas[currentPage] && !currentCropArea && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Crop className="h-4 w-4" />
                          Click and drag to select crop area
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Document>
          )}

          {pdfError && (
            <div className="flex items-center justify-center">
              <div className="text-error text-center">
                <div>{pdfError}</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPdfError(null);
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

      {/* Bottom Status Bar */}
      <div className="p-3 bg-card border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <div>
            {cropAreas[currentPage] && (
              <span>Crop area: {Math.round(cropAreas[currentPage].width)} × {Math.round(cropAreas[currentPage].height)} px</span>
            )}
          </div>
          <div>
            Drag on the page to select crop area • Use toolbar buttons to navigate and control zoom
          </div>
        </div>
      </div>
    </div>
  );
}