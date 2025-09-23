import { PDFTool } from "@/types/pdf";
import { FILE_TYPES, MAX_FILE_SIZES } from "./file-types";

export const PDF_TOOLS: PDFTool[] = [
  {
    id: 'merge',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one document',
    icon: 'merge',
    href: '/merge-pdf',
    features: ['Unlimited files', 'Fast processing', 'No watermarks'],
    maxFiles: 10,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'split',
    title: 'Split PDF',
    description: 'Extract pages or split PDF into multiple files',
    icon: 'split',
    href: '/split-pdf',
    features: ['Page ranges', 'Individual pages', 'Batch processing'],
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'compress',
    title: 'Compress PDF',
    description: 'Reduce PDF file size while maintaining quality',
    icon: 'archive',
    href: '/compress-pdf',
    features: ['Smart compression', 'Quality control', 'Size preview'],
    maxFiles: 5,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'crop',
    title: 'Crop PDF',
    description: 'Crop pages in your PDF document to specific dimensions',
    icon: 'crop',
    href: '/crop-pdf',
    features: ['Precise cropping', 'Visual preview', 'Multiple pages'],
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert DOCX documents to PDF quickly and securely',
    icon: 'file-text',
    href: '/word-to-pdf',
    features: ['Accurate text', 'A4 pagination', 'Fast processing'],
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZES.OFFICE,
    acceptedTypes: [FILE_TYPES.DOCX]
  },
  {
    id: 'rotate',
    title: 'Rotate PDF',
    description: 'Rotate pages in your PDF document',
    icon: 'rotate',
    href: '/rotate-pdf',
    features: ['90° increments', 'Multiple pages', 'Batch rotation'],
    maxFiles: 5,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'watermark',
    title: 'Add Watermark',
    description: 'Add text or image watermarks to your PDF',
    icon: 'watermark',
    href: '/watermark-pdf',
    features: ['Text & image', 'Position control', 'Opacity settings'],
    maxFiles: 5,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'protect',
    title: 'Protect PDF',
    description: 'Add password protection and encryption',
    icon: 'lock',
    href: '/protect-pdf',
    features: ['Password protection', 'Permission control', 'Encryption'],
    maxFiles: 5,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  },
  {
    id: 'unlock',
    title: 'Unlock PDF',
    description: 'Remove password protection from PDF',
    icon: 'unlock',
    href: '/unlock-pdf',
    features: ['Password removal', 'Instant processing', 'No data loss'],
    maxFiles: 5,
    maxFileSize: MAX_FILE_SIZES.PDF,
    acceptedTypes: [FILE_TYPES.PDF]
  }
];
