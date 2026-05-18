import { NextResponse } from 'next/server';
import { OpenAI } from 'openai'

import { buildMovieAnalysisPrompt } from '@/lib/prompts/movieAnalysis';

type Ranking = { name: string; score: number };
const MOCK_STREAM_CHUNK_SIZE = 48;
const MOCK_STREAM_CHUNK_DELAY_MS = 20;
type StreamDeltaEvent = { type: 'delta'; delta: string; chunkCount: number; totalDeltaChars: number };
type StreamDoneEvent = { type: 'done'; chunkCount: number; totalDeltaChars: number; elapsedMs?: number };
type StreamErrorEvent = { type: 'error'; message: string };

const toDeltaEvent = (delta: string, chunkCount: number, totalDeltaChars: number): StreamDeltaEvent => ({
  type: 'delta',
  delta,
  chunkCount,
  totalDeltaChars,
});
const toDoneEvent = (chunkCount: number, totalDeltaChars: number, elapsedMs?: number): StreamDoneEvent => ({
  type: 'done',
  chunkCount,
  totalDeltaChars,
  elapsedMs,
});
const toErrorEvent = (message: string): StreamErrorEvent => ({ type: 'error', message });

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
    const useStreaming = body?.stream !== false;
    const debugStream = body?.debugStream === true;

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
      if (useStreaming) {
        const encoder = new TextEncoder();
        const mockChunkPattern = new RegExp(`.{1,${MOCK_STREAM_CHUNK_SIZE}}`, 'g');
        const mockChunks = analysisHtml.match(mockChunkPattern) ?? [];
        const stream = new ReadableStream({
          async start(controller) {
            let totalDeltaChars = 0;
            for (let i = 0; i < mockChunks.length; i += 1) {
              const delta = mockChunks[i] ?? '';
              if (!delta) continue;
              totalDeltaChars += delta.length;
              if (debugStream) {
                console.debug('[groq-stream] mock delta', { chunkCount: i + 1, deltaChars: delta.length });
              }
              controller.enqueue(
                encoder.encode(JSON.stringify(toDeltaEvent(delta, i + 1, totalDeltaChars)) + '\n'),
              );
              await new Promise((resolve) => setTimeout(resolve, MOCK_STREAM_CHUNK_DELAY_MS));
            }
            controller.enqueue(
              encoder.encode(JSON.stringify(toDoneEvent(mockChunks.length, totalDeltaChars)) + '\n'),
            );
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      }
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
    if (useStreaming) {
      const streamResp = await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      let chunkCount = 0;
      let totalDeltaChars = 0;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResp) {
              const delta = chunk?.choices?.[0]?.delta?.content ?? '';
              if (!delta) continue;
              chunkCount += 1;
              totalDeltaChars += delta.length;
              if (debugStream) {
                console.debug('[groq-stream] delta', {
                  provider,
                  model: resolvedModel,
                  chunkCount,
                  deltaChars: delta.length,
                  totalDeltaChars,
                });
              }
              controller.enqueue(
                encoder.encode(JSON.stringify(toDeltaEvent(delta, chunkCount, totalDeltaChars)) + '\n'),
              );
            }
            const elapsedMs = Date.now() - startedAt;
            if (debugStream) {
              console.debug('[groq-stream] done', {
                provider,
                model: resolvedModel,
                chunkCount,
                totalDeltaChars,
                elapsedMs,
              });
            }
            controller.enqueue(
              encoder.encode(JSON.stringify(toDoneEvent(chunkCount, totalDeltaChars, elapsedMs)) + '\n'),
            );
          } catch (streamError: unknown) {
            const message =
              streamError instanceof Error
                ? streamError.message
                : typeof streamError === 'string'
                  ? streamError
                  : 'Streaming failed';
            console.error('Streaming API Error:', message);
            controller.enqueue(encoder.encode(JSON.stringify(toErrorEvent(message)) + '\n'));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

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
