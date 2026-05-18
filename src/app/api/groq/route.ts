import { NextResponse } from 'next/server';
import { OpenAI } from 'openai'

import { buildMovieAnalysisPrompt } from '@/lib/prompts/movieAnalysis';

type Ranking = { name: string; score: number };
const sanitizeForMarkdown = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/([`*_{}\[\]()#+\-.!|>])/g, '\\$1');

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
      const avg = rankings.reduce((s, r) => s + (Number.isFinite(r.score) ? r.score : 0), 0) / rankings.length;
      const highest = rankings[0];
      const topListMarkdown = topItems
        .map((r, i) => `${i + 1}. ${sanitizeForMarkdown(String(r.name))} (score: ${Number.isFinite(r.score) ? r.score.toFixed(4) : r.score})`)
        .join('\n');
      const analysisMarkdown = [
        '### Summary',
        `The ranking highlights the top ${topN} items; the top item is **${sanitizeForMarkdown(String(highest.name))}** with score ${Number.isFinite(highest.score) ? highest.score.toFixed(4) : highest.score}.`,
        '',
        `### Top ${topN}`,
        topListMarkdown,
        '',
        '### Statistics',
        `Average score: ${avg.toFixed(4)}`,
        '',
        '### Suggestions',
        '- Inspect metadata or keywords common to the top items.',
        '- Compare top items against the bottom-ranked items to find distinguishing features.',
      ].join('\n');

      return new NextResponse(
        `data: ${JSON.stringify({ delta: analysisMarkdown })}\n\n` +
        `data: ${JSON.stringify({ done: true })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        }
      );
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          // Use chat completions for broader compatibility (Groq does not yet support /responses)
          const chatResp = await client.chat.completions.create({
            model: resolvedModel,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          });

          for await (const chunk of chatResp) {
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              sendEvent({ delta });
            }
          }
          sendEvent({ done: true });
        } catch (error: any) {
          const message = error?.error?.message || error?.message || `Streaming failed during ${provider}:${resolvedModel}`;
          sendEvent({ error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    console.error('API Error:', error?.message || error);
    const status = error?.status ?? 500;
    const message = error?.error?.message || error?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status });
  }
}
