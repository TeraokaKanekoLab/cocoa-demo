import { NextResponse } from 'next/server';
import { OpenAI } from 'openai'

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rankings = Array.isArray(body?.rankings) ? (body.rankings as Ranking[]) : null;
    if (!rankings || rankings.length === 0) {
      return NextResponse.json({ error: 'No rankings provided' }, { status: 400 });
    }

    const OPENAI_API_KEY = (globalThis as any)?.process?.env?.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      // Fallback simulated analysis when no API key is configured (return HTML)
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

    const client = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })

    // Build an improved prompt that asks the model to explain the ranking
    const rankingText = rankings.map(r => `${r.name}: ${r.score}`).join('\n');
    const prompt = `Act as a Movie Preference Analyst.
Analyze the provided list of movies (Rank, Title, Score) to determine the user's specific tastes.
Output the result as a raw HTML snippet wrapped in a \`div\` tag.

## Constraints
- **Style:** Be objective, logical, and concise. Avoid flowery language.
- **Grouping:** Cluster movies by genre, theme, or director into 2-3 distinct categories.
- **Evidence:** Cite specific scores (e.g., 0.0835) to support your analysis.
- **Independence:** Treat this list as a unique user profile.
- **Format:** Use \`<div class="analysis">\`, \`<h3>\`, \`<h4>\`, \`<ul>\`, \`<li>\`, and \`<p>\`. Do not include \`<html>\` or \`<body>\` tags.

## Example

**Input:**
RankNode IDScore
1 Shawshank Redemption, The (1994): 0.0835
2 Lord of the Rings: The Return of the King, The (2003): 0.0594
3 Inception (2010): 0.0589

**Output:**
<div class="analysis">
  <h3>Preference Analysis</h3>
  <p>The list indicates a strong preference for structurally perfect dramas and immersive, large-scale narratives.</p>

  <h4>1. Universal Human Drama</h4>
  <ul>
    <li>
      <strong>#1 The Shawshank Redemption (1994)</strong> (Score: 0.0835)<br>
      The highest score (0.0835) suggests a primary focus on well-crafted scripts dealing with resilience and hope, prioritizing narrative depth over visual spectacle.
    </li>
  </ul>

  <h4>2. Epic Worlds & Cerebral Thrillers</h4>
  <ul>
    <li>
      <strong>#2 The Lord of the Rings: The Return of the King</strong> (Score: 0.0594)<br>
      <strong>#3 Inception</strong> (Score: 0.0589)<br>
      These selections show a high affinity for "World-Building" and complex narrative structures. The user values intellectual engagement and grand scales in fantasy and sci-fi genres.
    </li>
  </ul>

  <h4>Summary</h4>
  <p>Overall, the user favors "Top-tier" cinema that balances emotional weight with high-concept storytelling.</p>
</div>

## User Input
${rankingText}`;

    const response = await client.responses.create({
        model: 'openai/gpt-oss-20b',
        input: prompt,
    });

    // Extract a readable text output from the SDK response. We will ensure
    // the returned `analysis` field is always a string (JSON string or plain text).
    const extractText = (resp: any): string => {
      if (!resp) return '';
      if (typeof resp === 'string') return resp;
      if (typeof resp.output_text === 'string' && resp.output_text.length > 0) return resp.output_text;
      // SDK may place text fragments under resp.output[]
      if (Array.isArray(resp.output)) {
        return resp.output.map((o: any) => {
          if (typeof o === 'string') return o;
          if (typeof o?.content === 'string') return o.content;
          if (Array.isArray(o?.content)) {
            return o.content.map((c: any) => (typeof c === 'string' ? c : (typeof c?.text === 'string' ? c.text : ''))).join('');
          }
          return '';
        }).join('\n');
      }
      // Fallback: try to stringify a subset of response
      try {
        return JSON.stringify(resp);
      } catch (e) {
        return String(resp);
      }
    };

    const analysisText = extractText(response);
    // Ensure we return a string in `analysis` so frontend can display directly.
    return NextResponse.json({ analysis: analysisText, raw: response });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
