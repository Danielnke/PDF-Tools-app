"use client";

import React, { useState, useCallback } from "react";
import { DragDropZone } from "./drag-drop-zone";
import { FileList } from "./file-list";
import { UploadProgress } from "./upload-progress";
import { Button } from "@/components/ui/button";
import { UploadedFile, ProcessingStatus, PDFTool } from "@/types/pdf";
import { cn } from "@/lib/utils";

interface FileUploadSystemProps {
  tool: PDFTool;
  onProcessFiles?: (files: UploadedFile[]) => Promise<void>;
  className?: string;
}

export function FileUploadSystem({ 
  tool, 
  onProcessFiles,
  className 
}: FileUploadSystemProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentOperation: "",
    progress: 0
  });

  const handleFilesSelected = useCallback((files: File[]) => {
    const newUploadedFiles: UploadedFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      uploadTime: new Date()
    }));

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const handleProcessFiles = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    setProcessingStatus({
      isProcessing: true,
      currentOperation: `Processing ${uploadedFiles.length} file(s)...`,
      progress: 0
    });

    try {
      // Simulate processing progress
      for (let i = 0; i <= 100; i += 10) {
        setProcessingStatus(prev => ({
          ...prev,
          progress: i,
          currentOperation: i < 100 ? `Processing... ${i}%` : "Finalizing..."
        }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (onProcessFiles) {
        await onProcessFiles(uploadedFiles);
      }

      setProcessingStatus({
        isProcessing: false,
        currentOperation: "Complete",
        progress: 100
      });
    } catch (error) {
      console.error('Processing error:', error);
      setProcessingStatus({
        isProcessing: false,
        currentOperation: "Error",
        progress: 0
      });
    }
  }, [uploadedFiles, onProcessFiles]);

  const canProcess = uploadedFiles.length > 0 && !processingStatus.isProcessing;
  const hasFiles = uploadedFiles.length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* File Upload Zone */}
      <DragDropZone
        onFilesSelected={handleFilesSelected}
        acceptedTypes={tool.acceptedTypes}
        maxFileSize={tool.maxFileSize || 100 * 1024 * 1024}
        maxFiles={tool.maxFiles}
        disabled={processingStatus.isProcessing}
      />

      {/* File List */}
      {hasFiles && (
        <FileList
          files={uploadedFiles}
          onRemoveFile={handleRemoveFile}
          showProgress={processingStatus.isProcessing}
        />
      )}

      {/* Processing Progress */}
      <UploadProgress status={processingStatus} />

      {/* Action Buttons */}
      {hasFiles && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted">
            {uploadedFiles.length} file(s) ready for processing
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setUploadedFiles([])}
              disabled={processingStatus.isProcessing}
            >
              Clear All
            </Button>
            
            <Button
              onClick={handleProcessFiles}
              disabled={!canProcess}
              loading={processingStatus.isProcessing}
            >
              {processingStatus.isProcessing 
                ? "Processing..." 
                : `Process with ${tool.title}`
              }
            </Button>
          </div>
        </div>
      )}

      {/* Tool Information */}
      <div className="text-xs text-muted bg-surface p-3 rounded-lg">
        <strong>{tool.title}:</strong> {tool.description}
        <br />
        <strong>Features:</strong> {tool.features.join(", ")}
      </div>
    </div>
  );
}