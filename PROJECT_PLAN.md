# PDF Tools App - Implementation Plan

## 🎯 Project Overview
A comprehensive PDF tools application similar to "I Love PDF" built with Next.js, featuring a dark theme and modern minimalistic design.

### Technical Requirements
- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS 4 with dark theme support
- **Architecture**: Hybrid SSR/ISR with client-side PDF processing where appropriate
- **Theme**: Dark, modern, minimalistic interface
- **Responsive**: Mobile-first design approach
- **Runtime Target**: React 19 with concurrent features enabled

## 📋 Core PDF Tools to Implement

### Document Management
- ✅ **Merge PDF** – Combine multiple PDFs into a single document (frontend + backend stable)
- ✅ **Split PDF** – Extract or batch separate PDFs with page range support
- ✅ **Compress PDF** – Reduce file size with selectable quality presets
- 🚧 **Crop PDF** – Interactive cropping with multi-page support (export polish remaining)
- ❌ **Organize PDF** – Reorder, delete, and insert pages
- ✅ **Rotate PDF** – Rotate selected pages with preview carousel

### Format Conversions
- ❌ **PDF to Word** – Convert PDFs to editable Word documents
- ❌ **PDF to Excel** – Convert PDF tables to Excel spreadsheets
- ❌ **PDF to PowerPoint** – Convert PDF slides to PowerPoint presentations
- ✅ **Word to PDF** – Convert Word documents to PDF (DOCX pipeline via mammoth)
- ❌ **Excel to PDF** – Convert Excel spreadsheets to PDF
- ❌ **PowerPoint to PDF** – Convert PowerPoint decks to PDF
- ❌ **PDF to JPG/PNG** – Convert PDF pages to raster image formats
- ❌ **JPG/PNG to PDF** – Convert images to PDF documents
- ✅ **HTML to PDF** – Render webpages or HTML files to PDF via Puppeteer

### Security & Editing
- 🚧 **Edit PDF** – Text annotation, drawing, and rectangle tools (needs persistence refinements)
- ❌ **Sign PDF** – Digital signature tooling
- ❌ **Watermark PDF** – Add text or image watermarks
- ❌ **Protect PDF** – Password protection and encryption
- ❌ **Unlock PDF** �� Remove password protection
- ❌ **PDF Reader** – Dedicated viewer with rich navigation

## 🛠️ Technology Stack

### Core Framework
- **Next.js 14** - App Router, SSR capabilities
- **TypeScript** - Type safety and better development experience
- **React 18** - Latest React features and concurrent rendering

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Modern icon library
- **Radix UI** - Accessible UI primitives

### PDF Processing Libraries
- **pdf-lib** – Client-side PDF editing, annotations, and export
- **react-pdf** – Rendering and previewing PDFs in React components
- **@sparticuz/chromium** + **puppeteer** – Headless rendering for HTML-to-PDF workflows
- **html2canvas** – Canvas capture for annotations and previews

### File Processing
- **sharp** – High-performance image manipulation in Node
- **mammoth** – Word (.docx) parsing for Word-to-PDF conversion
- **xlsx** – Excel file parsing utilities
- **formidable** – Multipart upload parsing for API routes
- **uuid** – Unique identifiers for uploaded assets

### Security & Encryption
- **crypto** - Built-in Node.js encryption
- **bcrypt** - Password hashing (if user accounts needed)
- **pdf-lib** - PDF encryption capabilities

## 📁 Project Structure

```
src/
├── app/
│   ├── (tools)/                 # Grouped routes for PDF tools
│   │   ├── merge-pdf/
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx
│   │   ├── split-pdf/
│   │   ├── compress-pdf/
│   │   ├── crop-pdf/              # NEW: PDF crop tool
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx
│   │   ├── convert/
│   │   │   ├── pdf-to-word/
│   │   │   ├── pdf-to-excel/
│   │   │   ├── pdf-to-image/
│   │   │   └── image-to-pdf/
│   │   ├── edit-pdf/
│   │   ├── sign-pdf/
│   │   └── protect-pdf/
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts
│   │   ├── process/
│   │   │   ├── merge/route.ts
│   │   │   ├── split/route.ts
│   │   │   ├── compress/route.ts
│   │   │   └── convert/route.ts
│   │   ├── pdf/
│   │   │   ├── crop/                # NEW: Crop API endpoints
│   │   │   │   ├── convert/route.ts     # PDF to images
│   │   │   │   ├── process/route.ts     # Crop processing
│   │   ���   │   └── preview/route.ts     # Crop preview
│   │   └── download/
│   │       └── [fileId]/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                      # Reusable UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── progress.tsx
│   │   └── toast.tsx
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── footer.tsx
│   ├── file-upload/
│   │   ├── drag-drop-zone.tsx
│   │   ├── file-list.tsx
│   │   └── upload-progress.tsx
│   ├── pdf-viewer/
│   │   ├── pdf-viewer.tsx
│   │   └── pdf-controls.tsx
│   ├── pdf-crop/                # NEW: PDF crop components
│   │   ├── pdf-crop-viewer.tsx
│   │   ├── page-thumbnail-grid.tsx
│   │   ├── crop-canvas.tsx
│   │   ├── crop-controls.tsx
│   │   ├── page-selector.tsx
│   │   └── crop-preview.tsx
│   ├── tool-cards/
│   │   ├── tool-card.tsx
│   │   └── tool-grid.tsx
│   └── common/
│       ├── loading-spinner.tsx
│       └── error-boundary.tsx
├── lib/
│   ├── pdf-utils/
│   │   ├── merge.ts
│   │   ├── split.ts
│   │   ├── compress.ts
│   │   ├── crop.ts                 # NEW: Crop utilities
│   │   └── convert.ts
│   ├── validation/
│   │   ├── file-validation.ts
│   │   └── schemas.ts
│   ├── constants/
│   │   ├── file-types.ts
│   │   └── tool-configs.ts
│   └── utils/
│       ├── file-helpers.ts
│       └── format-helpers.ts
├── types/
│   ├── pdf.ts
│   ├── crop.ts                  # NEW: Crop-specific types
│   └── file.ts
└── styles/
    └── globals.css
```

