export type ToolType = 'select' | 'text' | 'pen' | 'highlighter' | 'rect';

export interface BaseAnnotation {
  id: string;
  page: number;
  x: number; // PDF units (points)
  y: number; // from top in PDF units
  w: number;
  h: number;
  rotation?: number;
  opacity: number;
  color: string; // hex or rgb string
  z: number;
  type: ToolType;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  font: 'Helvetica' | 'TimesRoman';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface PenPoint { x: number; y: number; }

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlighter';
  points: PenPoint[]; // in PDF units
  strokeWidth: number; // in PDF units
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  strokeWidth: number;
  fill?: string;
  filled?: boolean;
}

export type Annotation = TextAnnotation | PenAnnotation | RectAnnotation;

export interface PageViewportInfo {
  pageNumber: number;
  pdfWidth: number; // in PDF points
  pdfHeight: number; // in PDF points
  scale: number; // displayPixels / pdf points for width
}
