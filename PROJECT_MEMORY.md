# PDF-tools-app Project Memory

## Recent Changes & Fixes

### TypeScript Error Resolution (2024)
- **Fixed**: "Cannot find module '/components/ui/alert'" TypeScript error
- **Solution**: Added missing React import to alert component and restored proper import structure

### Alert Component Fixes
- **File**: `src/components/ui/alert.tsx`
- **Changes**: Added `import * as React from "react"` at the top of the file
- **Status**: TypeScript compilation errors resolved

### Import Structure Updates
- **File**: `src/app/merge-pdf/page.tsx`
- **Changes**: Restored direct component imports instead of barrel exports
- **Components**: Alert, Button, Card, Progress imported directly from their respective files

### PDF Merge Functionality
- **API Route**: `src/app/api/pdf/merge/route.ts`
- **Enhancement**: Added `mkdir` import and directory creation for output files
- **Security**: Improved file handling and directory structure

### Download API Route
- **File**: `src/app/api/download/[filename]/route.ts`
- **Fix**: Replaced glob-based file searching with fs-based approach
- **Improvement**: Better error handling and security

### Constants Fix
- **File**: `src/app/merge-pdf/page.tsx`
- **Change**: Fixed import from `PDF_TOOL` to `PDF_TOOLS` for consistency

## Current Project Structure
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Build Tool**: Turbopack
- **Key Features**: PDF merging, file upload/download, responsive design

## Component Status
- ✅ Alert component: Fixed and working
- ✅ Merge functionality: Complete and tested
- ✅ Download API: Enhanced security
- ✅ TypeScript: All errors resolved