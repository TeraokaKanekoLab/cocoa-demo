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
    const rankingText = rankings.map(r => `${r.name}: ${r.score}`).join('\n');
    const favoriteList = favoriteMovies.length > 0 ? favoriteMovies.join(', ') : '（指定なし）';
    const prompt = `Act as a Movie Analyst.
Your goal is to recommend movies based on user favorites, displayed in a constrained text box (vertical flow).
You must explain the recommendation logically using the provided "Score".

# Inputs
1. **User Favorites**: A list of movies the user loves.
2. **Recommendation List**: A ranked list of movies to recommend (Score, Title).

# Output Format
- Output **ONLY** a raw HTML snippet wrapped in a single \`<div>\`.
- Do NOT use markdown code blocks.
- **Language**: English (Must be written in natural, professional English).
- **Layout**: Simple, vertical flow. No grids, no columns.
- **CSS**: Tailwind CSS.
- **Max Font Size**: Use classes equivalent to h3 or h4 (e.g., \`text-base\`, \`text-lg\`).

# Content Guidelines (Crucial)
1. **Strict Reference Rule**: When explaining the connection, **ONLY refer to movies explicitly listed in the "User Favorites" input**. Do NOT hallucinate or mention movies that are not in the input list.
2. **Title References**: Use the official English titles for all movies.
3. **General Inference**: It is okay to infer general tastes (e.g., "You like suspense") based on the input, but do not name-drop unlisted films.

# Content Structure
1. **Thematic Recommendations**: Group recommendations into 2-3 themes.
   - **Theme Header**: Simple styling.
   - **Movie Items**:
     - **Title**: Movie title (\`font-bold\`).
     - **Badge**: Display the Score clearly (\`font-mono\`).
     - **Description**: A single paragraph combining:
       1. **Overview**: Briefly explain what kind of movie it is.
       2. **Score**: Mention the specific score value.
       3. **Connection**: Explain *why* it fits by referencing **ONLY** the provided User Favorites.
2. **Summary Section**: A final section titled "Summary".
   - **Format**: A single paragraph.
   - **Content**: Summarize the user's detected preference and the recommendation strategy in 2-3 sentences.

# One-Shot Example

**Input (User Favorites):**
"Usual Suspects, The (1995)"
Schindler's List (1993)

**Input (Recommendation List):**
1 "Shawshank Redemption, The (1994)": 0.0385
2 "Inception (2010)": 0.0214

**Output:**
<div class="font-sans text-gray-800 leading-relaxed p-2">
  <h3 class="text-base font-bold text-gray-800 mb-3 flex items-center border-l-4 border-indigo-500 pl-2">
    Drama of Hope and Rebirth
  </h3>
  <div class="space-y-6 mb-8">
    <div>
      <div class="font-bold text-indigo-700 text-base">The Shawshank Redemption (1994)</div>
      <div class="mt-1 mb-2">
        <span class="bg-indigo-50 text-indigo-800 text-xs px-2 py-1 rounded border border-indigo-100 font-mono">
          Match Score: 0.0385
        </span>
      </div>
      <p class="text-sm text-gray-700">
        This is an enduring human drama depicting a man imprisoned for a crime he didn't commit, who never loses hope despite desperate circumstances. Recording a top score of <strong>0.0385</strong> in this analysis, the data suggests this is a "must-watch" for you. The profound theme of "human dignity in extreme conditions" found in your favorite, <em>Schindler's List</em>, resonates deeply with the story of hope portrayed in this film.
      </p>
    </div>
  </div>

  <h3 class="text-base font-bold text-gray-800 mb-3 flex items-center border-l-4 border-teal-500 pl-2">
    Suspense of Perception and Reality
  </h3>
  <div class="space-y-6 mb-8">
    <div>
      <div class="font-bold text-teal-700 text-base">Inception (2010)</div>
      <div class="mt-1 mb-2">
        <span class="bg-teal-50 text-teal-800 text-xs px-2 py-1 rounded border border-teal-100 font-mono">
          Match Score: 0.0214
        </span>
      </div>
      <p class="text-sm text-gray-700">
        A sci-fi action blockbuster with a novel premise of infiltrating dreams to steal ideas from the subconscious. With a score of <strong>0.0214</strong>, it ranks highly and shows a strong alignment with your taste vector. Specifically, the multi-layered structure of this film perfectly fits the intellectual curiosity you show for "unpredictable plot twists" and "complex screenplays," as seen in <em>The Usual Suspects</em>.
      </p>
    </div>
  </div>
  
  <div class="bg-gray-50 p-4 rounded-lg text-sm border border-gray-200 mt-6">
    <h4 class="font-bold text-gray-700 mb-2">Summary</h4>
    <p class="text-gray-600">
      Your movie list indicates a strong preference for moving dramas that shine humanity in adversity, as well as intricate suspense films with unpredictable developments. In this recommendation list, we have carefully selected high-scoring AI-analyzed works that combine "narrative weight" with "structural ingenuity."
    </p>
  </div>
</div>

# Actual Task

**User Favorites:**
${favoriteMovies}

**Recommendation List:**
${rankingText}

**Generate the Output HTML:**`;

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
