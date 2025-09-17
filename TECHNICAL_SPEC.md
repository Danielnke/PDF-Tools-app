# PDF Tools App - Technical Specifications

## 🏗️ Architecture Overview

### System Architecture
The application follows a modern Next.js architecture with both client-side and server-side PDF processing capabilities:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes    │    │   PDF Engine    │
│   (React/Next)  │◄──►│   (Next.js)     │◄──►│   (pdf-lib)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Upload   │    │   File Storage  │    │   External APIs │
│   (Drag & Drop) │    │   (Temporary)   │    │   (OCR, etc.)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Processing Strategy
- **Server-side processing**: All compression handled server-side using pdf-lib
- **File Size**: Up to 100MB supported
- **Reliability**: No external dependencies, pure TypeScript implementation
- **Compression Quality**: Three levels (low, medium, high) with progressive enhancement

## 🔧 Core Components Specification

### 1. File Upload System

#### DragDropZone Component
```typescript
interface DragDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes: string[];
  maxFileSize: number;
  maxFiles: number;
  disabled?: boolean;
}
```

**Features:**
- Drag and drop file upload
- File type validation
- File size validation
- Multiple file selection
- Visual feedback for drag states
- Progress indicators

#### File Validation Rules
- **PDF Files**: `.pdf` extension, max 100MB
- **Image Files**: `.jpg`, `.jpeg`, `.png`, max 50MB
- **Office Files**: `.docx`, `.xlsx`, `.pptx`, max 100MB
- **Total Files**: Maximum 10 files per operation

### 2. PDF Processing Engine

#### Compression Strategy
The compression system implements a **Stirling-PDF inspired reliable compression approach** using pure pdf-lib with progressive fallbacks:

**Compression Algorithm:**
- **Quality Levels**: low, medium, high (not numeric)
- **Primary Method**: pdf-lib with optimized SaveOptions
- **Fallback Strategy**: Metadata removal if compression ratio < 10%
- **Progressive Enhancement**: Automatic fallback without external dependencies

**Compression Parameters:**
```typescript
interface CompressionSettings {
  useObjectStreams: true;    // Enable object stream compression
  addDefaultPage: false;     // Skip default page addition
  encodeStreams: true;       // Enable stream encoding
}
```

**Reliability Features:**
- No external dependencies (Ghostscript removed)
- Type-safe implementation with TypeScript
- Automatic cleanup of annotations and metadata
- Progressive fallback for better compression ratios

#### Core Processing Functions
```typescript
// Merge PDFs
export async function mergePDFs(files: File[]): Promise<Uint8Array>

// Split PDF
export async function splitPDF(file: File, pages: number[]): Promise<Uint8Array[]>

// Compress PDF
export async function compressPDF(file: File, quality: 'low' | 'medium' | 'high'): Promise<Uint8Array>

// Convert PDF to Images
export async function pdfToImages(file: File, format: 'jpg' | 'png'): Promise<Blob[]>

// Convert Images to PDF
export async function imagesToPDF(files: File[]): Promise<Uint8Array>
```

#### Processing Options
```typescript
interface ProcessingOptions {
  quality?: number;           // 0.1 - 1.0 for compression
  pages?: number[];          // Specific pages to process
  password?: string;         // For protected PDFs
  watermark?: WatermarkOptions;
  encryption?: EncryptionOptions;
}

interface WatermarkOptions {
  text?: string;
  image?: File;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
}

interface EncryptionOptions {
  userPassword?: string;
  ownerPassword?: string;
  permissions: PDFPermissions;
}
```

### 3. API Routes Structure

#### File Upload Endpoint
```typescript
// /api/upload/route.ts
POST /api/upload
Content-Type: multipart/form-data

Response:
{
  fileIds: string[];
  totalSize: number;
  uploadTime: number;
}
```

#### Processing Endpoints
```typescript
// /api/pdf/compress/route.ts
POST /api/pdf/compress
Content-Type: application/json

Request Body:
{
  filePath: string;
  quality: 'low' | 'medium' | 'high';
}

Response:
{
  message: string;
  fileName: string;
  filePath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  downloadUrl: string;
}

// Legacy endpoints (deprecated)
POST /api/process/merge
POST /api/process/split  
POST /api/process/convert
POST /api/process/edit
```

#### Download Endpoint
```typescript
// /api/download/[fileId]/route.ts
GET /api/download/{fileId}

Response: File stream with appropriate headers
```

