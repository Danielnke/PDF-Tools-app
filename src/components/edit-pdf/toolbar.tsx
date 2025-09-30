"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Highlighter, Type, Square, MoveLeft, MoveRight, Download, Trash2, MousePointer, Eraser } from 'lucide-react';
import { ToolType } from './types';

type Mode = 'annotate' | 'edit';

interface ToolbarProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  tool: ToolType;
  setTool: (t: ToolType) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (n: number) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function EditorToolbar({ mode, setMode, tool, setTool, color, setColor, strokeWidth, setStrokeWidth, fontSize, setFontSize, undo, redo, canUndo, canRedo, onExport, onClear, disabled }: ToolbarProps) {
  return (
    <div className="sticky top-20 z-30 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-5xl px-4 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant={mode === 'annotate' ? 'default' : 'outline'} onClick={() => setMode('annotate')} disabled={disabled}>Annotate</Button>
          <Button size="sm" variant={mode === 'edit' ? 'default' : 'outline'} onClick={() => setMode('edit')} disabled={disabled}>Edit</Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={tool === 'select' ? 'default' : 'outline'} onClick={() => setTool('select')} disabled={disabled}>
            <MousePointer className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={tool === 'text' ? 'default' : 'outline'} onClick={() => setTool('text')} disabled={disabled}>
            <Type className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={tool === 'pen' ? 'default' : 'outline'} onClick={() => setTool('pen')} disabled={disabled}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={tool === 'highlighter' ? 'default' : 'outline'} onClick={() => setTool('highlighter')} disabled={disabled}>
            <Highlighter className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={tool === 'rect' ? 'default' : 'outline'} onClick={() => setTool('rect')} disabled={disabled}>
            <Square className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={tool === 'redact' ? 'default' : 'outline'} onClick={() => setTool('redact')} disabled={disabled}>
            <Eraser className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 pl-2">
          <label className="text-xs text-muted">Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded border border-border bg-surface" disabled={disabled} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Size</label>
          <input type="range" min={1} max={32} value={strokeWidth} onChange={(e) => setStrokeWidth(parseInt(e.target.value))} disabled={disabled} />
          <span className="text-xs text-muted w-6">{strokeWidth}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Font</label>
          <select value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="h-8 rounded border border-border bg-surface px-2 text-sm" disabled={disabled}>
            {[12,14,16,18,20,24,28,32].map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo || disabled}><MoveLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo || disabled}><MoveRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={onClear} disabled={disabled}><Trash2 className="h-4 w-4" /></Button>
          <Button size="sm" onClick={onExport} disabled={disabled}><Download className="h-4 w-4 mr-1" />Export PDF</Button>
        </div>
      </div>
    </div>
  );
}
