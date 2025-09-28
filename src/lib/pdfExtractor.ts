// Utility for extracting text from a PDF File using pdfjs-dist
// We keep this logic isolated so it can be swapped out later (e.g. server OCR)

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
// Use legacy worker JS for broad compatibility under Vite dev server
// @ts-ignore - Vite ?url import for worker (declared in types)
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PDFExtractionResult {
  text: string;          // Full concatenated text (with page separators)
  pages: string[];       // Page text joined by newlines per reconstructed line
  pageLines: string[][]; // Raw reconstructed lines per page (order preserved)
  totalPages: number;
}

interface TextItemWithPos {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  const pageLines: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Collect positioned text items
    const items: TextItemWithPos[] = (content.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.trim().length > 0)
      .map((it: any) => {
        const [a, b, c, d, e, f] = it.transform; // transform matrix; e = x, f = y (bottom-left origin)
        return {
          str: it.str,
          x: e,
          y: f,
          width: it.width || Math.abs(a),
          height: Math.abs(d)
        } as TextItemWithPos;
      });

    // Sort by y (descending top to bottom) then x (ascending)
    items.sort((i1, i2) => {
      const dy = i2.y - i1.y;
      if (Math.abs(dy) > 4) return dy; // different lines if > tolerance
      return i1.x - i2.x;
    });

    // Group into lines
    const lineGroups: TextItemWithPos[][] = [];
    let currentLine: TextItemWithPos[] = [];
    let lastY: number | null = null;
    for (const it of items) {
      if (lastY === null || Math.abs(lastY - it.y) <= 4) {
        currentLine.push(it);
        lastY = lastY === null ? it.y : (lastY + it.y) / 2; // stabilize
      } else {
        if (currentLine.length) lineGroups.push(currentLine);
        currentLine = [it];
        lastY = it.y;
      }
    }
    if (currentLine.length) lineGroups.push(currentLine);

    // Within a line, ensure left-to-right order
    for (const line of lineGroups) line.sort((a, b) => a.x - b.x);

    // Join items within a line with a space if gap is significant
    const lines = lineGroups.map(group => {
      let lineStr = '';
      let prev: TextItemWithPos | null = null;
      for (const seg of group) {
        if (!prev) {
          lineStr += seg.str;
        } else {
          const gap = seg.x - (prev.x + prev.width);
          lineStr += gap > 2 ? ' ' + seg.str : seg.str; // insert space for noticeable gap
        }
        prev = seg;
      }
      return lineStr.replace(/\s+/g, ' ').trim();
    }).filter(l => l.length > 0);

    pageLines.push(lines);
    pages.push(lines.join('\n'));
  }

  const fullText = pages
    .map((p, i) => `===== Page ${i + 1} =====\n${p}`)
    .join('\n\n');

  if (import.meta.env.DEV) {
    // Light debug sample
    // eslint-disable-next-line no-console
    console.debug('[pdfExtractor] Extracted pages:', { totalPages: pdf.numPages, sample: pageLines[0]?.slice(0, 5) });
  }

  return { text: fullText, pages, pageLines, totalPages: pdf.numPages };
}