## 🎨 Design System

### Color Palette (Dark Theme)
- **Background**: `#0a0a0a` (zinc-950)
- **Surface**: `#18181b` (zinc-900)
- **Card**: `#27272a` (zinc-800)
- **Border**: `#3f3f46` (zinc-700)
- **Text Primary**: `#fafafa` (zinc-50)
- **Text Secondary**: `#a1a1aa` (zinc-400)
- **Accent**: `#3b82f6` (blue-500)
- **Success**: `#10b981` (emerald-500)
- **Error**: `#ef4444` (red-500)

### Typography
- **Headings**: Inter font family, semibold weight
- **Body**: Inter font family, regular weight
- **Code**: JetBrains Mono, monospace

### Components
- **Cards**: Rounded corners, subtle shadows, dark backgrounds
- **Buttons**: Rounded, with hover states and loading indicators
- **Inputs**: Dark backgrounds with focused border states
- **Progress**: Smooth animations with gradient fills

## 📈 Implementation Timeline

### Phase 1: Foundation (Days 1-3) ✅ COMPLETED
- [x] Initialize Next.js project with TypeScript
- [x] Configure Tailwind CSS with dark theme
- [x] Set up project structure and routing
- [x] Install and configure development tools
- [x] Create basic layout and navigation

### Phase 2: File Upload System (Days 4-5) ✅ COMPLETED
- [x] Implement drag & drop file upload
- [x] Add file validation and type checking
- [x] Create progress indicators and loading states
- [x] Set up API routes for file handling

### Phase 3: Core PDF Tools (Days 6-12) ✅ COMPLETED
- [x] Merge PDF end-to-end flow
- [x] Split PDF with range parsing UI
- [x] Compress PDF quality presets
- [x] Rotate PDF with preview carousel
- [ ] Crop PDF export polish (carryover)

### Phase 4: Format Conversions (Days 13-17) 🚧 IN PROGRESS
- [x] Word → PDF (DOCX pipeline)
- [x] HTML/URL → PDF (Puppeteer pipeline)
- [ ] PDF → Office formats (Word, Excel, PowerPoint)
- [ ] Office formats → PDF (Excel, PowerPoint)
- [ ] PDF ↔ Image conversions

### Phase 5: Advanced Features (Days 18-22)
- [ ] Finalize PDF editing UX and persistence
- [ ] Digital signing workflows
- [ ] Watermark tooling
- [ ] Password protection and unlocking
- [ ] Page organization and PDF reader

### Phase 6: Polish & Optimization (Days 23-25)
- [ ] Performance optimization and worker tuning
- [ ] Responsive refinements and accessibility audit
- [ ] Enhanced error handling and retry UX
- [ ] Cross-browser and device testing

## 📊 Current Implementation Status

### ✅ **COMPLETED** Features (≈35% Complete)

**Core Infrastructure:**
- ✅ Next.js 15 + TypeScript foundation with App Router
- ✅ Tailwind CSS 4 dark design system and responsive layout
- ✅ Shared file upload/download pipeline with validation and toasts
- ✅ Progress, loading, and alert feedback patterns

**PDF Tools Delivered:**
- ✅ **Merge PDF** – Fully operational
- ✅ **Split PDF** – Range parsing UI with download links
- ✅ **Compress PDF** – Quality presets tied to API
- ✅ **Rotate PDF** – Page carousel + preview worker
- ✅ **Word to PDF** – DOCX ingestion with mammoth
- ✅ **HTML to PDF** – URL/file driven rendering via Puppeteer

### 🚧 **IN PROGRESS** Features
- 🔄 **Crop PDF** – Interactive UI complete, export refinement pending
- 🔄 **Edit PDF** – Annotation tools present, persistence polish required
- 🔄 **Conversion Expansion** – Planning pipelines for PDF↔Office/Image formats

