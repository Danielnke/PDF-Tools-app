"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import EditorToolbar from './toolbar';
import { Annotation, PageViewportInfo, PenAnnotation, PenPoint, RectAnnotation, TextAnnotation, ToolType } from './types';
import { DragDropZone } from '@/components/file-upload/drag-drop-zone';
import { FILE_TYPES, MAX_FILE_SIZES } from '@/lib/constants/file-types';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

const Document = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });

if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  });
}

const TARGET_WIDTH = 720; // display width per page

export default function PdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [viewport, setViewport] = useState<PageViewportInfo[]>([]);

  const [tool, setTool] = useState<ToolType>('select');
  const [color, setColor] = useState('#ff4757');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(18);

  const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({});
  const [selected, setSelected] = useState<{ page: number; id: string } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const historyRef = useRef<Annotation[][]>([]);
  const futureRef = useRef<Annotation[][]>([]);

  const scaleFor = useCallback((page: number) => {
    const info = viewport.find(v => v.pageNumber === page);
    return info?.scale || 1;
  }, [viewport]);

  const toPdfPt = useCallback((page: number, xPx: number, yPx: number) => {
    const s = scaleFor(page);
    const pdfX = xPx / s;
    const info = viewport.find(v => v.pageNumber === page)!;
    const pdfYFromTop = yPx / s; // store from top
    return { x: pdfX, yTop: pdfYFromTop, height: info.pdfHeight };
  }, [scaleFor, viewport]);

  const pushHistory = useCallback(() => {
    const snapshot = Object.values(annotations).flat();
    historyRef.current.push(JSON.parse(JSON.stringify(snapshot)));
    futureRef.current = [];
  }, [annotations]);

  const undo = useCallback(() => {
    if (!historyRef.current.length) return;
    const current = Object.values(annotations).flat();
    futureRef.current.push(current);
    const prev = historyRef.current.pop()!;
    const grouped: Record<number, Annotation[]> = {};
    for (const a of prev) {
      grouped[a.page] = grouped[a.page] || [];
      grouped[a.page].push(a);
    }
    setAnnotations(grouped);
    setSelected(null);
  }, [annotations]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push(Object.values(annotations).flat());
    const grouped: Record<number, Annotation[]> = {};
    for (const a of next) {
      grouped[a.page] = grouped[a.page] || [];
      grouped[a.page].push(a);
    }
    setAnnotations(grouped);
  }, [annotations]);

  const onFilesSelected = useCallback((files: File[]) => {
    if (!files.length) return;
    const f = files[0];
    setFile(f);
    f.arrayBuffer().then(setPdfData).catch(console.error);
  }, []);

  const startText = useCallback((page: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    const conv = toPdfPt(page, xPx, yPx);
    const id = uuidv4();
    const text: TextAnnotation = {
      id,
      page,
      type: 'text',
      x: conv.x,
      y: conv.yTop,
      w: 200,
      h: fontSize * 1.4,
      opacity: 1,
      color,
      z: Date.now(),
      text: 'Edit text',
      fontSize,
      font: 'Helvetica'
    };
    pushHistory();
    setAnnotations(prev => ({ ...prev, [page]: [...(prev[page] || []), text] }));
    setSelected({ page, id });
  }, [color, fontSize, pushHistory, toPdfPt]);

  const handleMouseDown = useCallback((page: number, e: React.MouseEvent) => {
    if (tool === 'pen' || tool === 'highlighter') {
      setIsDrawing(true);
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const yPx = e.clientY - rect.top;
      const { x, yTop } = toPdfPt(page, xPx, yPx);
      const id = uuidv4();
      const ann: PenAnnotation = {
        id,
        page,
        type: tool,
        opacity: tool === 'highlighter' ? 0.35 : 1,
        color,
        z: Date.now(),
        w: 0,
        h: 0,
        points: [{ x, y: yTop }],
        strokeWidth: Math.max(1, strokeWidth)
      };
      pushHistory();
      setAnnotations(prev => ({ ...prev, [page]: [...(prev[page] || []), ann] }));
    } else if (tool === 'rect') {
      setIsDrawing(true);
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const yPx = e.clientY - rect.top;
      const { x, yTop } = toPdfPt(page, xPx, yPx);
      const id = uuidv4();
      const ann: RectAnnotation = { id, page, type: 'rect', x, y: yTop, w: 1, h: 1, opacity: 1, color, z: Date.now(), strokeWidth: Math.max(1, strokeWidth) };
      pushHistory();
      setAnnotations(prev => ({ ...prev, [page]: [...(prev[page] || []), ann] }));
    } else if (tool === 'text') {
      startText(page, e);
    }
  }, [tool, color, strokeWidth, toPdfPt, startText, pushHistory]);

  const handleMouseMove = useCallback((page: number, e: React.MouseEvent) => {
    if (!isDrawing) return;
    const list = annotations[page];
    if (!list || !list.length) return;
    const current = list[list.length - 1];
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    const { x, yTop } = toPdfPt(page, xPx, yPx);

    if (current.type === 'pen' || current.type === 'highlighter') {
      const pen = current as PenAnnotation;
      setAnnotations(prev => ({ ...prev, [page]: [...list.slice(0, -1), { ...pen, points: [...pen.points, { x, y: yTop }] }] }));
    } else if (current.type === 'rect') {
      const r = current as RectAnnotation;
      setAnnotations(prev => ({ ...prev, [page]: [...list.slice(0, -1), { ...r, w: x - r.x, h: yTop - r.y }] }));
    }
  }, [annotations, isDrawing, toPdfPt]);

  const handleMouseUp = useCallback(() => setIsDrawing(false), []);

  const onTextChange = useCallback((page: number, id: string, text: string) => {
    setAnnotations(prev => ({ ...prev, [page]: (prev[page] || []).map(a => a.id === id && a.type === 'text' ? { ...(a as TextAnnotation), text } : a) }));
  }, []);

  const onDelete = useCallback(() => {
    if (!selected) return;
    const { page, id } = selected;
    pushHistory();
    setAnnotations(prev => ({ ...prev, [page]: (prev[page] || []).filter(a => a.id !== id) }));
    setSelected(null);
  }, [selected, pushHistory]);

  const clearAll = useCallback(() => {
    pushHistory();
    setAnnotations({});
    setSelected(null);
  }, [pushHistory]);

  const exportPdf = useCallback(async () => {
    if (!file || !pdfData) return;
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const orig = await PDFDocument.load(pdfData);
    const helv = await orig.embedFont(StandardFonts.Helvetica);
    const times = await orig.embedFont(StandardFonts.TimesRoman);

    const pages = orig.getPages();

    // Helper: draw pen/highlighter by rasterizing to PNG per page
    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1;
      const page = pages[i];
      const { width, height } = page.getSize();
      const anns = (annotations[pageNum] || []).sort((a,b) => a.z - b.z);

      // Offscreen canvas for strokes
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0,0,canvas.width, canvas.height);

      for (const a of anns) {
        if (a.type === 'pen' || a.type === 'highlighter') {
          const pen = a as PenAnnotation;
          if (pen.points.length < 2) continue;
          ctx.globalAlpha = pen.opacity;
          ctx.strokeStyle = pen.color;
          ctx.lineWidth = pen.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          const start = pen.points[0];
          ctx.moveTo(start.x, height - start.y);
          for (let j = 1; j < pen.points.length; j++) {
            const p = pen.points[j];
            ctx.lineTo(p.x, height - p.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Embed raster if any pixels drawn
      const hasPixels = (() => {
        const imgData = ctx.getImageData(0,0,1,1).data; // cheap touch
        return true; // always embed; simpler and safe
      })();

      if (hasPixels) {
        const pngBytes = await new Promise<Uint8Array>(resolve => canvas.toBlob(async (blob) => resolve(new Uint8Array(await blob!.arrayBuffer())), 'image/png'));
        const png = await orig.embedPng(pngBytes);
        page.drawImage(png, { x: 0, y: 0, width, height, opacity: 1 });
      }

      // Draw vector/text on top
      for (const a of anns) {
        if (a.type === 'rect') {
          const r = a as RectAnnotation;
          page.drawRectangle({ x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h) * -1 + height, width: Math.abs(r.w), height: Math.abs(r.h), color: undefined, borderWidth: r.strokeWidth, borderColor: rgbFromString(a.color), opacity: a.opacity });
        }
        if (a.type === 'text') {
          const t = a as TextAnnotation;
          const f = t.font === 'Helvetica' ? helv : times;
          page.drawText(t.text || '', { x: t.x, y: height - t.y - t.h + (t.fontSize*0.2), size: t.fontSize, font: f, color: rgbFromString(t.color), opacity: t.opacity });
        }
      }
    }

    const bytes = await orig.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `edited_${file.name.replace(/\.[^.]+$/, '')}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [annotations, file, pdfData]);

  // Page load success -> compute scale mapping
  const onPageLoad = useCallback((pageNumber: number, page: any) => {
    const vp = page.getViewport({ scale: 1 });
    const s = TARGET_WIDTH / vp.width;
    setViewport(prev => {
      const next = prev.filter(p => p.pageNumber !== pageNumber);
      next.push({ pageNumber, pdfWidth: vp.width, pdfHeight: vp.height, scale: s });
      return [...next];
    });
  }, []);

  const renderOverlay = useCallback((pageNumber: number) => {
    const anns = annotations[pageNumber] || [];
    const info = viewport.find(v => v.pageNumber === pageNumber);
    if (!info) return null;
    const s = info.scale;

    return (
      <div className="absolute inset-0" onMouseDown={(e) => handleMouseDown(pageNumber, e)} onMouseMove={(e) => handleMouseMove(pageNumber, e)} onMouseUp={handleMouseUp}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${info.pdfWidth} ${info.pdfHeight}`} style={{ transform: `scale(${s})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
          {anns.map(a => {
            if (a.type === 'pen' || a.type === 'highlighter') {
              const p = a as PenAnnotation;
              const d = p.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
              return <path key={a.id} d={d} stroke={a.color} strokeWidth={p.strokeWidth} fill="none" opacity={a.opacity} strokeLinecap="round" strokeLinejoin="round" />;
            }
            if (a.type === 'rect') {
              const r = a as RectAnnotation;
              return <rect key={a.id} x={Math.min(r.x, r.x + r.w)} y={Math.min(r.y, r.y + r.h)} width={Math.abs(r.w)} height={Math.abs(r.h)} fill="none" stroke={a.color} strokeWidth={r.strokeWidth} opacity={a.opacity} />;
            }
            if (a.type === 'text') {
              const t = a as TextAnnotation;
              return (
                <foreignObject key={a.id} x={t.x} y={t.y} width={Math.max(50, t.w)} height={Math.max(20, t.h)}>
                  <div style={{ pointerEvents: 'auto' }}>
                    <input
                      value={t.text}
                      onChange={(e) => onTextChange(pageNumber, t.id, e.target.value)}
                      className="w-full bg-transparent border border-border rounded px-1 text-foreground"
                      style={{ color: t.color, fontSize: t.fontSize, lineHeight: 1.2 }}
                    />
                  </div>
                </foreignObject>
              );
            }
            return null;
          })}
        </svg>
      </div>
    );
  }, [annotations, viewport, handleMouseDown, handleMouseMove, handleMouseUp, onTextChange]);

  return (
    <div className="w-full">
      <EditorToolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        fontSize={fontSize}
        setFontSize={setFontSize}
        undo={undo}
        redo={redo}
        canUndo={historyRef.current.length > 0}
        canRedo={futureRef.current.length > 0}
        onExport={exportPdf}
        onClear={clearAll}
        disabled={!file}
      />

      {!file && (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <DragDropZone onFilesSelected={onFilesSelected} acceptedTypes={[FILE_TYPES.PDF]} maxFileSize={MAX_FILE_SIZES.PDF} maxFiles={1} />
          <div className="mt-4 text-sm text-muted">Upload a PDF to start editing. Use the toolbar to add text, draw, highlight, or add shapes.</div>
        </div>
      )}

      {file && pdfData && (
        <div className="mx-auto max-w-5xl px-4 py-10">
          <Document file={{ data: pdfData }} onLoadSuccess={(info: { numPages: number }) => setNumPages(info.numPages)} loading={<div className="p-6 text-muted-foreground">Loading PDF…</div>}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
              <div key={pageNumber} className="relative mx-auto bg-white shadow-sm border border-border rounded-md overflow-hidden mb-8" style={{ width: '100%', maxWidth: TARGET_WIDTH }}>
                <div className="relative" onDoubleClick={(e) => tool === 'text' && startText(pageNumber, e)}>
                  <Page pageNumber={pageNumber} width={TARGET_WIDTH} renderTextLayer={false} renderAnnotationLayer={false} className="block mx-auto" onLoadSuccess={(page) => onPageLoad(pageNumber, page)} />
                  {renderOverlay(pageNumber)}
                </div>
              </div>
            ))}
          </Document>

          <div className="flex justify-center">
            <Button variant="outline" onClick={() => { setFile(null); setPdfData(null); setAnnotations({}); setNumPages(0); }}>Choose another PDF</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function rgbFromString(color: string) {
  // Accept #rrggbb or rgb(r,g,b)
  if (color.startsWith('#')) {
    const r = parseInt(color.substring(1,3),16)/255;
    const g = parseInt(color.substring(3,5),16)/255;
    const b = parseInt(color.substring(5,7),16)/255;
    return (awaitRgb()).rgb(r,g,b);
  }
  const m = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i);
  if (m) {
    const r = parseInt(m[1],10)/255, g = parseInt(m[2],10)/255, b = parseInt(m[3],10)/255;
    return (awaitRgb()).rgb(r,g,b);
  }
  return (awaitRgb()).rgb(0,0,0);
}

function awaitRgb(){
  // Lazy import pdf-lib's rgb helper
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('pdf-lib');
  return mod;
}
