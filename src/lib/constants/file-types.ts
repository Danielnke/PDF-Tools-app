export const FILE_TYPES = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  HTML: 'text/html',
} as const;

export const FILE_EXTENSIONS = {
  PDF: ['.pdf'],
  IMAGE: ['.jpg', '.jpeg', '.png'],
  OFFICE: ['.docx', '.xlsx', '.pptx'],
  HTML: ['.html', '.htm'],
} as const;

export const MAX_FILE_SIZES = {
  PDF: 100 * 1024 * 1024,    // 100MB
  IMAGE: 50 * 1024 * 1024,   // 50MB
  OFFICE: 100 * 1024 * 1024, // 100MB
  HTML: 20 * 1024 * 1024,    // 20MB
} as const;

export const PROCESSING_LIMITS = {
  MAX_FILES: 10,
  MAX_PROCESSING_TIME: 5 * 60 * 1000, // 5 minutes
  CLIENT_SIDE_LIMIT: 10 * 1024 * 1024, // 10MB - switch to server-side above this
} as const;

export const PDF_QUALITY_LEVELS = {
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 0.8,
  MAXIMUM: 1.0,
} as const;

export const SUPPORTED_CONVERSIONS = {
  'pdf-to-word': {
    input: FILE_TYPES.PDF,
    output: FILE_TYPES.DOCX,
    title: 'PDF to Word',
  },
  'pdf-to-excel': {
    input: FILE_TYPES.PDF,
    output: FILE_TYPES.XLSX,
    title: 'PDF to Excel',
  },
  'pdf-to-powerpoint': {
    input: FILE_TYPES.PDF,
    output: FILE_TYPES.PPTX,
    title: 'PDF to PowerPoint',
  },
  'word-to-pdf': {
    input: FILE_TYPES.DOCX,
    output: FILE_TYPES.PDF,
    title: 'Word to PDF',
  },
  'excel-to-pdf': {
    input: FILE_TYPES.XLSX,
    output: FILE_TYPES.PDF,
    title: 'Excel to PDF',
  },
  'powerpoint-to-pdf': {
    input: FILE_TYPES.PPTX,
    output: FILE_TYPES.PDF,
    title: 'PowerPoint to PDF',
  },
  'pdf-to-jpg': {
    input: FILE_TYPES.PDF,
    output: FILE_TYPES.JPEG,
    title: 'PDF to JPG',
  },
  'pdf-to-png': {
    input: FILE_TYPES.PDF,
    output: FILE_TYPES.PNG,
    title: 'PDF to PNG',
  },
  'image-to-pdf': {
    input: [FILE_TYPES.JPEG, FILE_TYPES.PNG],
    output: FILE_TYPES.PDF,
    title: 'Image to PDF',
  },
} as const;