### 4. State Management

#### Global App State
```typescript
interface AppState {
  currentTool: string;
  uploadedFiles: UploadedFile[];
  processingStatus: ProcessingStatus;
  results: ProcessingResult[];
  errors: ErrorState[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadTime: Date;
  thumbnailUrl?: string;
}

interface ProcessingStatus {
  isProcessing: boolean;
  currentOperation: string;
  progress: number;
  estimatedTime?: number;
}
```

#### Context Providers
```typescript
// FileUploadContext - Manages file upload state
// ProcessingContext - Manages PDF processing operations  
// UIContext - Manages UI state (modals, toasts, themes)
```

### 5. Component Library

#### UI Components
```typescript
// Button variants
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
}

// Card component for tool displays
interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ComponentType;
  href: string;
  features: string[];
}

// Progress indicator
interface ProgressProps {
  value: number;
  max: number;
  showPercentage?: boolean;
  variant: 'default' | 'success' | 'error';
}
```

## 🔐 Security Specifications

### File Security
- **Input Validation**: Strict file type and size validation
- **Malware Scanning**: Basic file signature verification
- **Temporary Storage**: Files deleted after processing
- **Access Control**: Unique file IDs prevent unauthorized access

### Data Protection
- **No Persistent Storage**: Files not permanently stored
- **Memory Management**: Proper cleanup of file buffers
- **Error Handling**: No sensitive data in error messages
- **Rate Limiting**: API endpoint protection

### PDF Security Features
```typescript
interface PDFSecurity {
  // Password protection
  setUserPassword(password: string): void;
  setOwnerPassword(password: string): void;
  
  // Permissions
  allowPrinting: boolean;
  allowModifying: boolean;
  allowCopying: boolean;
  allowAnnotations: boolean;
  
  // Encryption level
  encryptionLevel: 40 | 128 | 256; // bit encryption
}
```

## 📊 Performance Specifications

### Client-Side Processing Limits
- **File Size**: Maximum 10MB per file
- **Memory Usage**: Maximum 100MB total
- **Processing Time**: Maximum 30 seconds
- **Concurrent Operations**: Maximum 1 operation at a time

### Server-Side Processing Capabilities
- **File Size**: Maximum 100MB per file
- **Memory Usage**: Configurable based on server resources
- **Processing Time**: Maximum 5 minutes
- **Concurrent Operations**: Queue-based processing

### Optimization Strategies
```typescript
// Lazy loading for heavy libraries
const PDFProcessor = lazy(() => import('./pdf-processor'));

// Web Workers for heavy computations
const worker = new Worker('./pdf-worker.js');

// Memory management
function cleanupResources(files: File[]) {
  files.forEach(file => {
    if (file.stream) {
      file.stream.cancel();
    }
  });
}
```

## 🧪 Testing Specifications

### Unit Testing
- **Components**: React Testing Library
- **Utils**: Jest with coverage requirements
- **API Routes**: API testing with mock files
- **PDF Operations**: Test with sample PDFs

### Integration Testing
- **File Upload Flow**: End-to-end upload testing
- **Processing Pipeline**: Full processing workflows
- **Error Handling**: Error scenario testing
- **Performance**: Load testing with large files

### Test File Requirements
```typescript
// Test file specifications
const TEST_FILES = {
  smallPDF: 'test-small.pdf',      // < 1MB
  largePDF: 'test-large.pdf',      // > 10MB
  protectedPDF: 'test-protected.pdf', // Password protected
  corruptPDF: 'test-corrupt.pdf',  // Corrupted file
  multiPagePDF: 'test-multi.pdf',  // 10+ pages
};
```

## 🌐 Browser Compatibility

### Supported Browsers
- **Chrome**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Edge**: Version 90+

### Feature Requirements
- **File API**: For file upload and processing
- **Web Workers**: For background processing
- **Canvas API**: For PDF rendering
- **IndexedDB**: For temporary file storage
- **Service Workers**: For offline functionality (future)

### Progressive Enhancement
- **Core Features**: Work without JavaScript
- **Enhanced Features**: Require modern browser APIs
- **Fallback Options**: Server-side processing for unsupported browsers

## 📱 Responsive Design Specifications

### Breakpoints
```css
/* Mobile First Approach */
sm: '640px',   /* Small devices */
md: '768px',   /* Medium devices */
lg: '1024px',  /* Large devices */
xl: '1280px',  /* Extra large devices */
2xl: '1536px'  /* 2X Extra large devices */
```

