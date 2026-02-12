import { NextResponse } from 'next/server';
import { OpenAI } from 'openai'

import { buildMovieAnalysisPrompt } from '@/lib/prompts/movieAnalysis';

type Ranking = { name: string; score: number };

// basic HTML escaper to avoid injecting broken HTML from input names
const escapeHtml = (s: any) => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

type Provider = 'openai' | 'groq';
type ModelChoice =
  | 'gpt-5'
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  | 'openai/gpt-oss-20b'
  | 'openai/gpt-oss-120b';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const favoriteMovies = Array.isArray(body?.favoriteMovies)
      ? (body.favoriteMovies as string[]).map((m) => String(m))
      : [];
    const rankings = Array.isArray(body?.rankings) ? (body.rankings as Ranking[]) : null;
    const locale = typeof body?.locale === 'string' ? body.locale : 'en';
    const provider: Provider = body?.provider === 'groq' ? 'groq' : 'openai';
    const requestedModel: ModelChoice | undefined = body?.model;

    if (!rankings || rankings.length === 0) {
      return NextResponse.json({ error: 'No rankings provided' }, { status: 400 });
    }

    const OPENAI_API_KEY = (globalThis as any)?.process?.env?.OPENAI_API_KEY;
    const GROQ_API_KEY = (globalThis as any)?.process?.env?.GROQ_API_KEY;

    const providerConfig = provider === 'groq'
      ? { apiKey: GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }
      : { apiKey: OPENAI_API_KEY, baseURL: undefined };

    const resolvedModel: ModelChoice = (() => {
      if (provider === 'groq') {
        if (requestedModel === 'openai/gpt-oss-20b' || requestedModel === 'openai/gpt-oss-120b') {
          return requestedModel;
        }
        return 'openai/gpt-oss-20b';
      }
      if (requestedModel === 'gpt-5' || requestedModel === 'gpt-5-mini' || requestedModel === 'gpt-5-nano') {
        return requestedModel;
      }
      return 'gpt-5-mini';
    })();

    // Fallback simulated analysis only for OpenAI path when the key is missing
    if (provider === 'openai' && !OPENAI_API_KEY) {
      const topN = Math.min(5, rankings.length);
      const topItems = rankings.slice(0, topN);
      const topListHtml = topItems.map((r, i) => `<li>${i + 1}. ${escapeHtml(r.name)} (score: ${Number.isFinite(r.score) ? r.score.toFixed(4) : r.score})</li>`).join('');
      const avg = rankings.reduce((s, r) => s + (Number.isFinite(r.score) ? r.score : 0), 0) / rankings.length;
      const highest = rankings[0];
      const analysisHtml = `
<div class="analysis">
  <h4>Summary</h4>
  <p>The ranking highlights the top ${topN} items; the top item is <b>${escapeHtml(highest.name)}</b> with score ${Number.isFinite(highest.score) ? highest.score.toFixed(4) : highest.score}.</p>
  <h4>Top ${topN}</h4>
  <ul>${topListHtml}</ul>
  <h4>Statistics</h4>
  <p>Average score: ${avg.toFixed(4)}</p>
  <h4>Suggestions</h4>
  <ul>
    <li>Inspect metadata or keywords common to the top items.</li>
    <li>Compare top items against the bottom-ranked items to find distinguishing features.</li>
  </ul>
</div>
`;
      return NextResponse.json({ analysis: analysisHtml });
    }

    if (!providerConfig.apiKey) {
      return NextResponse.json({ error: `Missing API key for provider "${provider}"` }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL,
    })

    // Build an improved prompt that asks the model to explain the ranking
    const prompt = buildMovieAnalysisPrompt({
      locale,
      favoriteMovies,
      rankings,
    });

    // Use chat completions for broader compatibility (Groq does not yet support /responses)
    const chatResp = await client.chat.completions.create({
      model: resolvedModel,
      messages: [{ role: 'user', content: prompt }],
    });

    const analysisText = chatResp?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ analysis: analysisText, raw: chatResp });

  } catch (error: any) {
    console.error('API Error:', error?.message || error);
    const status = error?.status ?? 500;
    const message = error?.error?.message || error?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status });
  }
}
