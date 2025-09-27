// Heuristic PDF problem parser.
// Splits the PDF pages into distinct problems using common patterns such as:
//  - Problem 1, Problem 2, ...
//  - Question 1, Q1
//  - 1. 2. 3.   (at line starts)
//  - 1) 2)      (at line starts)
// If no headings are detected, returns one problem containing the whole document.

import { Problem } from './store';

interface ParseOptions {
  pages?: string[];        // legacy support (will be merged into single lines array)
  pageLines?: string[][];  // preferred: array of per-page lines
  maxProblems?: number;    // safety cap
}

const headingRegex = /^(?:\s*)(?:problem\s*(\d+)|question\s*(\d+)|q\s*(\d+)|(\d+)[.)])(\b|\s|:)/i;

interface PendingProblemMeta {
  id: string;
  startPage: number; // 1-based
  headingLine: string;
  lines: string[];   // accumulated lines (excluding future problems)
  number?: string;   // captured numeric label
}

export function parseProblems({ pages = [], pageLines, maxProblems = 200 }: ParseOptions): Problem[] {
  // Normalize to lines per page
  const effectivePageLines: string[][] = pageLines ?? pages.map(p => p.split(/\n+/).map(l => l.trim()).filter(Boolean));
  const problems: Problem[] = [];
  let current: PendingProblemMeta | null = null;
  let problemCounter = 0;

  function pushCurrent() {
    if (!current) return;
    const rawText = current.lines.join('\n').trim();
    if (!rawText) return; // skip empty
    const title = deriveTitle(current.headingLine, rawText, ++problemCounter);
    problems.push({
      id: current.id,
      title,
      text: rawText, // full text, no truncation
      pageNumber: current.startPage,
      status: 'not-started',
      hintsUsed: 0,
      attempts: [],
      timeSpent: 0,
      tags: inferTags(rawText, title)
    });
  }

  for (let pIndex = 0; pIndex < effectivePageLines.length; pIndex++) {
    const pageNumber = pIndex + 1;
    const lines = effectivePageLines[pIndex];

    for (const line of lines) {
      const match = line.match(headingRegex);
      if (match) {
        // If starting new heading and we already have one, push previous.
        if (current) pushCurrent();
        if (problems.length >= maxProblems) {
          // stop parsing further problems, append rest to last
          if (!current) current = {
            id: `problem-${Date.now()}-${problems.length + 1}`,
            startPage: pageNumber,
            headingLine: 'Remaining Content',
            lines: [],
          };
        } else {
          current = {
            id: `problem-${Date.now()}-${problems.length + 1}`,
            startPage: pageNumber,
            headingLine: line,
            number: match.slice(1).find(g => !!g),
            lines: [line]
          };
        }
      } else {
        if (!current) {
          // No heading encountered yet; start an implicit first problem
            current = {
            id: `problem-${Date.now()}-1`,
            startPage: pageNumber,
            headingLine: 'Problem 1',
            lines: []
          };
        }
        current.lines.push(line);
      }
    }
  }

  // push final
  if (current) pushCurrent();

  if (problems.length === 0) {
    // Fallback: single problem with entire document
    const allText = effectivePageLines.map(ls => ls.join('\n')).join('\n\n').trim();
    problems.push({
      id: 'problem-1',
      title: 'Full Document',
      text: allText,
      pageNumber: 1,
      status: 'not-started',
      hintsUsed: 0,
      attempts: [],
      timeSpent: 0,
      tags: inferTags(allText, 'Full Document')
    });
  }

  return problems;
}

function deriveTitle(headingLine: string, rawText: string, seq: number): string {
  // Prefer the heading line without excessive numbering.
  const cleaned = headingLine
    .replace(/^(problem|question|q)\s*\d+[:.)-]?\s*/i, '')
    .replace(/^(\d+)[.)-]\s*/, '')
    .trim();
  if (cleaned.length > 3 && cleaned.length < 140) return cleaned;
  // fallback: first sentence of text
  const firstSentence = rawText.split(/(?<=[.!?])\s+/)[0];
  if (firstSentence && firstSentence.length < 140) return firstSentence.trim();
  return `Problem ${seq}`;
}

function inferTags(text: string, title: string): string[] {
  const tags: Set<string> = new Set();
  const lower = (title + ' ' + text.slice(0, 1000)).toLowerCase();
  const mapping: Record<string, string[]> = {
    calculus: ['integral', 'derivative', 'limit', 'series'],
    algebra: ['matrix', 'determinant', 'vector', 'eigen', 'polynomial'],
    physics: ['velocity', 'acceleration', 'force', 'motion', 'energy'],
    geometry: ['triangle', 'angle', 'circle', 'area', 'perimeter'],
    probability: ['probability', 'random', 'distribution', 'variance', 'mean'],
  };
  for (const [tag, keywords] of Object.entries(mapping)) {
    if (keywords.some(k => lower.includes(k))) tags.add(tag);
  }
  return Array.from(tags).slice(0, 5);
}
