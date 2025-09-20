'use client';

import { Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface ResultsDisplayProps {
  result: CropResult | null;
  onDownload: (downloadUrl: string, fileName: string) => void;
  onReset: () => void;
}

export function ResultsDisplay({ result, onDownload, onReset }: ResultsDisplayProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!result) return null;

  return (
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
            onClick={() => onDownload(result.downloadUrl, result.fileName)}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={onReset}
          className="w-full"
        >
          Crop Another PDF
        </Button>
      </div>
    </div>
  );
}