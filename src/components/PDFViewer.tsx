import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GlobalWorkerOptions, getDocument, PDFDocumentProxy } from 'pdfjs-dist';
// Use the same legacy worker as pdfExtractor for consistent behavior under Vite
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - worker asset handled by Vite and declared in src/types/pdfjs-worker.d.ts
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFViewerProps {
  fileUrl: string;
  totalPages: number; // initial hint (may be overridden once loaded)
  highlightPage?: number;
  pages?: number[]; // optional subset of pages to render
  onChangePage?: (page: number) => void;
  forceScrollKey?: number;
  className?: string;
}

interface PageRenderState {
  rendering: boolean;
  rendered: boolean;
  error?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  totalPages,
  highlightPage,
  pages,
  onChangePage,
  forceScrollKey,
  className
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pageStates, setPageStates] = useState<Record<number, PageRenderState>>({});
  const [numPages, setNumPages] = useState(totalPages);
  const [scale, setScale] = useState(1.05);
  const [currentPage, setCurrentPage] = useState(highlightPage || (pages && pages[0]) || 1);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoadingDoc(true);
    setDocError(null);
    (async () => {
      try {
        const loadingTask = getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = pdf;
        setNumPages(pdf.numPages);
        // init page states
        setPageStates(() => {
          const ps: Record<number, PageRenderState> = {};
          const targetPages = pages && pages.length ? pages : Array.from({ length: pdf.numPages }, (_, i) => i + 1);
          for (const p of targetPages) if (p >= 1 && p <= pdf.numPages) ps[p] = { rendering: false, rendered: false };
          return ps;
        });
        setLoadingDoc(false);
      } catch (e: any) {
        if (!cancelled) {
          console.error('[PDFViewer] load error', e);
          setDocError(e?.message || 'Failed to load PDF');
          setLoadingDoc(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Adjust on highlight changes
  useEffect(() => {
    if (highlightPage && highlightPage !== currentPage) {
      setCurrentPage(highlightPage);
      scrollToPage(highlightPage);
    }
  }, [highlightPage, currentPage]);

  // Force scroll when parent requests it (even if highlightPage === currentPage)
  useEffect(() => {
    if (!highlightPage) return;
    // Slight delay to ensure page elements exist before scrolling
    const t = setTimeout(() => scrollToPage(highlightPage), 80);
    return () => clearTimeout(t);
  }, [forceScrollKey, highlightPage]);

  // When pages subset changes, reset currentPage if not included
  useEffect(() => {
    if (pages && pages.length) {
      if (!pages.includes(currentPage)) {
        setCurrentPage(pages[0]);
        scrollToPage(pages[0]);
      }
      // ensure pageStates include only required pages
      setPageStates(ps => {
        const next: Record<number, PageRenderState> = {};
        for (const p of pages) next[p] = ps[p] || { rendering: false, rendered: false };
        return next;
      });
    }
  }, [pages, currentPage]);

  const scrollToPage = (pageNum: number) => {
    const el = containerRef.current?.querySelector(`[data-pdf-page="${pageNum}"]`);
    if (el && containerRef.current) {
      const top = (el as HTMLElement).offsetTop;
      containerRef.current.scrollTo({ top: Math.max(top - 16, 0), behavior: 'smooth' });
    }
  };

  const renderPage = useCallback(async (pageNum: number) => {
    if (!docRef.current) return;
    setPageStates(ps => ({ ...ps, [pageNum]: { ...(ps[pageNum]||{rendered:false,rendering:false}), rendering: true } }));
    try {
      const page = await docRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      let canvas = pageCanvasRefs.current.get(pageNum);
      if (!canvas) return; // component unmounted or ref missing
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      await page.render({ canvasContext: ctx, viewport }).promise;
      setPageStates(ps => ({ ...ps, [pageNum]: { rendering: false, rendered: true } }));
    } catch (e: any) {
      console.error('Page render error', e);
      setPageStates(ps => ({ ...ps, [pageNum]: { rendering: false, rendered: false, error: e?.message || 'Render failed' } }));
    }
  }, [scale]);

  // IntersectionObserver for lazy rendering
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageStr = entry.target.getAttribute('data-pdf-page');
          if (pageStr) {
            const p = parseInt(pageStr, 10);
            const st = pageStates[p];
            if (st && !st.rendered && !st.rendering) renderPage(p);
          }
        }
      });
    }, { root: containerRef.current, rootMargin: '150px 0px', threshold: 0.01 });

    const pageNodes = containerRef.current.querySelectorAll('[data-pdf-page]');
    pageNodes.forEach(n => observer.observe(n));
    return () => observer.disconnect();
  }, [pageStates, renderPage]);

  // Re-render visible pages on scale change
  useEffect(() => {
    const timer = setTimeout(() => {
      const root = containerRef.current;
      if (!root) return;
      const rectRoot = root.getBoundingClientRect();
      for (let [pageNum, canvas] of pageCanvasRefs.current.entries()) {
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect) continue;
        if (rect.bottom >= rectRoot.top - 100 && rect.top <= rectRoot.bottom + 100) {
          renderPage(pageNum);
        }
      }
    }, 120); // debounce scale
    return () => clearTimeout(timer);
  }, [scale, renderPage]);

  const getOrderedPages = () => (pages && pages.length ? [...pages].sort((a,b)=>a-b) : Array.from({ length: numPages }, (_, i) => i + 1));

  const changePage = (pageNum: number) => {
    const ordered = getOrderedPages();
    const allowed = ordered.includes(pageNum) ? pageNum : ordered[0];
    setCurrentPage(allowed);
    onChangePage?.(allowed);
    scrollToPage(allowed);
  };

  const goPrev = () => {
    const ordered = getOrderedPages();
    const idx = ordered.indexOf(currentPage);
    if (idx > 0) changePage(ordered[idx - 1]);
  };
  const goNext = () => {
    const ordered = getOrderedPages();
    const idx = ordered.indexOf(currentPage);
    if (idx >= 0 && idx < ordered.length - 1) changePage(ordered[idx + 1]);
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.15, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.15, 0.5));

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden', className)}>
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/40">
  <Button variant="ghost" size="icon" onClick={goPrev} disabled={getOrderedPages().indexOf(currentPage) <= 0}><ChevronLeft className="w-4 h-4"/></Button>
  <div className="text-xs font-medium w-32 text-center">Page {currentPage} / {getOrderedPages().length}</div>
  <Button variant="ghost" size="icon" onClick={goNext} disabled={getOrderedPages().indexOf(currentPage) === getOrderedPages().length - 1}><ChevronRight className="w-4 h-4"/></Button>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={zoomOut}><ZoomOut className="w-4 h-4"/></Button>
        <div className="w-32 px-2"><Slider value={[scale]} min={0.5} max={3} step={0.05} onValueChange={v => setScale(v[0])} /></div>
        <Button variant="ghost" size="icon" onClick={zoomIn}><ZoomIn className="w-4 h-4"/></Button>
        <div className="text-xs w-14 text-right pr-1 tabular-nums">{Math.round(scale*100)}%</div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6 bg-background/40">
        {loadingDoc && (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Loading PDF...</div>
        )}
        {docError && !loadingDoc && (
          <div className="text-center text-sm text-destructive py-8 border border-destructive/30 rounded-md bg-destructive/5">Failed to load PDF: {docError}</div>
        )}
  {!loadingDoc && !docError && getOrderedPages().map(p => {
          const st = pageStates[p];
          return (
            <div
              key={p}
              data-pdf-page={p}
              className={cn('relative mx-auto rounded-md overflow-hidden border bg-white shadow-sm transition-shadow', highlightPage === p && 'ring-2 ring-primary shadow-primary/30')}
              onClick={() => changePage(p)}
            >
              <canvas ref={el => { if (el) pageCanvasRefs.current.set(p, el); }} className="block" />
              {st && st.rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin"/>Rendering page {p}...
                </div>
              )}
              {st && st.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-destructive text-xs p-2">{st.error}</div>
              )}
              {highlightPage === p && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full shadow">Selected</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default PDFViewer;