### Layout Specifications
- **Mobile (< 768px)**: Single column, stacked layout
- **Tablet (768px - 1024px)**: Two column grid
- **Desktop (> 1024px)**: Three column grid with sidebar

### Touch Interactions
- **File Upload**: Large touch targets (44px minimum)
- **Tool Cards**: Hover states adapted for touch
- **PDF Viewer**: Touch gestures for zoom and pan

This technical specification provides the detailed foundation for implementing each component of the PDF tools application with proper architecture, security, and performance considerations.

## 📏 PDF Crop Tool - Technical Specifications

### Architecture Overview

The PDF Crop Tool implements a client-server architecture with interactive canvas-based cropping interface:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Crop Canvas   │    │   PDF Renderer  │    │   Crop Engine   │
│   (React/HTML5) │◄──►│   (pdf-lib/js)  │◄──►│   (Server-side) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Crop Controls  │    │  Image Cache    │    │  Coordinate     │
│  (UI Components)│    │  (Temp Storage) │    │  Conversion     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components Specification

#### 1. PDF Crop Viewer System

**PdfCropViewer Component**
```typescript
interface PdfCropViewerProps {
  file: File;
  onCropChange: (pageNumber: number, cropRegion: CropRegion) => void;
  selectedPages: Set<number>;
  currentPage: number;
  zoomLevel: number;
}

interface CropRegion {
  x: number;              // X coordinate (0-1 normalized or PDF units)
  y: number;              // Y coordinate
  width: number;          // Width of crop region
  height: number;         // Height of crop region
}
```

**Features:**
- PDF page rendering with react-pdf or pdf.js
- Zoomable and scrollable page container
- Overlay crop selection canvas
- Page navigation controls
- Real-time coordinate display

#### 2. Interactive Crop Canvas

**CropCanvas Component**
```typescript
interface CropCanvasProps {
  pageImage: string;      // Base64 or URL to page image
  dimensions: { width: number; height: number };
  cropRegion: CropRegion;
  onCropChange: (crop: CropRegion) => void;
  onCropComplete: (crop: CropRegion) => void;
  disabled?: boolean;
}
```

**Canvas Features:**
- HTML5 Canvas or Fabric.js/Konva implementation
- Drag to create crop rectangle
- Resize handles (8 points: corners + sides)
- Visual feedback (overlay, grid lines, dimensions)
- Mouse and touch event handling
- Coordinate normalization and validation

**Interaction Patterns:**
- Click and drag to create initial crop area
- Drag corners/edges to resize
- Drag center to move crop region
- Double-click to reset crop
- Keyboard shortcuts for precision adjustment

#### 3. Page Management System

**PageThumbnailGrid Component**
```typescript
interface PageThumbnailGridProps {
  pages: Array<{
    pageNumber: number;
    thumbnailUrl: string;
    hasCrop: boolean;
    isSelected: boolean;
  }>;
  onPageSelect: (pageNumber: number) => void;
  onPageToggle: (pageNumber: number) => void;
  selectionMode: 'single' | 'multiple';
}
```

**Features:**
- Lazy-loaded thumbnail grid
- Visual crop indicators (badges/overlays)
- Batch selection with checkboxes
- Current page highlighting
- Responsive grid layout

#### 4. Crop Controls Interface

**CropControls Component**
```typescript
interface CropControlsProps {
  cropMode: 'single' | 'selected' | 'all';
  onCropModeChange: (mode: CropMode) => void;
  presetRatios: Array<{ name: string; ratio: number }>;
  onPresetApply: (ratio: number) => void;
  coordinates: CropRegion;
  onCoordinateChange: (coords: CropRegion) => void;
}
```

**Control Features:**
- Crop mode selection (radio buttons)
- Preset aspect ratios (A4, Letter, Square, Custom)
- Manual coordinate input fields
- Reset and clear buttons
- Apply to selected/all pages

### API Endpoints Specification

