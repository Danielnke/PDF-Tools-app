'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  MousePointer
} from 'lucide-react';

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { ssr: false });

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
  const [tool, setTool] = useState<'select' | 'move' | 'zoom'>('select');
  const [zoom, setZoom] = useState(1);

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
        height: 0
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
      
      setCurrentCropArea(newCropArea);
      drawCanvas(newCropArea);
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDragging && currentCropArea) {
      onCropAreaChange(currentPage, currentCropArea);
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
    
    // Clear canvas (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Make canvas transparent to show PDF underneath
    canvas.style.backgroundColor = 'transparent';
    
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
        
        drawCanvas(cropAreas[currentPage]);
      }
    }
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
      <div className="border border-border rounded-lg p-4 bg-muted/30">
        <div className="relative flex justify-center">
          {file && (
            <div className="absolute inset-0">
              <Document file={file}>
                <Page
                  pageNumber={currentPage}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  renderMode="canvas"
                  className="border border-border rounded"
                />
              </Document>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="border border-border rounded cursor-crosshair relative z-10"
            style={{ maxWidth: '100%', height: 'auto', backgroundColor: 'transparent' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
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