"use client";

import React from "react";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ProcessingStatus } from "@/types/pdf";
import { cn } from "@/lib/utils";

interface UploadProgressProps {
  status: ProcessingStatus;
  className?: string;
}

export function UploadProgress({ status, className }: UploadProgressProps) {
  const { isProcessing, currentOperation, progress, estimatedTime } = status;

  if (!isProcessing && progress === 0) {
    return null;
  }

  const isComplete = progress >= 100;
  const hasError = !isProcessing && progress < 100 && progress > 0;

  return (
    <div className={cn("space-y-3 p-4 bg-surface rounded-lg border border-border", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : hasError ? (
            <XCircle className="h-5 w-5 text-error" />
          ) : isProcessing ? (
            <Loader2 className="h-5 w-5 text-accent animate-spin" />
          ) : (
            <Clock className="h-5 w-5 text-muted" />
          )}
          
          <span className="text-sm font-medium text-foreground">
            {isComplete
              ? "Processing Complete"
              : hasError
              ? "Processing Failed"
              : currentOperation || "Processing..."}
          </span>
        </div>
        
        <span className="text-sm text-muted">
          {progress}%
        </span>
      </div>
      
      <Progress
        value={progress}
        variant={isComplete ? "success" : hasError ? "error" : "default"}
        className="h-2"
      />
      
      {estimatedTime && isProcessing && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Estimated time remaining</span>
          <span>{Math.ceil(estimatedTime / 1000)}s</span>
        </div>
      )}
      
      {isComplete && (
        <div className="text-xs text-success">
          ✓ Files processed successfully. Ready for download.
        </div>
      )}
      
      {hasError && (
        <div className="text-xs text-error">
          ✗ Processing failed. Please try again or contact support.
        </div>
      )}
    </div>
  );
}