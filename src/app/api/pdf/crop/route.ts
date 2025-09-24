import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { PDFCropService, MultiCropOptions } from '@/lib/pdfCrop';
import { PDFCropValidator } from '@/lib/validation/pdfCrop.validate';
import { buildOutputFileName } from '@/lib/api-utils/pdf-helpers';
import { withCors, preflight } from '@/lib/api-utils/cors';

export async function OPTIONS() { return preflight(); }

export async function POST(request: NextRequest) {
  let outputDir: string | null = null;
  
  try {
    const contentType = request.headers.get('content-type') || '';
    let filePath: string | null = null;
    let cropData: any = null;
    let cropMode: string | null = null;
    let originalName: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = (form.get('file') || (form.getAll('files')[0] as any)) as File | null;
      const uploadDir = join(tmpdir(), 'pdf-tools-uploads', uuidv4());
      await mkdir(uploadDir, { recursive: true });
      if (file) {
        const out = join(uploadDir, `${uuidv4()}.pdf`);
        await writeFile(out, Buffer.from(await file.arrayBuffer()));
        filePath = out;
        originalName = file.name;
      }
      cropMode = (form.get('cropMode') as string) || null;
      const cropField = form.get('cropData') as string | null;
      if (cropField) {
        try { cropData = JSON.parse(cropField); } catch { cropData = null; }
      }
    } else {
      const body = await request.json();
      filePath = body.filePath;
      cropData = body.cropData;
      cropMode = body.cropMode;
      originalName = body.originalName;
    }

    // Convert to legacy format for compatibility
    const crops = cropData?.map((item: { pageNumber: number; cropArea: { x: number; y: number; width: number; height: number; unit?: string } }) => ({
      pageNumber: item.pageNumber,
      x: item.cropArea.x,
      y: item.cropArea.y,
      width: item.cropArea.width,
      height: item.cropArea.height,
      unit: item.cropArea.unit || 'pt'
    })) || [];

    const applyToAllPages = cropMode === 'all';

    // Validate file path
    const filePathValidation = PDFCropValidator.validateFilePath(filePath);
    if (!filePathValidation.isValid) {
      return withCors(NextResponse.json(
        { error: filePathValidation.errors.join(', ') },
        { status: 400 }
      ));
    }

    // Validate crop options
    const cropOptions: MultiCropOptions = {
      crops: crops || [],
      applyToAllPages: applyToAllPages || false,
      maintainAspectRatio: false,
    };

    const validationResult = PDFCropValidator.validateMultiCropOptions(cropOptions);
    if (!validationResult.isValid) {
      return withCors(NextResponse.json(
        { error: validationResult.errors.join(', ') },
        { status: 400 }
      ));
    }

    outputDir = join(tmpdir(), 'pdf-tools-results', uuidv4());
    await mkdir(outputDir, { recursive: true });

    const outputPath = join(outputDir, buildOutputFileName(originalName, 'crop-pdf'));

    try {
      const cropService = new PDFCropService();
      const fileBytes = await readFile(filePath);
      
      // Validate PDF before processing
      const isValid = await cropService.validatePDF(fileBytes);
      if (!isValid) {
        return withCors(NextResponse.json(
          { error: 'Invalid or corrupted PDF file' },
          { status: 400 }
        ));
      }

      // Get page dimensions for validation
      const pageDimensions = await cropService.getPageDimensions(fileBytes);
      
      // Validate page numbers
      const pageNumbers = cropOptions.crops.map(crop => crop.pageNumber);
      const pageRangeValidation = PDFCropValidator.validatePageRange(pageNumbers, pageDimensions.length);
      if (!pageRangeValidation.isValid) {
        return withCors(NextResponse.json(
          { error: pageRangeValidation.errors.join(', ') },
          { status: 400 }
        ));
      }

      // Sanitize crop options
      const sanitizedCrops = cropOptions.crops.map(crop => 
        PDFCropValidator.sanitizeCropOptions(crop)
      );

      // Crop the PDF
      const { croppedBytes, results } = await cropService.cropPDF(fileBytes, {
        ...cropOptions,
        crops: sanitizedCrops,
      });

      // Save the cropped PDF
      await writeFile(outputPath, croppedBytes);

      // Calculate sizes and processing info
      const [origStat, outStat] = await Promise.all([
        stat(filePath),
        stat(outputPath),
      ]);
      const totalProcessingTime = results.reduce((sum, result) => sum + result.processingTime, 0);
      const avgProcessingTime = results.length > 0 ? totalProcessingTime / results.length : 0;

      const fileName = outputPath.split(/[\/\\]/).pop() || buildOutputFileName(originalName, 'crop-pdf');
      const dirName = outputDir.split(/[\/\\]/).pop() || '';
      
      console.log('Output path:', outputPath);
      console.log('Output dir:', outputDir);
      console.log('Extracted fileName:', fileName);
      console.log('Extracted dirName:', dirName);

      return withCors(NextResponse.json({
        success: true,
        fileName,
        downloadUrl: `/api/download/${fileName}?dir=${dirName}`,
        originalSize: origStat.size,
        croppedSize: outStat.size,
        results: results.map(result => ({
          pageNumber: result.pageNumber,
          originalDimensions: {
            width: result.originalWidth,
            height: result.originalHeight,
          },
          croppedDimensions: {
            width: result.croppedWidth,
            height: result.croppedHeight,
          },
          cropArea: result.cropArea,
        })),
        processingInfo: {
          totalPagesProcessed: results.length,
          averageProcessingTime: avgProcessingTime,
          totalProcessingTime,
        },
      }));

    } catch (error) {
      console.error('PDF cropping error:', error);
      
      let errorMessage = 'PDF cropping failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return withCors(NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      ));
    }

  } catch (error) {
    console.error('Request processing error:', error);
    
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return withCors(NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      ));
  } finally {
    // Cleanup temporary files (but not the output)
    if (outputDir) {
      // Don't delete the output directory as it contains the result file
      // The cleanup should be handled by the download endpoint or a cleanup service
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return withCors(NextResponse.json(
        { error: 'filePath parameter is required' },
        { status: 400 }
      ));
    }

    const cropService = new PDFCropService();
    const fileBytes = await readFile(filePath);
    
    const isValid = await cropService.validatePDF(fileBytes);
    if (!isValid) {
      return withCors(NextResponse.json(
          { error: 'Invalid or corrupted PDF file' },
          { status: 400 }
        ));
    }

    const pageDimensions = await cropService.getPageDimensions(fileBytes);

    return withCors(NextResponse.json({
      success: true,
      pageCount: pageDimensions.length,
      pageDimensions: pageDimensions.map((dim, index) => ({
        pageNumber: index + 1,
        width: dim.width,
        height: dim.height,
      })),
    }));

  } catch (error) {
    console.error('PDF analysis error:', error);
    
    let errorMessage = 'Failed to analyze PDF';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return withCors(NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      ));
  }
}
