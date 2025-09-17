"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection, DropEvent } from "react-dropzone";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFiles, getAcceptedExtensions } from "@/lib/validation/file-validation";

interface DragDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes: string[];
  maxFileSize: number;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function DragDropZone({
  onFilesSelected,
  acceptedTypes,
  maxFileSize,
  maxFiles = 10,
  disabled = false,
  className
}: DragDropZoneProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
    setValidationErrors([]);

    // Validate files
    const validation = validateFiles(acceptedFiles, {
      acceptedTypes,
      maxFileSize,
      maxFiles
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Handle rejected files
    if (fileRejections.length > 0) {
      const rejectionErrors = fileRejections.map(({ file, errors }) => 
        `${file.name}: ${errors.map((e) => e.message).join(', ')}`
      );
      setValidationErrors(rejectionErrors);
      return;
    }

    onFilesSelected(acceptedFiles);
  }, [acceptedTypes, maxFileSize, maxFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxFileSize,
    maxFiles,
    disabled
  });

  const acceptedExtensions = getAcceptedExtensions(acceptedTypes);
  const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-accent bg-accent/5 scale-[1.02]"
            : "border-border hover:border-accent/50 hover:bg-accent/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "p-4 rounded-full transition-colors",
            isDragActive ? "bg-accent/20" : "bg-surface"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragActive ? "text-accent" : "text-muted"
            )} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {isDragActive ? "Drop files here" : "Drop files or click to upload"}
            </h3>
            <p className="text-sm text-muted">
              Supports: {acceptedExtensions.join(", ")} • Max {maxSizeMB}MB per file
              {maxFiles > 1 && ` • Up to ${maxFiles} files`}
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted">
            <FileText className="h-4 w-4" />
            <span>Your files are processed securely and never stored</span>
          </div>
        </div>
      </div>
      
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-error" />
            <span className="text-sm font-medium text-error">Upload Errors</span>
          </div>
          <ul className="space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-xs text-error">
                • {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}