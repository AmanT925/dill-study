import { Problem } from './store';

interface SplitParams {
  fullText: string;
  pageCount: number;
  model?: string;         // preferred starting model (env override: VITE_GEMINI_MODEL)
  maxProblems?: number;
  allowModelFallbacks?: boolean; // try alternative model IDs if the first fails
  listModelsFirst?: boolean;     // attempt to fetch available models (best-effort)
}

interface GeminiProblemRaw {
  id?: string;
  title: string;
  text: string;
  pageNumber?: number;
  tags?: string[];
}

// Dynamic import to avoid bundling if no key provided
async function getClient(apiKey: string) {
  const mod = await import('@google/generative-ai');
  // @ts-ignore types provided by package
  const { GoogleGenerativeAI } = mod;
  return new GoogleGenerativeAI(apiKey);
}

export async function splitProblemsWithGemini({ fullText, pageCount, model, maxProblems = 100, allowModelFallbacks = true, listModelsFirst = false }: SplitParams): Promise<Problem[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');

  const preferredModel = model || (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-1.5-flash-latest';

  // Guard: large docs
  const HARD_LIMIT = 120_000; // chars
  const truncated = fullText.length > HARD_LIMIT;
  const workingText = truncated ? fullText.slice(0, HARD_LIMIT) : fullText;

  const client = await getClient(apiKey);

  let dynamicModels: string[] = [];
  if (listModelsFirst) {
    try {
      // @ts-ignore listModels may exist depending on library version
      const listed = await client.listModels?.();
      if (Array.isArray(listed?.models)) {
        dynamicModels = listed.models
          .map((m: any) => m.name?.split('/').pop())
          .filter((n: any) => typeof n === 'string' && /gemini/i.test(n));
      }
    } catch (e) {
      // non-fatal
      if (import.meta.env.DEV) console.warn('[Gemini] listModels failed (continuing):', e);
    }
  }

  const fallbackList = [
    preferredModel,
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp', // experimental; ignore if 404
  ];
  const candidateModels = Array.from(new Set([...fallbackList, ...dynamicModels])).filter(Boolean);

  const prompt = buildPrompt(workingText, pageCount, maxProblems, truncated);
  let responseText = '';
  let lastErr: any = null;

  for (const m of candidateModels) {
    try {
      // @ts-ignore - library typing variance across versions
      const genModel = client.getGenerativeModel({ model: m });
      // Some versions accept a plain string
      let result: any;
      try {
        // @ts-ignore
        result = await genModel.generateContent(prompt);
      } catch (legacy) {
        // fallback to structured call form
        // @ts-ignore
        result = await genModel.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      }
      // Extract text robustly
      // @ts-ignore
      responseText = (typeof result.response?.text === 'function') ? result.response.text() :
        // @ts-ignore
        result.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n') || '';
      if (!responseText) throw new Error('Empty response from model');
      break; // success
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      const is404 = /not found|404/i.test(msg);
      if (!(allowModelFallbacks && is404)) {
        if (!allowModelFallbacks) throw err;
        if (!is404) throw err; // non-404 fatal
      }
      // continue to next model if 404 and fallback allowed
      if (import.meta.env.DEV) console.warn(`[Gemini] model '${m}' failed (${msg}). Trying next.`);
    }
  }

  if (!responseText) {
    throw lastErr || new Error('Gemini model responses exhausted without success');
  }
  const json = extractJSON(responseText);
  if (!json) throw new Error('Failed to parse Gemini JSON output');
  const arr: GeminiProblemRaw[] = Array.isArray(json) ? json : json.problems;
  if (!Array.isArray(arr)) throw new Error('Gemini output not an array');

  const now = Date.now();
  return arr.slice(0, maxProblems).map((p, i) => ({
    id: p.id || `ai-problem-${now}-${i + 1}`,
    title: sanitize(p.title) || `Problem ${i + 1}`,
    text: p.text?.trim() || '',
    pageNumber: p.pageNumber && p.pageNumber >= 1 ? p.pageNumber : 1,
    status: 'not-started' as const,
    hintsUsed: 0,
    attempts: [],
    timeSpent: 0,
    tags: Array.isArray(p.tags) ? p.tags.slice(0, 8) : []
  })).filter(p => p.text.length > 0);
}

function buildPrompt(text: string, pageCount: number, maxProblems: number, truncated: boolean) {
  return `You are an educational content parser. The following is concatenated PDF text with page separators in the form '===== Page N ====='.
Extract distinct problem statements (math/science homework style) as structured JSON.
Return ONLY JSON (no markdown, no commentary). If no problems, return an empty array [].
Fields: id (optional), title, text (verbatim problem statement without losing equations), pageNumber (best guess), tags (array of short topical words).
Constraints: Do not merge unrelated problems. Do not invent content. Preserve original wording.
Max problems: ${maxProblems}.
Total pages: ${pageCount}. Truncated: ${truncated}.
PDF TEXT START\n${text}\nPDF TEXT END`;
}

function extractJSON(raw: string): any | null {
  // Try direct parse first
  try { return JSON.parse(raw.trim()); } catch {}
  // Extract JSON block
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) {
    const inner = match[1];
    try { return JSON.parse(inner.trim()); } catch {}
  }
  // Fallback: find first [ and last ]
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = raw.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  return null;
}

function sanitize(s: string | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}
