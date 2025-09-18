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

export interface CropResult {
  fileName: string;
  downloadUrl: string;
  originalSize: number;
  croppedSize: number;
  results: Array<{
    pageNumber: number;
    originalDimensions: { width: number; height: number };
    croppedDimensions: { width: number; height: number };
    cropArea: CropArea;
  }>;
}

export async function analyzePDF(file: File): Promise<PageInfo[]> {
  // Dynamic import to avoid SSR issues
  const { pdfjs } = await import('react-pdf');
  
  // Configure worker source to use local file
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const pageInfo: PageInfo[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pageInfo.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
    });
  }
  
  return pageInfo;
}

export function calculateScaledCropArea(
  cropArea: CropArea,
  canvasWidth: number,
  canvasHeight: number,
  pageWidth: number,
  pageHeight: number
): CropArea {
  const scaleX = pageWidth / canvasWidth;
  const scaleY = pageHeight / canvasHeight;
  
  // Compute clamped coordinates first
  const clampedX = Math.max(0, cropArea.x * scaleX);
  const clampedY = Math.max(0, cropArea.y * scaleY);
  
  // Compute width and height using clamped values, ensuring non-negative results
  const width = Math.max(0, Math.min(cropArea.width * scaleX, pageWidth - clampedX));
  const height = Math.max(0, Math.min(cropArea.height * scaleY, pageHeight - clampedY));
  
  return {
    x: clampedX,
    y: clampedY,
    width: width,
    height: height,
  };
}

export async function cropPDF(
  file: File,
  cropAreas: { [pageNumber: number]: CropArea },
  onProgress?: (progress: number) => void
): Promise<CropResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { pdfjs } = await import('react-pdf');
    
    // Configure worker source to use local file
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const results: CropResult['results'] = [];
    let totalOriginalSize = 0;
    let totalCroppedSize = 0;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) {
        onProgress(Math.round((i / pdf.numPages) * 100));
      }
      
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      
      const cropArea = cropAreas[i] || { x: 0, y: 0, width: viewport.width, height: viewport.height };
      
      // Create canvas for original page
      const originalCanvas = document.createElement('canvas');
      const originalCtx = originalCanvas.getContext('2d');
      if (!originalCtx) {
        throw new Error('2D context unavailable for original canvas');
      }
      originalCanvas.width = viewport.width;
      originalCanvas.height = viewport.height;
      
      await page.render({
        canvasContext: originalCtx,
        viewport: viewport,
      }).promise;
      
      // Create canvas for cropped area
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) {
        throw new Error('2D context unavailable for cropped canvas');
      }
      croppedCanvas.width = cropArea.width;
      croppedCanvas.height = cropArea.height;
      
      croppedCtx.drawImage(
        originalCanvas,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );
      
      results.push({
        pageNumber: i,
        originalDimensions: { width: viewport.width, height: viewport.height },
        croppedDimensions: { width: cropArea.width, height: cropArea.height },
        cropArea: cropArea,
      });
      
      totalOriginalSize += originalCanvas.width * originalCanvas.height * 4;
      totalCroppedSize += croppedCanvas.width * croppedCanvas.height * 4;
    }
    
    // Create new PDF using pdf-lib
    const { PDFDocument } = await import('pdf-lib');
    const newPdf = await PDFDocument.create();
    const originalPdf = await PDFDocument.load(arrayBuffer);
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalPage = await newPdf.embedPage(originalPdf.getPage(result.pageNumber - 1));
      
      const { width, height } = result.croppedDimensions;
      const page = newPdf.addPage([width, height]);
      
      page.drawPage(originalPage, {
        x: -result.cropArea.x,
        y: -result.cropArea.y,
        width: originalPage.width,
        height: originalPage.height,
      });
    }
    
    const pdfBytes = await newPdf.save();
    const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(pdfBlob);
    
    return {
      fileName: `cropped_${file.name}`,
      downloadUrl,
      originalSize: totalOriginalSize,
      croppedSize: totalCroppedSize,
      results,
    };
  } catch (error) {
    console.error('Error cropping PDF:', error);
    throw new Error('Failed to crop PDF. Please try again.');
  }
}