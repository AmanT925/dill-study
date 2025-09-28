// Heuristic problem time estimator.
// Provides a realistic minutes estimate for an average prepared student.
// Purely deterministic and lightweight; avoid external model calls.

export function estimateProblemTime(text: string, tags: string[] = []): number {
  const raw = (text || '').toLowerCase();
  const words = raw.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const wc = words.length;

  // Base reading & comprehension rate slower than pure reading.
  let minutes = Math.max(2, Math.round(wc / 35));

  // Subparts (a), (b), (i), (ii) etc.
  const partMatches = raw.match(/\(([a-z]|[ivx]{1,4})\)/g) || [];
  const uniqueParts = new Set(partMatches.map(p => p.toLowerCase()));
  if (uniqueParts.size > 0) minutes += uniqueParts.size * 2;

  // Multi-step language
  if (/step\s+1|first\s+show|hence|therefore/.test(raw)) minutes += 2;

  // Proof heavy
  if (/\bprove\b|show that|justify|demonstrate/.test(raw)) minutes += 8;

  // Calculation heavy indicators
  const calcTokens = [
    /∫|integral/, /derivative|differentiate|d\s*\/\s*dx/, /matrix|determinant|eigen/, /sum_|Σ|sigma/,
    /variance|distribution|probability|random variable/, /limit\s*\(/, /series|converge|diverge/
  ];
  let calcHits = 0;
  for (const r of calcTokens) if (r.test(raw)) calcHits++;
  if (calcHits) minutes += calcHits * 3;

  // Tag influence
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  if (tagSet.has('calculus') || tagSet.has('algebra')) minutes += 3;
  if (tagSet.has('probability')) minutes += 2;
  if (tagSet.has('physics')) minutes += 2;

  // Short but proofy
  if (wc < 40 && /prove|show that/.test(raw)) minutes = Math.max(minutes, 12);

  // Large problems taper
  if (wc > 250) minutes += Math.round((wc - 250) / 80);

  // Clamp
  minutes = Math.min(Math.max(minutes, 2), 90);
  return minutes;
}
