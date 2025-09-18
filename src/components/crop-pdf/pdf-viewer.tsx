'use client';

import { useState, useRef, useEffect } from 'react';
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
  onCrop: () => void;
  isProcessing: boolean;
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
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [tool, setTool] = useState<'crop' | 'move' | 'zoom'>('crop');
  const [zoom, setZoom] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'crop') return;
    
    // Prevent text selection and default browser behavior
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Starting crop selection - make sure to drag a reasonable area (minimum 5x5 pixels)');
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log(`Mouse down at: ${x}, ${y} on canvas size: ${canvasSize.width}x${canvasSize.height}`);
    
    setIsDragging(true);
    setDragStart({ x, y });
    
    const currentPageInfo = pageInfo[currentPage - 1];
    if (currentPageInfo) {
      // Convert canvas coordinates to PDF coordinates
      const scaleX = currentPageInfo.width / canvasSize.width;
      const scaleY = currentPageInfo.height / canvasSize.height;
      
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      
      console.log(`Scaled coordinates: ${scaledX}, ${scaledY} on PDF size: ${currentPageInfo.width}x${currentPageInfo.height}`);
      
      setCurrentCropArea({
        x: scaledX,
        y: scaledY,
        width: 0,
        height: 0
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || tool !== 'crop') return;
    
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
      
      // Only update if area is large enough to be a valid crop
      if (newCropArea.width > 5 && newCropArea.height > 5) {
        setCurrentCropArea(newCropArea);
        drawCanvas(newCropArea);
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDragging && currentCropArea && currentCropArea.width > 0 && currentCropArea.height > 0) {
      console.log(`Final crop area: x=${currentCropArea.x}, y=${currentCropArea.y}, width=${currentCropArea.width}, height=${currentCropArea.height}`);
      onCropAreaChange(currentPage, currentCropArea);
    } else if (isDragging) {
      console.log('Crop area too small, clearing selection');
      setCurrentCropArea(null);
      drawCanvas();
    }
    setIsDragging(false);
  };

  const drawCanvas = (cropArea?: CropArea) => {
    const canvas = canvasRef.current;
    if (!canvas || pageInfo.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context from canvas');
      return;
    }
    
    const currentPageInfo = pageInfo[currentPage - 1];
    if (!currentPageInfo) return;
    
    // Clear canvas (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Make canvas transparent to show PDF underneath
    canvas.style.backgroundColor = 'transparent';
    
    // Draw crop area if exists
    if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
      // Convert PDF coordinates to canvas coordinates
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

  useEffect(() => {
    if (pageInfo.length > 0 && canvasRef.current) {
      const canvas = canvasRef.current;
      const currentPageInfo = pageInfo[currentPage - 1];
      if (currentPageInfo) {
        // Set canvas size to properly display PDF at readable size
        const container = canvas.parentElement;
        const maxContainerWidth = container ? Math.min(container.clientWidth - 32, 1000) : 800;
        const maxHeight = Math.min(window.innerHeight - 300, 1000);
        
        // Calculate optimal scale - prioritize readability over fitting exactly
        const widthScale = maxContainerWidth / currentPageInfo.width;
        const heightScale = maxHeight / currentPageInfo.height;
        const scale = Math.min(widthScale, heightScale, 1.5); // Allow up to 1.5x scaling for readability
        
        // Ensure minimum readable size
        const minScale = 0.5;
        const finalScale = Math.max(scale, minScale);
        
        const newWidth = Math.floor(currentPageInfo.width * finalScale);
        const newHeight = Math.floor(currentPageInfo.height * finalScale);
        
        setCanvasSize({ width: newWidth, height: newHeight });
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        console.log(`Canvas initialized: ${newWidth}x${newHeight}, PDF: ${currentPageInfo.width}x${currentPageInfo.height}, Scale: ${finalScale}`);
        
        drawCanvas(cropAreas[currentPage]);
      }
    }
  }, [pageInfo, currentPage, cropAreas]);

  useEffect(() => {
    const handleResize = () => {
      if (pageInfo.length > 0 && canvasRef.current) {
        const canvas = canvasRef.current;
        const currentPageInfo = pageInfo[currentPage - 1];
        if (currentPageInfo) {
          const container = canvas.parentElement;
          const maxContainerWidth = container ? Math.min(container.clientWidth - 32, 900) : 800;
          const maxHeight = Math.min(window.innerHeight - 400, 800);
          const widthScale = maxContainerWidth / currentPageInfo.width;
          const heightScale = maxHeight / currentPageInfo.height;
          const scale = Math.min(widthScale, heightScale, 1);
          
          const newWidth = Math.floor(currentPageInfo.width * scale);
          const newHeight = Math.floor(currentPageInfo.height * scale);
          
          setCanvasSize({ width: newWidth, height: newHeight });
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          drawCanvas(cropAreas[currentPage]);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageInfo, currentPage, cropAreas]);

  return (
    <div className="space-y-6">
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
            onClick={onCrop}
            disabled={isProcessing}
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
              drawCanvas();
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}

      {/* PDF Rendering and Canvas */}
      <div className="border border-border rounded-lg p-4 bg-muted/30 overflow-hidden">
        <div className="relative flex justify-center items-center min-h-[400px]">
          {file && !pdfError && (
            <div className="relative">
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
                <Page
                  pageNumber={currentPage}
                  width={canvasSize.width}
                  renderMode="canvas"
                  onLoadSuccess={() => {
                    drawCanvas(cropAreas[currentPage]);
                  }}
                  onLoadError={(error) => {
                    console.error('Page load error:', error);
                    setPdfError(`Failed to load page ${currentPage}`);
                  }}
                  loading={
                    <div className="flex items-center justify-center" style={{ width: canvasSize.width, height: canvasSize.height }}>
                      <div className="text-muted-foreground">Loading page...</div>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center" style={{ width: canvasSize.width, height: canvasSize.height }}>
                      <div className="text-error">Failed to load page</div>
                    </div>
                  }
                />
              </Document>
              
              {!pdfError && (
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 border-2 border-dashed border-blue-500 rounded pointer-events-auto ${tool === 'crop' ? 'cursor-crosshair' : 'cursor-default'}`}
                  style={{ backgroundColor: 'transparent', userSelect: 'none' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              )}
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