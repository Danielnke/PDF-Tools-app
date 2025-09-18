"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Crop } from "lucide-react";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

const Document = dynamic(() => import("react-pdf").then(m => m.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then(m => m.Page), { ssr: false });

if (typeof window !== "undefined") {
  import("react-pdf").then(({ pdfjs }) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  }).catch(() => {});
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

interface PdfViewerContinuousProps {
  file: File;
  pageInfo: PageInfo[];
  cropAreas: { [pageNumber: number]: CropArea };
  onCropAreaChange: (pageNumber: number, area: CropArea) => void;
}

export function PdfViewerContinuous({ file, pageInfo, cropAreas, onCropAreaChange }: PdfViewerContinuousProps) {
  const [dragging, setDragging] = useState<{ page: number; startX: number; startY: number; target: HTMLDivElement | null } | null>(null);
  const [tempArea, setTempArea] = useState<{ [page: number]: CropArea }>({});
  const scaleMapRef = useRef<Record<number, number>>({});

  const handleMouseDown = useCallback((pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setDragging({ page: pageNumber, startX, startY, target });
    setTempArea(prev => ({ ...prev, [pageNumber]: { x: startX, y: startY, width: 0, height: 0 } }));

    const onMove = (ev: MouseEvent) => {
      const r = target.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      const width = Math.abs(x - startX);
      const height = Math.abs(y - startY);
      const left = Math.min(startX, x);
      const top = Math.min(startY, y);
      setTempArea(prev => ({ ...prev, [pageNumber]: { x: Math.max(0, left), y: Math.max(0, top), width, height } }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const scale = scaleMapRef.current[pageNumber] || 1;
      const a = (prevTemp => prevTemp[pageNumber])(tempArea);
      const area = tempArea[pageNumber];
      if (area && area.width > 10 && area.height > 10) {
        onCropAreaChange(pageNumber, { x: area.x / scale, y: area.y / scale, width: area.width / scale, height: area.height / scale });
      }
      setTempArea(prev => ({ ...prev, [pageNumber]: undefined as any }));
      setDragging(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [onCropAreaChange, scaleMapRef, tempArea]);

  const handleMouseMove = useCallback((pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || dragging.page !== pageNumber) return;
    const target = dragging.target || (e.currentTarget as HTMLDivElement);
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = Math.abs(x - dragging.startX);
    const height = Math.abs(y - dragging.startY);
    const left = Math.min(dragging.startX, x);
    const top = Math.min(dragging.startY, y);
    setTempArea(prev => ({ ...prev, [pageNumber]: { x: Math.max(0, left), y: Math.max(0, top), width, height } }));
  }, [dragging]);

  const handleMouseUp = useCallback((pageNumber: number) => {
    if (!dragging || !tempArea[pageNumber]) return;
    setDragging(null);
    const scale = scaleMapRef.current[pageNumber] || 1;
    const a = tempArea[pageNumber];
    if (a.width > 10 && a.height > 10) {
      onCropAreaChange(pageNumber, {
        x: a.x / scale,
        y: a.y / scale,
        width: a.width / scale,
        height: a.height / scale,
      });
    }
    setTempArea(prev => ({ ...prev, [pageNumber]: undefined as any }));
  }, [dragging, tempArea, onCropAreaChange]);

  const targetPageWidth = 640; // compact vertical preview

  return (
    <div className="relative h-full w-full overflow-auto bg-background">
      <Document file={file} loading={<div className="p-6 text-muted-foreground">Loading PDF…</div>}>
        <div className="mx-auto w-full max-w-[720px] px-4 py-8 space-y-8">
          {pageInfo.map(info => (
            <div key={info.pageNumber} className="relative mx-auto bg-white shadow-sm border border-border rounded-md overflow-hidden" style={{ width: "100%" }}>
              <div
                className="relative"
                onMouseDown={(e) => handleMouseDown(info.pageNumber, e)}
                onMouseMove={(e) => handleMouseMove(info.pageNumber, e)}
                onMouseUp={() => handleMouseUp(info.pageNumber)}
                onMouseLeave={() => handleMouseUp(info.pageNumber)}
              >
                <Page
                  pageNumber={info.pageNumber}
                  width={targetPageWidth}
                  renderMode="canvas"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="block mx-auto"
                  onLoadSuccess={(page) => {
                    const viewport = page.getViewport({ scale: 1 });
                    const scale = targetPageWidth / viewport.width;
                    scaleMapRef.current[info.pageNumber] = scale;
                  }}
                />

                {/* Existing crop */}
                {cropAreas[info.pageNumber] && cropAreas[info.pageNumber].width > 0 && (
                  <div
                    className="absolute border-2 border-green-500 bg-green-500/10 shadow-lg"
                    style={{
                      left: (cropAreas[info.pageNumber].x) * (scaleMapRef.current[info.pageNumber] || 1),
                      top: (cropAreas[info.pageNumber].y) * (scaleMapRef.current[info.pageNumber] || 1),
                      width: (cropAreas[info.pageNumber].width) * (scaleMapRef.current[info.pageNumber] || 1),
                      height: (cropAreas[info.pageNumber].height) * (scaleMapRef.current[info.pageNumber] || 1),
                    }}
                  >
                    <div className="absolute -top-7 left-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded shadow">
                      Cropped Area
                    </div>
                  </div>
                )}

                {/* Temp selection */}
                {tempArea[info.pageNumber] && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500/20 shadow-lg"
                    style={{
                      left: tempArea[info.pageNumber].x,
                      top: tempArea[info.pageNumber].y,
                      width: tempArea[info.pageNumber].width,
                      height: tempArea[info.pageNumber].height,
                    }}
                  >
                    <div className="absolute -top-7 left-0 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded shadow">
                      {Math.round(tempArea[info.pageNumber].width)} × {Math.round(tempArea[info.pageNumber].height)} px
                    </div>
                  </div>
                )}

                {!cropAreas[info.pageNumber] && !tempArea[info.pageNumber] && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded text-xs font-medium shadow-lg">
                      <div className="flex items-center gap-2">
                        <Crop className="h-3 w-3" />
                        Drag to select crop
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}