#### 1. PDF to Images Conversion
```typescript
// /api/pdf/crop/convert
POST /api/pdf/crop/convert
Content-Type: application/json

Request Body:
{
  filePath: string;
  pageNumbers?: number[];     // Optional: specific pages
  resolution?: number;        // DPI (default: 150)
  format?: 'png' | 'jpeg';   // Image format
}

Response:
{
  success: boolean;
  images: Array<{
    pageNumber: number;
    imageUrl: string;         // Temporary URL
    width: number;
    height: number;
    fileSize: number;
  }>;
  totalPages: number;
  conversionTime: number;
}

Error Response:
{
  success: false;
  error: string;
  code: 'INVALID_PDF' | 'CONVERSION_FAILED' | 'FILE_TOO_LARGE';
}
```

#### 2. Crop Processing Engine
```typescript
// /api/pdf/crop/process
POST /api/pdf/crop/process
Content-Type: application/json

Request Body:
{
  filePath: string;
  cropRegions: Array<{
    pageNumber: number;
    x: number;                // PDF coordinate system
    y: number;
    width: number;
    height: number;
  }>;
  outputOptions?: {
    maintainAspectRatio?: boolean;
    backgroundColor?: string;    // For padding
    quality?: number;           // 0.1 - 1.0
  };
}

Response:
{
  success: boolean;
  croppedFilePath: string;
  downloadUrl: string;
  fileSize: number;
  pageCount: number;
  processingTime: number;
  compressionRatio?: string;
}
```

#### 3. Real-time Crop Preview
```typescript
// /api/pdf/crop/preview
POST /api/pdf/crop/preview
Content-Type: application/json

Request Body:
{
  filePath: string;
  pageNumber: number;
  cropRegion: CropRegion;
  previewSize?: { width: number; height: number };
}

Response:
{
  success: boolean;
  previewImageUrl: string;
  originalDimensions: { width: number; height: number };
  croppedDimensions: { width: number; height: number };
  previewSize: { width: number; height: number };
}
```

### Data Models and State Management

#### Crop Tool State
```typescript
interface CropToolState {
  // File management
  pdfFile: File | null;
  uploadProgress: number;
  totalPages: number;
  
  // Page rendering
  pageImages: Map<number, {
    imageUrl: string;
    width: number;
    height: number;
    loaded: boolean;
  }>;
  
  // Crop management
  cropData: Map<number, CropRegion>;
  selectedPages: Set<number>;
  currentPage: number;
  cropMode: 'single' | 'selected' | 'all';
  
  // UI state
  zoomLevel: number;
  isProcessing: boolean;
  processingProgress: number;
  previewUrl?: string;
  
  // Error handling
  errors: Array<{
    type: 'upload' | 'conversion' | 'processing';
    message: string;
    timestamp: Date;
  }>;
}
```

#### Coordinate System Management
```typescript
interface CoordinateConverter {
  // Convert screen coordinates to PDF coordinates
  screenToPDF(screenCoords: Point, pageSize: Size, canvasSize: Size): Point;
  
  // Convert PDF coordinates to screen coordinates
  pdfToScreen(pdfCoords: Point, pageSize: Size, canvasSize: Size): Point;
  
  // Normalize coordinates (0-1 range)
  normalize(coords: CropRegion, pageSize: Size): CropRegion;
  
  // Denormalize coordinates (absolute values)
  denormalize(coords: CropRegion, pageSize: Size): CropRegion;
  
  // Validate crop boundaries
  validateCrop(crop: CropRegion, pageSize: Size): boolean;
}
```

### Processing Engine Specification

#### PDF Processing Pipeline
```typescript
class PDFCropProcessor {
  // Convert PDF pages to images for preview
  async convertToImages(
    pdfPath: string, 
    options: ConversionOptions
  ): Promise<PageImage[]>;
  
  // Process crop operations
  async cropPages(
    pdfPath: string, 
    cropRegions: CropRegion[]
  ): Promise<ProcessingResult>;
  
  // Generate crop preview
  async generatePreview(
    pdfPath: string, 
    pageNumber: number, 
    cropRegion: CropRegion
  ): Promise<PreviewResult>;
  
  // Coordinate system utilities
  convertCoordinates(
    coords: CropRegion, 
    fromSystem: 'screen' | 'pdf', 
    toSystem: 'screen' | 'pdf',
    pageInfo: PageInfo
  ): CropRegion;
}
```

#### Image Processing Options
```typescript
interface ConversionOptions {
  resolution: number;         // DPI (72-300)
  format: 'png' | 'jpeg';
  quality: number;           // 0.1-1.0 for JPEG
  backgroundColor: string;   // Hex color
  antialiasing: boolean;
}

interface ProcessingOptions {
  maintainAspectRatio: boolean;
  backgroundColor?: string;
  padding?: number;
  outputFormat: 'pdf';
  compression: boolean;
}
```

