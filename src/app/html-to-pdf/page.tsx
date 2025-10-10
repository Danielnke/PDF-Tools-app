"use client";

"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, FileCode, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface ConvertResult { fileName: string; downloadUrl: string; }

export default function HtmlToPdfPage() {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [url, setUrlState] = useState('');
  const setUrl = useCallback((next: string | null | undefined) => {
    setUrlState(next ?? '');
  }, []);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);


  const onDrop = (accepted: File[]) => {
    setError(null);
    setResult(null);
    if (accepted.length !== 1) { setError('Please upload exactly one HTML file'); return; }
    const f = accepted[0];
    if (!f.name.toLowerCase().endsWith('.html') && f.type !== 'text/html') {
      setError('Only .html files are supported');
      return;
    }
    setFile(f);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/html': ['.html', '.htm'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const submit = async () => {
    setIsProcessing(true); setProgress(10); setError(null); setResult(null);
    try {
      const form = new FormData();
      if (mode === 'url') {
        if (!/^https?:\/\//i.test(url)) { setError('Please enter a valid http/https URL'); setIsProcessing(false); return; }
        form.append('url', url);
      } else {
        if (!file) { setError('Please select an HTML file'); setIsProcessing(false); return; }
        form.append('file', file);
      }
      type ConvertResponse = { fileName?: string; downloadUrl?: string; error?: string };
      const res = await fetch('/api/convert/html-to-pdf', { method: 'POST', body: form });
      setProgress(80);
      let data: ConvertResponse = {};
      try {
        const raw = await res.clone().text();
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') data = parsed as ConvertResponse;
        }
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error((data && data.error) || `Conversion failed (status ${res.status})`);
      setResult({ fileName: data.fileName!, downloadUrl: data.downloadUrl! });
      setProgress(100);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Conversion failed';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const download = (d: ConvertResult) => {
    const a = document.createElement('a');
    a.href = d.downloadUrl; a.download = d.fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">HTML / Webpage to PDF</h1>
            <p className="text-muted-foreground">Convert a live website or an HTML file into a PDF</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {mode === 'url' ? <Globe className="h-5 w-5" /> : <FileCode className="h-5 w-5" />}
                {mode === 'url' ? 'Website URL' : 'Upload HTML File'}
              </CardTitle>
              <CardDescription>
                {mode === 'url' ? 'Enter a webpage URL (http/https) to render as PDF' : 'Select a .html file to convert to PDF'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button variant={mode === 'url' ? 'default' : 'outline'} onClick={() => setMode('url')} className="flex-1">From URL</Button>
                <Button variant={mode === 'file' ? 'default' : 'outline'} onClick={() => setMode('file')} className="flex-1">From HTML File</Button>
              </div>

              {mode === 'url' ? (
                <div className="space-y-3">
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={url ?? ''}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'}`}>
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">{isDragActive ? 'Drop HTML here' : 'Drag & drop HTML here'}</p>
                  <p className="text-sm text-muted-foreground">or click to select file</p>
                  {file && <p className="text-sm text-muted-foreground mt-2">Selected: {file.name}</p>}
                </div>
              )}

              <div className="mt-4 space-y-3">
                <Button onClick={submit} disabled={isProcessing} className="w-full">{isProcessing ? 'Converting...' : 'Convert to PDF'}</Button>
                {isProcessing && <Progress value={progress} />}
                {error && (
                  <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                )}
                {result && (
                  <div className="space-y-4">
                    <Alert className="bg-green-500/10 border-green-500/20"><CheckCircle className="h-4 w-4" /><AlertDescription>Successfully converted</AlertDescription></Alert>
                    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div><p className="font-medium">{result.fileName}</p></div>
                      <Button size="sm" onClick={() => download(result)}><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
}