### ⚡ **NOT STARTED** Features
- ❌ Organize PDF (reordering, page removal)
- ❌ PDF to Word/Excel/PowerPoint conversions
- ❌ Excel/PowerPoint to PDF conversions
- ❌ PDF ↔ Image conversion suite
- ❌ Digital signing and watermarking
- ❌ Protect/Unlock PDF flows
- ❌ Dedicated PDF reader experience

## 🎯 Next Steps Priority

### **Immediate Tasks (High Priority)**
1. **Create Split PDF frontend page** - Backend API already complete
2. **Create Compress PDF frontend page** - Backend API already complete
3. **Implement PDF Crop Tool** - Complete frontend + backend implementation
4. **Implement PDF to Image conversion** - Backend + frontend
5. **Implement Image to PDF conversion** - Backend + frontend

### **Medium Priority Tasks**
5. **PDF Reader/Viewer** - Essential for preview functionality
6. **Rotate PDF** - Backend + frontend
7. **PDF to Word conversion** - Backend + frontend

### **Lower Priority Tasks**
8. **Advanced editing features** (Edit, Sign, Watermark, Protect, Unlock)
9. **Office format conversions** (Excel, PowerPoint)
10. **PDF organization tools**

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- Modern web browser

### Installation Commands (PowerShell)
```powershell
# Create Next.js project
npx create-next-app@latest pdf-tools-app --typescript --tailwind --eslint --app

# Navigate to project directory
cd pdf-tools-app

# Install additional dependencies
npm install pdf-lib react-pdf framer-motion lucide-react
npm install sharp mammoth xlsx formidable
npm install @radix-ui/react-dialog @radix-ui/react-progress
npm install -D @types/formidable

# Start development server
npm run dev
```

## 📝 Development Guidelines

### Code Style
- Use TypeScript for all components and utilities
- Follow React hooks patterns and best practices
- Implement proper error boundaries
- Use consistent naming conventions
- Write comprehensive JSDoc comments

### File Handling
- Validate file types and sizes before processing
- Implement chunked uploads for large files
- Provide real-time progress feedback
- Handle errors gracefully with user-friendly messages

### Performance
- Use client-side processing for small files
- Implement server-side processing for large files
- Optimize bundle size with dynamic imports
- Implement proper caching strategies

### Security
- Validate all file inputs on both client and server
- Implement rate limiting for API endpoints
- Sanitize file names and content
- Use secure file storage practices

This comprehensive plan provides the foundation for building a professional-grade PDF tools application with modern Next.js architecture and excellent user experience.

## 📏 PDF Crop Tool - Implementation Plan

### Overview
The PDF Crop Tool allows users to upload a PDF, preview all pages, select crop regions on any combination of pages, and download the cropped result. This tool provides a visual interface for precise PDF page cropping with real-time preview capabilities.

### Core Features
- **File Upload**: Drag & drop or click to upload PDF files
- **Page Preview**: Visual thumbnail grid of all PDF pages
- **Interactive Cropping**: Canvas-based selection tool for each page
- **Multi-page Selection**: Apply crop to single page, selected pages, or all pages
- **Real-time Preview**: Show cropped result before download
- **Batch Processing**: Process multiple pages with same or different crop regions
- **Download Options**: Download cropped PDF with original quality

### Key Components Required

**Frontend Components:**
- `crop-pdf/page.tsx` - Main crop tool page
- `pdf-crop-viewer.tsx` - PDF viewer with crop functionality
- `page-thumbnail-grid.tsx` - Grid view of all PDF pages
- `crop-canvas.tsx` - Interactive crop selection canvas
- `crop-controls.tsx` - Crop tool controls and options
- `page-selector.tsx` - Page selection interface
- `crop-preview.tsx` - Preview of cropped result

**Backend API Endpoints:**
- `/api/pdf/crop/convert` - Convert PDF pages to images
- `/api/pdf/crop/process` - Process crop operations
- `/api/pdf/crop/preview` - Generate crop previews

**New Dependencies:**
- Frontend: `react-pdf`, `fabric` or `konva`, `pdf-dist`
- Backend: `pdf2pic`, `pdf-poppler`, `jimp`, `canvas`

*For detailed technical specifications, API documentation, and implementation details, see [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)*

## 📏 Implementation Timeline for PDF Crop Tool

### Phase 1: Backend Foundation (Days 1-2)
- [ ] Create API endpoints for PDF to image conversion
- [ ] Implement crop processing engine with pdf-lib
- [ ] Set up coordinate system handling
- [ ] Add file validation and error handling

### Phase 2: Frontend Core (Days 3-4)
- [ ] Create crop tool page structure
- [ ] Implement PDF page rendering and thumbnail grid
- [ ] Build interactive crop canvas component
- [ ] Add page navigation and selection

### Phase 3: Integration and Polish (Days 5-6)
- [ ] Connect frontend with backend APIs
- [ ] Implement real-time preview functionality
- [ ] Add batch processing for multiple pages
- [ ] Optimize performance and add error handling

### Phase 4: Testing and Refinement (Day 7)
- [ ] Comprehensive testing with various PDF types
- [ ] Mobile responsiveness and touch support
- [ ] User experience refinements
- [ ] Documentation and deployment preparation
