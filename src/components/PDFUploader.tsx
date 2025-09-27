import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface PDFUploaderProps {
  onFileUpload: (file: File) => void;
  isUploading?: boolean;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({ 
  onFileUpload, 
  isUploading = false 
}) => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only.",
        variant: "destructive",
      });
      return;
    }

    const file = acceptedFiles[0];
    if (file && file.size > 20 * 1024 * 1024) { // 20MB limit
      toast({
        title: "File too large",
        description: "Please upload a PDF smaller than 20MB.",
        variant: "destructive",
      });
      return;
    }

    if (file) {
      onFileUpload(file);
    }
  }, [onFileUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isUploading
  });

  // Helper to fetch a file URL and convert it to a File object.
  // This attempts a direct fetch first and then falls back to a small chain
  // of public CORS proxies if the direct fetch fails (common for third-party hosts).
  // Note: public proxies are best-effort and may be rate-limited or unreliable.
  async function fetchUrlAsFile(url: string, suggestedName?: string, tryOnlyProxies = false) {
    const proxies = [
      // corsproxy.io preserves binary responses reliably for many files
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      // allorigins raw endpoint as another fallback
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      // thingproxy has worked historically for some uses
      (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
    ];

    async function tryFetch(u: string) {
      const res = await fetch(u, { redirect: 'follow' });
      if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
      return res;
    }

    let lastErr: any = null;

    // First, try the direct URL unless caller asked to skip direct fetch
    if (!tryOnlyProxies) {
      try {
        const direct = await tryFetch(url);
        const blob = await direct.blob();
        const contentType = blob.type || 'application/pdf';
        const name = suggestedName || getFileNameFromUrl(url) || 'imported.pdf';
        return new File([blob], name, { type: contentType });
      } catch (err) {
        lastErr = err;
        console.warn('Direct fetch failed, will try proxies:', err);
      }
    }

    // Try proxies in order
    for (const makeProxyUrl of proxies) {
      const proxyUrl = makeProxyUrl(url);
      try {
        console.info('Trying proxy fetch:', proxyUrl);
        const proxied = await tryFetch(proxyUrl);
        const blob = await proxied.blob();
        const contentType = blob.type || 'application/pdf';
        const name = suggestedName || getFileNameFromUrl(url) || 'imported.pdf';
        return new File([blob], name, { type: contentType });
      } catch (err) {
        lastErr = err;
        console.warn('Proxy fetch failed for', proxyUrl, err);
        // continue to next proxy
      }
    }

    // If we get here, all attempts failed
    throw new Error(`Failed to fetch file from URL (direct and proxy attempts failed): ${lastErr?.message || lastErr}`);
  }

  function getFileNameFromUrl(url: string) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last.split('?')[0]);
    } catch (e) {
      // ignore
    }
    return undefined;
  }

  async function handleImportFromUrl() {
    // kept for backwards compatibility; prefer using the in-UI dialog
    const url = window.prompt('Paste a direct PDF URL to import:');
    if (!url) return await handleImportFromUrlWithValue(url.trim());
  }

  async function handleImportFromUrlWithValue(url: string) {
    if (!url) return;
    setIsImporting(true);
    try {
      const file = await fetchUrlAsFile(url.trim());
      onFileUpload(file);
      toast({ title: 'Imported', description: `Imported ${file.name}`, variant: 'default' });
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Import failed',
        description: e?.message || 'Failed to import the file. Try downloading the PDF and uploading it manually.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function fetchGoogleDriveFile(id: string) {
    // Try the direct uc?export=download endpoint first.
    const base = `https://drive.google.com/uc?export=download&id=${id}`;

    // Helper to attempt fetch and detect a Drive confirmation page requiring a confirm token
    async function tryFetch(url: string) {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
      const text = await res.clone().text();

      // Google Drive sometimes returns an HTML page with a confirm token when file is large or virus-scanned.
      // Look for the confirm token in the HTML and extract a secondary download link if present.
      const confirmMatch = text.match(/confirm=([0-9A-Za-z_-]+)/);
      if (confirmMatch) {
        const token = confirmMatch[1];
        const confirmed = `${base}&confirm=${token}`;
        const finalRes = await fetch(confirmed);
        if (!finalRes.ok) throw new Error(`Failed to fetch confirmed file: ${finalRes.status} ${finalRes.statusText}`);
        return finalRes;
      }

      // If response looks like HTML but no token, it might be a viewer page. Try constructing an alternate link.
      if (text.includes('<html') && text.includes('drive.google.com')) {
        // try the /uc?export=download&confirm=t&id=... pattern
        const fallback = `${base}&confirm=t`;
        const fallbackRes = await fetch(fallback);
        if (fallbackRes.ok) return fallbackRes;
      }

      return res;
    }

    const res = await tryFetch(base);
    const blob = await res.blob();
    const contentType = blob.type || 'application/pdf';
    return new File([blob], `${id}.pdf`, { type: contentType });
  }

  async function handleImportFromDrive() {
    const driveUrl = window.prompt('Paste a Google Drive share URL (any link):');
    if (!driveUrl) return;

    // try to extract file id from several common Drive URL forms
    const idMatch = driveUrl.match(/(?:\/d\/|id=|file\/d\/|open\?id=)([a-zA-Z0-9_-]{10,})/);
    if (!idMatch) {
      toast({ title: 'Invalid link', description: 'Could not extract file id from the provided link.', variant: 'destructive' });
      return;
    }
    const id = idMatch[1];

    setIsImporting(true);
    try {
      const file = await fetchGoogleDriveFile(id);
      onFileUpload(file);
      toast({ title: 'Imported', description: `Imported ${file.name}`, variant: 'default' });
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Import failed',
        description: 'Could not fetch file from Google Drive. If the file is not public, download it and upload manually.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }

  // Dialog state for URL import
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const confirmUrlImport = async (useProxies = false) => {
    // keep the dialog open on failure so the user can retry or open URL manually
    if (!urlValue) return;
    setUrlError(null);
    setIsImporting(true);
    try {
      const file = await fetchUrlAsFile(urlValue.trim(), undefined, useProxies);
      onFileUpload(file);
      toast({ title: 'Imported', description: `Imported ${file.name}`, variant: 'default' });
      setIsUrlDialogOpen(false);
      setUrlValue('');
    } catch (e: any) {
      console.error(e);
      setUrlError(e?.message || 'Failed to import the file.');
      toast({ title: 'Import failed', description: e?.message || 'Failed to import the file.', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-80 h-80 sm:w-52 sm:h-52">
          <img src="/ui/logo.png" alt="logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold italic text-foreground transform -skew-x-2">
          <span className="bg-gradient-primary bg-clip-text text-transparent">For when you're</span>
          <br />
          <span className="bg-gradient-secondary bg-clip-text text-transparent">in a pickle</span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mt-1">
          Upload homework to reveal hints, get step-by-step solutions, and chat with an AI tutor
        </p>
      </div>

      <Card
        {...getRootProps()}
        className={`
          relative overflow-hidden border-2 border-dashed transition-all duration-300 cursor-pointer
          ${isDragActive 
            ? 'border-primary bg-primary/5 scale-105' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="p-12 text-center space-y-6">
          {isUploading ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Processing your PDF...</h3>
                <p className="text-muted-foreground">This may take a few moments</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                </h3>
                <p className="text-muted-foreground">
                  or click to select a file • Max 20MB
                </p>
              </div>
            </div>
          )}
        </div>

        {isDragActive && (
          <div className="absolute inset-0 bg-primary/5 border-2 border-primary border-dashed rounded-lg" />
        )}
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
        <div className="w-full sm:w-auto sm:order-1 flex justify-center">
          <Button variant="outline" disabled={isUploading || isImporting} onClick={() => setIsUrlDialogOpen(true)} className="uploader-btn">
            <FileText className="w-4 h-4 mr-2" />
            {isImporting ? 'Importing…' : 'Import from URL'}
          </Button>
        </div>
      </div>

      {/* URL import dialog */}
      <Dialog
        open={isUrlDialogOpen}
        onOpenChange={(open) => {
          setIsUrlDialogOpen(open);
          if (!open) {
            setUrlError(null);
            setUrlValue('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import PDF from URL</DialogTitle>
            <DialogDescription>Paste a direct link to a PDF and we'll try to import it.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/file.pdf"
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <DialogFooter className="flex flex-col">
            {urlError && (
              <div className="text-sm text-destructive mb-2">{urlError}</div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsUrlDialogOpen(false);
                  setUrlError(null);
                }}
              >
                Cancel
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (!urlValue) return;
                  window.open(urlValue, '_blank', 'noopener,noreferrer');
                }}
                disabled={!urlValue}
                className="inline-flex items-center px-3 py-2 rounded border text-sm"
              >
                Open URL
              </Button>

              <Button
                onClick={() => confirmUrlImport(false)}
                disabled={isImporting}
                className="bg-primary text-primary-foreground"
              >
                {isImporting ? 'Importing…' : 'Import'}
              </Button>


            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};