### Performance Specifications

#### Frontend Performance
- **Image Loading**: Lazy loading with intersection observer
- **Canvas Rendering**: Debounced updates (300ms)
- **Memory Management**: Image cleanup and garbage collection
- **Responsive Updates**: RequestAnimationFrame for smooth interactions

#### Backend Performance
- **Image Conversion**: Cached results for repeated operations
- **Processing Queue**: Background job processing for large files
- **Memory Limits**: 500MB per operation
- **Timeout Handling**: 5-minute processing timeout

#### Optimization Strategies
```typescript
// Frontend optimization
const useCropCanvas = () => {
  const [cropRegion, setCropRegion] = useState<CropRegion>();
  
  // Debounced crop updates
  const debouncedCropChange = useMemo(
    () => debounce((crop: CropRegion) => {
      onCropChange(crop);
    }, 300),
    [onCropChange]
  );
  
  // Memoized canvas operations
  const canvasOperations = useMemo(() => ({
    drawCropOverlay,
    handleMouseEvents,
    updateCropRegion
  }), [pageSize, zoomLevel]);
};

// Backend optimization
class ImageCache {
  private cache = new Map<string, CachedImage>();
  
  async getPageImage(pdfPath: string, pageNumber: number): Promise<string> {
    const cacheKey = `${pdfPath}:${pageNumber}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.url;
    }
    
    const imageUrl = await this.convertPage(pdfPath, pageNumber);
    this.cache.set(cacheKey, { url: imageUrl, timestamp: Date.now() });
    
    return imageUrl;
  }
}
```

### Security Specifications

#### File Security
- **Input Validation**: PDF file signature verification
- **Size Limits**: 100MB maximum file size
- **Type Checking**: MIME type and file extension validation
- **Malware Scanning**: Basic file structure analysis

#### Coordinate Validation
```typescript
function validateCropRegion(crop: CropRegion, pageSize: Size): ValidationResult {
  const errors: string[] = [];
  
  // Boundary validation
  if (crop.x < 0 || crop.x >= pageSize.width) {
    errors.push('Crop X coordinate out of bounds');
  }
  
  // Minimum size validation
  if (crop.width < 10 || crop.height < 10) {
    errors.push('Crop region too small (minimum 10x10 pixels)');
  }
  
  // Maximum size validation
  if (crop.width > pageSize.width || crop.height > pageSize.height) {
    errors.push('Crop region exceeds page boundaries');
  }
  
  return { isValid: errors.length === 0, errors };
}
```

#### Rate Limiting
- **API Calls**: 10 requests per minute per IP
- **File Processing**: 3 concurrent operations per user
- **Image Generation**: 20 page conversions per hour

### Testing Specifications

#### Unit Testing
```typescript
// Coordinate conversion tests
describe('CoordinateConverter', () => {
  test('should convert screen to PDF coordinates correctly', () => {
    const converter = new CoordinateConverter();
    const result = converter.screenToPDF(
      { x: 100, y: 100 },
      { width: 612, height: 792 },  // Letter size PDF
      { width: 300, height: 400 }   // Canvas size
    );
    expect(result).toEqual({ x: 204, y: 198 });
  });
});

// Crop validation tests
describe('CropValidation', () => {
  test('should reject out-of-bounds crop regions', () => {
    const crop = { x: -10, y: 0, width: 100, height: 100 };
    const validation = validateCropRegion(crop, { width: 612, height: 792 });
    expect(validation.isValid).toBe(false);
  });
});
```

#### Integration Testing
```typescript
// End-to-end crop workflow
describe('PDF Crop Workflow', () => {
  test('should complete full crop operation', async () => {
    // Upload PDF
    const uploadResponse = await uploadFile(testPDF);
    
    // Convert to images
    const conversionResponse = await convertToImages(uploadResponse.filePath);
    
    // Apply crop
    const cropResponse = await processCrop({
      filePath: uploadResponse.filePath,
      cropRegions: [{ pageNumber: 1, x: 0, y: 0, width: 300, height: 400 }]
    });
    
    expect(cropResponse.success).toBe(true);
    expect(cropResponse.downloadUrl).toBeDefined();
  });
});
```

This comprehensive technical specification provides the detailed implementation guide for the PDF Crop Tool with complete API documentation, component specifications, and testing strategies.