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
    const favoriteMovies = Array.isArray(body?.favoriteMovies)
      ? (body.favoriteMovies as string[]).map((m) => String(m))
      : [];
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
    const favoriteList = favoriteMovies.length > 0 ? favoriteMovies.join(', ') : '（指定なし）';
    const prompt = `Act as a Movie Preference Analyst.
Analyze the user's favorite movies and the provided recommendation list to determine the user's specific tastes.
You will receive two inputs:
1. A list of the user's favorite movies.
2. A ranking-based recommendation list (Rank, Title, Score).

Using both inputs, write an analysis and recommendation message in Japanese, warmly tailored to the user as if you are personally recommending films.
All movie titles must be converted to their official Japanese release titles (邦題), not literal translations.
Output the result as a raw HTML snippet wrapped in a <div> tag.

## Constraints
- Style: Objective, logical, and concise, while maintaining the warm and thoughtful tone of a person recommending films personally to the user.
- Grouping: Organize recommended movies into 2–3 meaningful thematic clusters.
- Evidence: Incorporate specific scores (e.g., 0.038574) to support your analysis.
- Input Awareness: Always use the user's favorite movies as the foundation of the reasoning and explain how the recommendations relate to the user's taste.
- Format: Use <div class="analysis">, <h3>, <h4>, <ul>, <li>, and <p>. Do not include <html> or <body> tags.

## Additional Instruction (Important)
- Convert all English titles into their official Japanese release titles (邦題).
- If multiple Japanese titles exist, use the most widely recognized one.
- The tone should feel like a knowledgeable film enthusiast who sincerely wants to guide the user toward meaningful cinematic experiences.

## Example

**Input（ユーザの好きな映画の例）:**  
"Usual Suspects, The (1995)"  
Schindler's List (1993)  
Cinema Paradiso (Nuovo cinema Paradiso) (1989)  
Saving Private Ryan (1998)  
Crash (2004)  
Slumdog Millionaire (2008)  
12 Years a Slave (2013)  
Coda (2020)  
The Father (2020)

**Input（推薦リストの例）:**  
1 "Shawshank Redemption, The (1994)": 0.038574  
2 Inception (2010): 0.021474  
3 Fight Club (1999): 0.020944  
4 "Godfather, The (1972)": 0.020092  
5 "Matrix, The (1999)": 0.019618  
6 Forrest Gump (1994): 0.017204  
7 "Silence of the Lambs, The (1991)": 0.015544  
8 "Dark Knight, The (2008)": 0.014132  
9 "Lord of the Rings: The Fellowship of the Ring, The (2001)": 0.013056  
10 "Godfather: Part II, The (1974)": 0.012251  

**Output（出力例・寄り添い型 / 推薦者になりきり）:**  
<div class="analysis">
  <h3>あなたの好きな映画に基づく推薦コメント</h3>
  <p>以下は、あなたが好きな映画（『ユージュアル・サスペクツ』『シンドラーのリスト』『ニュー・シネマ・パラダイス』『プライベート・ライアン』『クラッシュ』『スラムドッグ＄ミリオネア』『それでも夜は明ける』『コーダ あいのうた』『ファーザー』）をもとにした推薦映画へのコメントです。深い人間ドラマと道徳的ジレンマ、そして魂を揺さぶる物語を愛するあなたにぴったりのラインナップです。</p>

  <h4>総評</h4>
  <p>あなたの映画の好みから見えてくるのは、「人間の内面に光を当てるドラマ」と「運命の残酷さや希望を描く物語」への深い共感です。社会的テーマと個人の感情が交差する作品を愛するあなたには、今回の推薦リストがまさに心を揺さぶる体験となるでしょう。</p>

  <h4>希望と再生のドラマ</h4>
  <ul>
    <li>
      <strong>ショーシャンクの空に（1994）</strong>（スコア: 0.038574）<br>
      圧倒的な不正と絶望の中で希望を失わない人間の強さを描いた名作。『シンドラーのリスト』や『コーダ あいのうた』と同じく、“人間の尊厳を信じる物語”としてあなたの心に深く届く作品です。
    </li>
    <li>
      <strong>フォレスト・ガンプ／一期一会（1994）</strong>（スコア: 0.017204）<br>
      人生の痛みも喜びも包み込むあたたかな物語。『スラムドッグ＄ミリオネア』や『ニュー・シネマ・パラダイス』が好きなあなたには、その優しさと光が心にしみるはずです。
    </li>
  </ul>

  <h4>人間心理と社会の闇に迫る</h4>
  <ul>
    <li>
      <strong>ファイト・クラブ（1999）</strong>（スコア: 0.020944）<br>
      『クラッシュ』のように社会のひずみと人間の本能を鋭く描く問題作。自己の崩壊と再構築を通して、生きる意味を問いかけます。
    </li>
    <li>
      <strong>羊たちの沈黙（1991）</strong>（スコア: 0.015544）<br>
      『ユージュアル・サスペクツ』が好きなあなたにぴったりの知的サスペンス。心理戦の駆け引きが緊張感を生み出し、静かに心をつかみます。
    </li>
  </ul>

  <h4>人間存在の深みと道徳的葛藤</h4>
  <ul>
    <li>
      <strong>ゴッドファーザー（1972）</strong>（スコア: 0.020092） / 
      <strong>ゴッドファーザー PART II（1974）</strong>（スコア: 0.012251）<br>
      善悪の境界がゆらぐ濃密な人間ドラマ。『シンドラーのリスト』や『それでも夜は明ける』のように、人間性と倫理の奥深さに迫る作品です。
    </li>
  </ul>

  <h4>哲学的な世界観と現実への問い</h4>
  <ul>
    <li>
      <strong>インセプション（2010）</strong>（スコア: 0.021474）<br>
      『ファーザー』のように現実と記憶の境界を探る壮大な夢の物語。知的スリルと感情の深みが響き合い、あなたに新しい視点をもたらすはずです。
    </li>
    <li>
      <strong>マトリックス（1999）</strong>（スコア: 0.019618）<br>
      社会や存在の意味を問い直す哲学的SF。『それでも夜は明ける』に通じる“真の自由とは何か”というテーマが胸に刺さります。
    </li>
  </ul>

  <h4>勇気と犠牲の叙事詩</h4>
  <ul>
    <li>
      <strong>ダークナイト（2008）</strong>（スコア: 0.014132）<br>
      正義と自己犠牲を描く重厚な物語。『プライベート・ライアン』のように、英雄の影にある葛藤と覚悟が胸を打ちます。
    </li>
    <li>
      <strong>ロード・オブ・ザ・リング／旅の仲間（2001）</strong>（スコア: 0.013056）<br>
      映画的な美しさと人間愛が融合した壮大な叙事詩。『ニュー・シネマ・パラダイス』の情緒や、『シンドラーのリスト』の人間性と響き合う一本です。
    </li>
  </ul>

  <h4>まとめ</h4>
  <p>あなたは“人間の尊厳と希望”を信じる物語に惹かれる映画ファンです。今回の推薦作品は、人生の痛みを見つめながらも光を求める、そんなあなたの心に寄り添う名作ぞろいです。きっと見終わったあとに、静かな余韻と希望が残ることでしょう。</p>
</div>

## User Favorite Movies
${favoriteList}

## Recommendation Ranking List
${rankingText}
`;

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
