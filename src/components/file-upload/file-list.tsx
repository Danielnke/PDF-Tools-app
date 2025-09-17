"use client";

import React from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFileSize, getFileIcon } from "@/lib/validation/file-validation";
import { UploadedFile } from "@/types/pdf";
import { cn } from "@/lib/utils";

interface FileListProps {
  files: UploadedFile[];
  onRemoveFile: (fileId: string) => void;
  onDownloadFile?: (fileId: string) => void;
  showProgress?: boolean;
  className?: string;
}

interface FileItemProps {
  file: UploadedFile;
  onRemove: () => void;
  onDownload?: () => void;
  showProgress?: boolean;
}

function FileItem({ file, onRemove, onDownload, showProgress }: FileItemProps) {
  const fileIcon = getFileIcon(file.type);
  
  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <span className="text-lg" role="img" aria-label="file">
            {fileIcon}
          </span>
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground truncate">
            {file.name}
          </h4>
          <div className="flex items-center gap-1 ml-2">
            {onDownload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDownload}
                className="h-8 w-8 hover:bg-accent/10"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-8 w-8 hover:bg-error/10 hover:text-error"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted">
            {formatFileSize(file.size)}
          </span>
          <span className="text-xs text-muted">
            {new Date(file.uploadTime).toLocaleTimeString()}
          </span>
        </div>
        
        {showProgress && (
          <div className="mt-2">
            <Progress value={100} className="h-1" />
          </div>
        )}
      </div>
    </div>
  );
}

export function FileList({
  files,
  onRemoveFile,
  onDownloadFile,
  showProgress = false,
  className
}: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Uploaded Files ({files.length})
        </h3>
        {files.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => files.forEach(file => onRemoveFile(file.id))}
            className="text-xs text-muted hover:text-error"
          >
            Clear All
          </Button>
        )}
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            onRemove={() => onRemoveFile(file.id)}
            onDownload={onDownloadFile ? () => onDownloadFile(file.id) : undefined}
            showProgress={showProgress}
          />
        ))}
      </div>
      
      <div className="text-xs text-muted text-center pt-2 border-t border-border">
        Total size: {formatFileSize(files.reduce((sum, file) => sum + file.size, 0))}
      </div>
    </div>
  );
}