'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

interface ProcessingStatusProps {
  isProcessing: boolean;
  processingProgress: number;
  error: string | null;
}

export function ProcessingStatus({ isProcessing, processingProgress, error }: ProcessingStatusProps) {
  if (!isProcessing && !error) return null;

  if (error) {
    return (
      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (isProcessing) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Processing PDF...</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {processingProgress}% complete
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}