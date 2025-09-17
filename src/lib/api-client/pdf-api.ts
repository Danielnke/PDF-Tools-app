import {
  UploadResponse,
  MergeRequest,
  MergeResponse,
  SplitRequest,
  SplitResponse,
  CompressRequest,
  CompressResponse,
  CropRequest,
  CropResponse,
  PageAnalysisResponse,
  ApiResponse,
} from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

class PdfApiClient {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return {
        success: true,
        message: data.message || 'Success',
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Request failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async uploadFiles(files: File[]): Promise<ApiResponse<UploadResponse>> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return {
        success: true,
        message: data.message || 'Files uploaded successfully',
        data,
      };
    } catch (error) {
      console.error('Upload failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async mergePdfs(request: MergeRequest): Promise<ApiResponse<MergeResponse>> {
    return this.makeRequest<MergeResponse>('/api/pdf/merge', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async splitPdf(request: SplitRequest): Promise<ApiResponse<SplitResponse>> {
    return this.makeRequest<SplitResponse>('/api/pdf/split', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async compressPdf(request: CompressRequest): Promise<ApiResponse<CompressResponse>> {
    return this.makeRequest<CompressResponse>('/api/pdf/compress', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async downloadFile(filename: string): Promise<Response> {
    return fetch(`${API_BASE_URL}/api/download/${filename}`);
  }

  // Utility methods for file handling
  async validateFiles(files: File[], toolId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validExtensions = this.getSupportedExtensions(toolId);

    files.forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (!extension || !validExtensions.includes(extension)) {
        errors.push(`${file.name}: Invalid file type. Supported: ${validExtensions.join(', ')}`);
      }

      if (file.size > this.getMaxFileSize(toolId)) {
        errors.push(`${file.name}: File too large. Max size: ${this.formatFileSize(this.getMaxFileSize(toolId))}`);
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB warning
        warnings.push(`${file.name}: Large file may take longer to process`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private getSupportedExtensions(toolId: string): string[] {
    const toolConfigs: Record<string, string[]> = {
      merge: ['pdf'],
      split: ['pdf'],
      compress: ['pdf'],
      convert: ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx', 'pptx'],
    };

    return toolConfigs[toolId] || ['pdf'];
  }

  private getMaxFileSize(toolId: string): number {
    const maxSizes: Record<string, number> = {
      merge: 50 * 1024 * 1024, // 50MB
      split: 50 * 1024 * 1024, // 50MB
      compress: 100 * 1024 * 1024, // 100MB
      convert: 50 * 1024 * 1024, // 50MB
    };

    return maxSizes[toolId] || 50 * 1024 * 1024;
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Crop PDF
  async cropPdf(request: CropRequest): Promise<ApiResponse<CropResponse>> {
    return this.makeRequest<CropResponse>('/api/pdf/crop', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Analyze PDF pages
  async analyzePdf(filePath: string): Promise<ApiResponse<PageAnalysisResponse>> {
    return this.makeRequest<PageAnalysisResponse>(`/api/pdf/crop?filePath=${encodeURIComponent(filePath)}`, {
      method: 'GET',
    });
  }

  // Progress tracking
  async trackProgress(
    jobId: string,
    callback: (progress: number, message: string) => void
  ): Promise<void> {
    // This would typically connect to a WebSocket or polling endpoint
    // For now, we'll simulate progress updates
    const steps = [
      'Uploading files...',
      'Validating files...',
      'Processing PDF...',
      'Generating output...',
      'Preparing download...',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      callback(((i + 1) / steps.length) * 100, steps[i]);
    }
  }
}

// Export singleton instance
export const pdfApi = new PdfApiClient();

// React hook for API calls
export const usePdfApi = () => {
  return {
    uploadFiles: pdfApi.uploadFiles.bind(pdfApi),
    mergePdfs: pdfApi.mergePdfs.bind(pdfApi),
    splitPdf: pdfApi.splitPdf.bind(pdfApi),
    compressPdf: pdfApi.compressPdf.bind(pdfApi),
    cropPdf: pdfApi.cropPdf.bind(pdfApi),
    analyzePdf: pdfApi.analyzePdf.bind(pdfApi),
    downloadFile: pdfApi.downloadFile.bind(pdfApi),
    validateFiles: pdfApi.validateFiles.bind(pdfApi),
    trackProgress: pdfApi.trackProgress.bind(pdfApi),
  };
};