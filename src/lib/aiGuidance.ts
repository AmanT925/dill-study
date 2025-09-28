// Lightweight Gemini guidance helper for conversational tutoring
// Requires env var: VITE_GEMINI_API_KEY
// Optional: VITE_GEMINI_GUIDANCE_MODEL (default gemini-2.5-flash)

export interface GuidanceContext {
  problemText: string;
  attempts: string[];
  assistantMessages: { role: 'user' | 'assistant'; content: string }[];
  hintLevel: number; // how many hints already used
}

export interface GuidanceRequest extends GuidanceContext {
  userInput: string; // the new message / approach description
  model?: string;
}

export interface GuidanceResult {
  answer: string;
  model: string;
  usage?: any;
}

async function getClient(apiKey: string) {
  const mod = await import('@google/generative-ai');
  // @ts-ignore
  const { GoogleGenerativeAI } = mod;
  return new GoogleGenerativeAI(apiKey);
}

// Query API to list available models (so we don’t hardcode outdated names)
async function listAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const client = await getClient(apiKey);
    // @ts-ignore
    const modelsResp = await client.listModels();
    // @ts-ignore
    return modelsResp?.models?.map((m: any) => m.name.replace('models/', '')) || [];
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[Gemini][listModels] failed', e);
    // fallback: return known good defaults
    return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
  }
}

// Try to pick a working model
async function resolveWorkingModel(apiKey: string, preferred: string): Promise<string> {
  const available = await listAvailableModels(apiKey);
  const fallbacks = [
    preferred,
    preferred.replace('-latest', ''),
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite'
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const errors: Record<string,string> = {};
  for (const model of fallbacks) {
    if (!available.includes(model)) {
      errors[model] = 'not in listModels';
      continue;
    }
    try {
      const client = await getClient(apiKey);
      // @ts-ignore
      const testModel = client.getGenerativeModel({ model });
      // @ts-ignore
      await testModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 }
      });
      if (import.meta.env.DEV) console.info('[Gemini] Using model', model);
      return model;
    } catch (e: any) {
      errors[model] = String(e?.message || e);
      continue;
    }
  }
  const summary = Object.entries(errors).map(([m,e]) => `${m}: ${e.slice(0,140)}`).join('; ');
  throw new Error(`No working Gemini model found. Tried: ${fallbacks.join(', ')}. Errors: ${summary}`);
}

export async function getGuidance(req: GuidanceRequest): Promise<GuidanceResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const preferred = req.model || (import.meta.env.VITE_GEMINI_GUIDANCE_MODEL as string | undefined) || 'gemini-2.5-flash';
  const modelId = await resolveWorkingModel(apiKey, preferred);

  const system = `You are a concise, step-focused tutoring assistant.\nGoals:\n1. **Introduce the Overarching Concept:** Before suggesting the first step or evaluating the user's initial attempt, briefly explain the core principle or concept needed to solve the problem.\n2. Encourage reasoning and next-step thinking.\n3. Don't reveal the full solution unless the user explicitly asks multiple times or all hints are used.\n4. Use the user's existing attempts to tailor feedback.\n5. Prefer short bullet points or numbered steps.\n6. **Use LaTeX formatting** for all mathematical equations, variables, and formulas (e.g., wrap in '$' delimiters).\n7. If the user just describes an approach, evaluate its correctness, point out gaps, and offer a gentle next step.\n8. If the user asks a direct question, answer but keep it at the appropriate hint depth (hintLevel = ${req.hintLevel}).\n9. NEVER hallucinate data not derivable from the problem statement.\nReturn plain markdown (no JSON, no code fences unless necessary).`;

  const historyParts = req.assistantMessages.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const contents = [
    ...historyParts,
    { role: 'user', parts: [{ text: `Problem Statement:\n${req.problemText.trim()}\n\nPrior Attempts:\n${req.attempts.map((a,i)=>`${i+1}. ${a}`).join('\n') || 'None'}\n\nNew User Input:\n${req.userInput}` }] }
  ];

  let answer = '';
  let usage: any = undefined;

  const client = await getClient(apiKey);
  // @ts-ignore
  const genModel = client.getGenerativeModel({ model: modelId, systemInstruction: system });
  // @ts-ignore
  const result = await genModel.generateContent({ contents });
  // @ts-ignore
  answer = typeof result.response?.text === 'function'
    ? result.response.text()
    : (result.response?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('\n') || '');
  usage = result.response?.usageMetadata;

  if (!answer) throw new Error('Empty Gemini response');
  return { answer, model: modelId, usage };
}

// Streaming variant. onDelta receives incremental text chunks.
export async function streamGuidance(
  req: GuidanceRequest,
  onDelta: (chunk: string) => void,
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const preferred = req.model || (import.meta.env.VITE_GEMINI_GUIDANCE_MODEL as string | undefined) || 'gemini-2.5-flash';
  const modelId = await resolveWorkingModel(apiKey, preferred);

  const system = `You are a concise, step-focused tutoring assistant. Keep answers incremental when possible.`;

  const historyParts = req.assistantMessages.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const contents = [
    ...historyParts,
    { role: 'user', parts: [{ text: `Problem Statement:\n${req.problemText.trim()}\n\nPrior Attempts:\n${req.attempts.map((a,i)=>`${i+1}. ${a}`).join('\n') || 'None'}\n\nNew User Input:\n${req.userInput}` }] }
  ];

  let accumulated = '';
  try {
    const client = await getClient(apiKey);
    // @ts-ignore
    const genModel = client.getGenerativeModel({ model: modelId, systemInstruction: system });
    // @ts-ignore
    const streamResult = await genModel.generateContentStream({ contents });
    // @ts-ignore
    for await (const item of streamResult.stream) {
      if (opts.signal?.aborted) break;
      // @ts-ignore
      const piece = typeof item.text === 'function' ? item.text() : (item.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('') || '');
      if (piece) {
        accumulated += piece;
        onDelta(piece);
      }
    }
    if (!accumulated) {
      // @ts-ignore
      const final = streamResult.response;
      // @ts-ignore
      accumulated = typeof final.text === 'function' ? final.text() : (final.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('\n') || '');
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[Gemini][stream-fallback]', e);
    const res = await getGuidance(req);
    accumulated = res.answer;
  }

  if (!accumulated) throw new Error('Empty Gemini response');
  return { answer: accumulated, model: modelId };
}