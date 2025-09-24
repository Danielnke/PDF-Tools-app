"use client";

import { useRef, useState, useCallback } from "react";
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

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface PdfViewerContinuousProps {
  file: File;
  pageInfo: PageInfo[];
  cropAreas: { [pageNumber: number]: CropArea };
  onCropAreaChange: (pageNumber: number, area: CropArea) => void;
}

export function PdfViewerContinuous({ file, pageInfo, cropAreas, onCropAreaChange }: PdfViewerContinuousProps) {
  // Drawing state for initial selection
  const [dragging, setDragging] = useState<{ page: number; startX: number; startY: number; target: HTMLDivElement | null } | null>(null);
  const [tempArea, setTempArea] = useState<{ [page: number]: CropArea }>({});

  // Editing state (move/resize) for persistent crop
  const [moving, setMoving] = useState<{ page: number; startClientX: number; startClientY: number; startArea: CropArea } | null>(null);
  const [resizing, setResizing] = useState<{ page: number; handle: ResizeHandle; startClientX: number; startClientY: number; startArea: CropArea } | null>(null);

  const scaleMapRef = useRef<Record<number, number>>({});

  const getScale = useCallback((pageNumber: number) => scaleMapRef.current[pageNumber] || 1, []);

  const clampArea = useCallback((area: CropArea, page: PageInfo) => {
    const x = Math.max(0, Math.min(area.x, page.width));
    const y = Math.max(0, Math.min(area.y, page.height));
    const w = Math.max(1, Math.min(area.width, page.width - x));
    const h = Math.max(1, Math.min(area.height, page.height - y));
    return { x, y, width: w, height: h } as CropArea;
  }, []);

  // Start drawing only if no crop exists for this page
  const handleMouseDown = useCallback((pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => {
    const existing = cropAreas[pageNumber];
    if (existing && existing.width > 0 && existing.height > 0) {
      return; // Prevent creating a new box when one already exists
    }

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
      const scale = getScale(pageNumber);
      const area = tempArea[pageNumber];
      if (area && area.width > 10 && area.height > 10) {
        onCropAreaChange(pageNumber, { x: area.x / scale, y: area.y / scale, width: area.width / scale, height: area.height / scale });
      }
      setTempArea(prev => {
        const newTempArea = { ...prev };
        delete newTempArea[pageNumber];
        return newTempArea;
      });
      setDragging(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cropAreas, getScale, onCropAreaChange, tempArea]);

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
    const scale = getScale(pageNumber);
    const a = tempArea[pageNumber];
    if (a.width > 10 && a.height > 10) {
      onCropAreaChange(pageNumber, {
        x: a.x / scale,
        y: a.y / scale,
        width: a.width / scale,
        height: a.height / scale,
      });
    }
    setTempArea(prev => {
      const newTempArea = { ...prev };
      delete newTempArea[pageNumber];
      return newTempArea;
    });
  }, [dragging, tempArea, onCropAreaChange, getScale]);

  // Start moving existing crop
  const startMove = useCallback((page: number, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const area = cropAreas[page];
    if (!area) return;
    setMoving({ page, startClientX: e.clientX, startClientY: e.clientY, startArea: area });

    const onMove = (ev: MouseEvent) => {
      setMoving(prev => {
        if (!prev) return null;
        const s = getScale(page);
        const dxPx = ev.clientX - prev.startClientX;
        const dyPx = ev.clientY - prev.startClientY;
        const dx = dxPx / s;
        const dy = dyPx / s;
        const pageMeta = pageInfo.find(p => p.pageNumber === page)!;
        const next = clampArea({ ...prev.startArea, x: prev.startArea.x + dx, y: prev.startArea.y + dy }, pageMeta);
        onCropAreaChange(page, next);
        return { ...prev };
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setMoving(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cropAreas, getScale, onCropAreaChange, pageInfo, clampArea]);

  // Start resizing existing crop
  const startResize = useCallback((page: number, handle: ResizeHandle, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const area = cropAreas[page];
    if (!area) return;
    setResizing({ page, handle, startClientX: e.clientX, startClientY: e.clientY, startArea: area });

    const onMove = (ev: MouseEvent) => {
      setResizing(prev => {
        if (!prev) return null;
        const s = getScale(page);
        const dxPx = ev.clientX - prev.startClientX;
        const dyPx = ev.clientY - prev.startClientY;
        const dx = dxPx / s;
        const dy = dyPx / s;
        const start = prev.startArea;
        let next: CropArea = { ...start };
        // Adjust based on handle
        if (prev.handle.includes("e")) {
          next.width = Math.max(1, start.width + dx);
        }
        if (prev.handle.includes("s")) {
          next.height = Math.max(1, start.height + dy);
        }
        if (prev.handle.includes("w")) {
          next.x = start.x + dx;
          next.width = Math.max(1, start.width - dx);
        }
        if (prev.handle.includes("n")) {
          next.y = start.y + dy;
          next.height = Math.max(1, start.height - dy);
        }
        const pageMeta = pageInfo.find(p => p.pageNumber === page)!;
        next = clampArea(next, pageMeta);
        onCropAreaChange(page, next);
        return { ...prev };
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setResizing(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cropAreas, getScale, onCropAreaChange, pageInfo, clampArea]);

  const targetPageWidth = 520;

  return (
    <div className="relative w-full bg-background">
      <Document file={file} loading={<div className="p-6 text-muted-foreground">Loading PDF…</div>}>
        <div className="mx-auto w-full max-w-[640px] px-4 py-10 space-y-10">
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

                {/* Persistent crop area with handles */}
                {cropAreas[info.pageNumber] && cropAreas[info.pageNumber].width > 0 && (
                  <div
                    className="absolute border-2 border-green-500 bg-green-500/10 shadow-lg cursor-move"
                    style={{
                      left: (cropAreas[info.pageNumber].x) * getScale(info.pageNumber),
                      top: (cropAreas[info.pageNumber].y) * getScale(info.pageNumber),
                      width: (cropAreas[info.pageNumber].width) * getScale(info.pageNumber),
                      height: (cropAreas[info.pageNumber].height) * getScale(info.pageNumber),
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => startMove(info.pageNumber, e)}
                  >
                    <div className="absolute -top-7 left-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded shadow">
                      Cropped Area
                    </div>
                    {/* Clear button */}
                    <button
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCropAreaChange(info.pageNumber, { x: 0, y: 0, width: 0, height: 0 });
                      }}
                      aria-label="Clear selection"
                    >
                      ×
                    </button>
                    {/* Resize handles */}
                    {(["nw","n","ne","e","se","s","sw","w"] as ResizeHandle[]).map(h => (
                      <div
                        key={h}
                        onMouseDown={(e) => startResize(info.pageNumber, h, e)}
                        className="absolute bg-white border border-green-600"
                        style={{
                          width: 10,
                          height: 10,
                          cursor:
                            h === 'n' ? 'ns-resize' :
                            h === 's' ? 'ns-resize' :
                            h === 'e' ? 'ew-resize' :
                            h === 'w' ? 'ew-resize' :
                            h === 'ne' ? 'nesw-resize' :
                            h === 'nw' ? 'nwse-resize' :
                            h === 'se' ? 'nwse-resize' :
                            'nesw-resize',
                          left:
                            h.includes('w') ? -5 : h.includes('e') ? 'calc(100% - 5px)' : 'calc(50% - 5px)',
                          top:
                            h.includes('n') ? -5 : h.includes('s') ? 'calc(100% - 5px)' : 'calc(50% - 5px)',
                        }}
                        aria-label={`Resize ${h}`}
                      />
                    ))}
                  </div>
                )}

                {/* Temp selection (first draw) */}
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

                {/* Hint */}
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
