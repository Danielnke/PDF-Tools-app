'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Crop
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
type PageSelectionMode = 'current' | 'range' | 'selection';
type ViewMode = 'single' | 'vertical';

interface PageCanvas {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  canvasSize: { width: number; height: number };
  pageInfo: PageInfo;
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pageCanvases, setPageCanvases] = useState<PageCanvas[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('vertical');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragPageNumber, setDragPageNumber] = useState<number | null>(null);
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [tool, setTool] = useState<'crop' | 'move' | 'zoom'>('crop');
  const [zoom, setZoom] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cropMode, setCropMode] = useState<CropMode>('copy-to-all');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageRange, setPageRange] = useState({ start: 1, end: 1 });
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Auto-scroll functionality when dragging near edges
  const handleAutoScroll = useCallback((mouseY: number) => {
    const container = containerRef.current;
    if (!container || !isDragging) return;
    
    const containerRect = container.getBoundingClientRect();
    const scrollThreshold = 50; // pixels from edge to trigger scroll
    const scrollSpeed = 5; // pixels per frame
    
    if (mouseY < containerRect.top + scrollThreshold) {
      // Scroll up
      container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed);
      setIsAutoScrolling(true);
    } else if (mouseY > containerRect.bottom - scrollThreshold) {
      // Scroll down
      container.scrollTop = Math.min(
        container.scrollHeight - container.clientHeight,
        container.scrollTop + scrollSpeed
      );
      setIsAutoScrolling(true);
    } else {
      setIsAutoScrolling(false);
    }
  }, [isDragging]);

  // Handle mouse down on a specific page
  const handlePageMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, pageNumber: number, pageInfo: PageInfo) => {
    if (tool !== 'crop') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragPageNumber(pageNumber);
    setDragStart({ x, y });
    onPageChange(pageNumber); // Make this the current page
    
    // Calculate scale for this page
    const containerWidth = containerRef.current?.clientWidth || 800;
    const maxPageWidth = Math.min(containerWidth - 40, 1200);
    const scale = Math.min(maxPageWidth / pageInfo.width, 1.2) * zoom;
    
    const scaleX = pageInfo.width / (pageInfo.width * scale);
    const scaleY = pageInfo.height / (pageInfo.height * scale);
    
    const pdfX = x * scaleX;
    const pdfY = y * scaleY;
    
    setCurrentCropArea({
      x: pdfX,
      y: pdfY,
      width: 0,
      height: 0
    });
  };

  // Handle mouse move on a specific page
  const handlePageMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, pageNumber: number, pageInfo: PageInfo) => {
    if (!isDragging || tool !== 'crop' || dragPageNumber !== pageNumber) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Auto-scroll when near edges
    handleAutoScroll(e.clientY);
    
    updatePageCropArea(x, y, pageNumber, pageInfo);
  };

  // Handle mouse up on pages
  const handlePageMouseUp = () => {
    if (isDragging && currentCropArea && currentCropArea.width >= 1 && currentCropArea.height >= 1 && dragPageNumber) {
      console.log(`Final crop area on page ${dragPageNumber}: x=${currentCropArea.x}, y=${currentCropArea.y}, width=${currentCropArea.width}, height=${currentCropArea.height}`);
      
      // Apply crop area to current page
      onCropAreaChange(dragPageNumber, currentCropArea);
      
      // If copy-to-all mode, apply to all other pages
      if (cropMode === 'copy-to-all') {
        pageInfo.forEach(page => {
          if (page.pageNumber !== dragPageNumber) {
            onCropAreaChange(page.pageNumber, currentCropArea);
          }
        });
      }
    } else if (isDragging) {
      console.log('Crop area too small, clearing selection');
      setCurrentCropArea(null);
      if (dragPageNumber) {
        drawPageCanvas(dragPageNumber);
      }
    }
    setIsDragging(false);
    setDragPageNumber(null);
    setIsAutoScrolling(false);
  };

  // Update crop area for a specific page
  const updatePageCropArea = (x: number, y: number, pageNumber: number, pageInfo: PageInfo) => {
    if (!currentCropArea) return;
    
    // Calculate scale for this page
    const containerWidth = containerRef.current?.clientWidth || 800;
    const maxPageWidth = Math.min(containerWidth - 40, 1200);
    const scale = Math.min(maxPageWidth / pageInfo.width, 1.2) * zoom;
    
    const scaleX = pageInfo.width / (pageInfo.width * scale);
    const scaleY = pageInfo.height / (pageInfo.height * scale);
    
    const startPdfX = dragStart.x * scaleX;
    const startPdfY = dragStart.y * scaleY;
    const currentPdfX = x * scaleX;
    const currentPdfY = y * scaleY;
    
    const newCropArea = {
      x: Math.min(startPdfX, currentPdfX),
      y: Math.min(startPdfY, currentPdfY),
      width: Math.abs(currentPdfX - startPdfX),
      height: Math.abs(currentPdfY - startPdfY),
    };
    
    // Allow very small movements for precise cropping
    if (newCropArea.width >= 0.5 && newCropArea.height >= 0.5) {
      setCurrentCropArea(newCropArea);
      drawPageCanvas(pageNumber, newCropArea);
    }
  };

  // Draw canvas overlay for a specific page
  const drawPageCanvas = (pageNumber: number, cropArea?: CropArea) => {
    const canvas = pageCanvasRefs.current.get(pageNumber);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pageInfoData = pageInfo.find(p => p.pageNumber === pageNumber);
    if (!pageInfoData) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scale for this page
    const containerWidth = containerRef.current?.clientWidth || 800;
    const maxPageWidth = Math.min(containerWidth - 40, 1200);
    const scale = Math.min(maxPageWidth / pageInfoData.width, 1.2) * zoom;
    
    // Draw crop area if exists
    const areaToShow = cropArea || cropAreas[pageNumber];
    if (areaToShow && areaToShow.width > 0 && areaToShow.height > 0) {
      const canvasX = areaToShow.x / pageInfoData.width * canvas.width;
      const canvasY = areaToShow.y / pageInfoData.height * canvas.height;
      const canvasWidth = areaToShow.width / pageInfoData.width * canvas.width;
      const canvasHeight = areaToShow.height / pageInfoData.height * canvas.height;
      
      // Semi-transparent overlay for non-selected area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Clear the selected area
      ctx.clearRect(canvasX, canvasY, canvasWidth, canvasHeight);
      
      // Draw selection border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
      
      // Add corner handles
      const handleSize = 6;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(canvasX - handleSize/2, canvasY - handleSize/2, handleSize, handleSize);
      ctx.fillRect(canvasX + canvasWidth - handleSize/2, canvasY - handleSize/2, handleSize, handleSize);
      ctx.fillRect(canvasX - handleSize/2, canvasY + canvasHeight - handleSize/2, handleSize, handleSize);
      ctx.fillRect(canvasX + canvasWidth - handleSize/2, canvasY + canvasHeight - handleSize/2, handleSize, handleSize);
    }
  };

  // Auto-scroll animation frame
  useEffect(() => {
    let animationFrame: number;
    
    if (isAutoScrolling && isDragging) {
      const animate = () => {
        // Auto-scroll is handled in handleAutoScroll function
        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isAutoScrolling, isDragging]);

  const handleCanvasMouseUp = () => {
    // Mouse up is now handled globally for better continuous dragging
    // The global handler will take care of finalizing the crop area
  };

  const handleCropClick = () => {
    if (cropMode === 'copy-to-all') {
      // For copy-to-all mode, find any crop area and apply to all pages
      const existingCrop = Object.values(cropAreas).find(area => area.width > 0 && area.height > 0);
      if (!existingCrop) {
        alert('Please create a crop area by dragging on any page first.');
        return;
      }
      const allPages = Array.from({ length: pageInfo.length }, (_, i) => i + 1);
      const allPageCrops = allPages.reduce((acc, pageNum) => {
        acc[pageNum] = existingCrop;
        return acc;
      }, {} as { [pageNumber: number]: CropArea });
      onCrop('copy-to-all', allPages, allPageCrops);
    } else if (cropMode === 'single') {
      onCrop('single', [currentPage], { [currentPage]: cropAreas[currentPage] || { x: 0, y: 0, width: 0, height: 0 } });
    } else if (cropMode === 'multiple') {
      if (selectedPages.length === 0) {
        alert('Please select at least one page to crop.');
        return;
      }
      const selectedCropAreas = selectedPages.reduce((acc, pageNum) => {
        if (cropAreas[pageNum] && cropAreas[pageNum].width > 0 && cropAreas[pageNum].height > 0) {
          acc[pageNum] = cropAreas[pageNum];
        }
        return acc;
      }, {} as { [pageNumber: number]: CropArea });
      
      if (Object.keys(selectedCropAreas).length === 0) {
        alert('Please create crop areas on the selected pages by dragging on the PDF.');
        return;
      }
      onCrop('multiple', selectedPages, selectedCropAreas);
    } else { // all
      const allPages = Array.from({ length: pageInfo.length }, (_, i) => i + 1);
      if (Object.keys(cropAreas).length === 0 || !Object.values(cropAreas).some(area => area.width > 0 && area.height > 0)) {
        alert('Please create at least one crop area. The same crop area from the current page will be applied to all pages.');
        return;
      }
      onCrop('all', allPages, cropAreas);
    }
  };



  return (
    <div className="space-y-6">
      {/* Crop Mode Selection */}
      <div className="bg-card p-4 rounded-lg border">
        <h3 className="text-sm font-medium mb-3">Crop Mode</h3>
        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2">
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
            <span className="text-sm">Copy Crop to All Pages</span>
          </label>
          <label className="flex items-center gap-2">
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
            <span className="text-sm">Single Page</span>
          </label>
          <label className="flex items-center gap-2">
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
            <span className="text-sm">Multiple Pages</span>
          </label>
          <label className="flex items-center gap-2">
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
            <span className="text-sm">All Pages</span>
          </label>
        </div>
        
        {/* Page Selection for Multiple Mode */}
        {cropMode === 'multiple' && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-medium">Select Pages to Crop:</h4>
            <div className="flex gap-2 flex-wrap">
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
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            {selectedPages.length === 0 && (
              <p className="text-sm text-muted-foreground">Please select at least one page to crop.</p>
            )}
          </div>
        )}
        
        {/* Summary */}
        <div className="mt-3 text-xs text-muted-foreground">
          {cropMode === 'copy-to-all' && `Create one crop area and apply it to all ${pageInfo.length} pages`}
          {cropMode === 'single' && `Crop will be applied to page ${currentPage} only`}
          {cropMode === 'multiple' && `Crop will be applied to ${selectedPages.length} selected page(s): ${selectedPages.sort((a, b) => a - b).join(', ')}`}
          {cropMode === 'all' && `Crop will be applied to all ${pageInfo.length} pages`}
        </div>
      </div>
      {/* Page Navigation and Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
            onClick={() => onPageChange(Math.min(pageInfo.length, currentPage + 1))}
            disabled={currentPage >= pageInfo.length}
          >
            Next
          </Button>
        </div>
        
        {/* Tool Selection */}
        <div className="flex items-center gap-2">
          {tool === 'crop' && (
            <span className="text-sm text-blue-600 font-medium">Crop Mode: Click and drag to select area</span>
          )}
          <Button
            size="sm"
            variant={tool === 'crop' ? 'default' : 'outline'}
            onClick={() => {
              setTool('crop');
              console.log('Crop mode activated - Click and drag on the PDF to create crop area');
            }}
            title="Crop Tool - Click and drag to select crop area"
          >
            <Crop className="h-4 w-4" />
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
            variant="default"
            onClick={handleCropClick}
            disabled={isProcessing || (cropMode === 'multiple' && selectedPages.length === 0)}
          >
            {isProcessing ? 'Cropping...' : 'Crop PDF'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onRemoveFile}
          >
            Remove File
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setZoom(1);
              onCropAreaChange(currentPage, { x: 0, y: 0, width: 0, height: 0 });
              setCurrentCropArea(null);
              // Clear all page canvases
              pageCanvasRefs.current.forEach((canvas, pageNum) => {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
              });
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}

      {/* PDF Rendering and Canvas - Vertical Layout */}
      <div className="border border-border rounded-lg p-2 bg-muted/30 overflow-auto max-h-[80vh]" ref={containerRef}>
        <div className="relative w-full">
          {file && !pdfError && (
            <div className="space-y-4">
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
                {/* Render all pages vertically */}
                {pageInfo.map((page, index) => {
                  const pageNumber = page.pageNumber;
                  const isCurrentPage = pageNumber === currentPage;
                  
                  // Calculate flexible sizing based on container and PDF dimensions
                  const containerWidth = containerRef.current?.clientWidth || 800;
                  const maxPageWidth = Math.min(containerWidth - 40, 1200);
                  const scale = Math.min(maxPageWidth / page.width, 1.2) * zoom;
                  const pageWidth = Math.floor(page.width * scale);
                  const pageHeight = Math.floor(page.height * scale);
                  
                  return (
                    <div 
                      key={pageNumber}
                      className={`relative border-2 rounded-lg p-2 mb-4 transition-all duration-200 ${
                        isCurrentPage 
                          ? 'border-blue-500 bg-blue-50/30 shadow-lg' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => onPageChange(pageNumber)}
                    >
                      {/* Page number indicator */}
                      <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-1 rounded z-10">
                        Page {pageNumber}
                      </div>
                      
                      {/* Page content */}
                      <div className="flex justify-center">
                        <div className="relative">
                          <Page
                            pageNumber={pageNumber}
                            width={pageWidth}
                            renderMode="canvas"
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            onLoadSuccess={() => {
                              // Initialize canvas for this page
                              const canvas = document.createElement('canvas');
                              canvas.width = pageWidth;
                              canvas.height = pageHeight;
                              pageCanvasRefs.current.set(pageNumber, canvas);
                              
                              // Draw existing crop area if any
                              drawPageCanvas(pageNumber, cropAreas[pageNumber]);
                            }}
                            onLoadError={(error) => {
                              console.error(`Page ${pageNumber} load error:`, error);
                            }}
                            loading={
                              <div className="flex items-center justify-center" style={{ width: pageWidth, height: pageHeight }}>
                                <div className="text-muted-foreground">Loading page {pageNumber}...</div>
                              </div>
                            }
                            error={
                              <div className="flex items-center justify-center" style={{ width: pageWidth, height: pageHeight }}>
                                <div className="text-error">Failed to load page {pageNumber}</div>
                              </div>
                            }
                          />
                          
                          {/* Canvas overlay for each page */}
                          <canvas
                            ref={(canvas) => {
                              if (canvas) {
                                pageCanvasRefs.current.set(pageNumber, canvas);
                                canvas.width = pageWidth;
                                canvas.height = pageHeight;
                              }
                            }}
                            className={`absolute inset-0 pointer-events-auto ${
                              tool === 'crop' ? (isDragging && dragPageNumber === pageNumber ? 'cursor-grabbing' : 'cursor-crosshair') : 'cursor-default'
                            }`}
                            style={{ 
                              backgroundColor: 'transparent', 
                              userSelect: 'none',
                              touchAction: 'none',
                            }}
                            onMouseDown={(e) => handlePageMouseDown(e, pageNumber, page)}
                            onMouseMove={(e) => handlePageMouseMove(e, pageNumber, page)}
                            onMouseUp={handlePageMouseUp}
                            onMouseLeave={handlePageMouseUp}
                          />
                        </div>
                      </div>
                      
                      {/* Crop area info for this page */}
                      {cropAreas[pageNumber] && cropAreas[pageNumber].width > 0 && (
                        <div className="mt-2 bg-blue-50 p-2 rounded text-xs">
                          <div className="font-medium text-blue-800">Crop Area:</div>
                          <div className="text-blue-600">
                            {Math.round(cropAreas[pageNumber].width)} × {Math.round(cropAreas[pageNumber].height)} px
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Document>
            </div>
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

      {/* Crop Area Info */}
      {cropAreas[currentPage] && cropAreas[currentPage].width > 0 && (
        <div className="bg-card p-3 rounded-md border">
          <div className="text-sm font-medium mb-2">Current Crop Area:</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>X: {Math.round(cropAreas[currentPage].x)}px</div>
            <div>Y: {Math.round(cropAreas[currentPage].y)}px</div>
            <div>Width: {Math.round(cropAreas[currentPage].width)}px</div>
            <div>Height: {Math.round(cropAreas[currentPage].height)}px</div>
          </div>
        </div>
      )}


    </div>
  );
}