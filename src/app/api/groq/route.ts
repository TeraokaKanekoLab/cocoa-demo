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

Write an analysis and recommendation message in Japanese in the style of a professional film critic.
Your tone should be informed, articulate, and interpretive—presenting thematic depth, cinematic context, and narrative structure with expert precision.
All movie titles must be converted to their official Japanese release titles (邦題), not literal translations.
Output the result as a raw HTML snippet wrapped in a <div> tag.

## Constraints
- Style: Film-critic-like; analytical, thematic, interpretive, yet readable.
- Detail: Provide deeper commentary on narrative structure, thematic axes, cinematic techniques, or historical significance.
- Grouping: Organize recommended movies into 2–3 thematic clusters based on your critical interpretation.
- Evidence: Incorporate scores (e.g., 0.038574) to justify recommendations.
- Input Awareness: Critically connect the user's favorite films to the recommendations.
- Format: Use <div class="analysis">, <h3>, <h4>, <ul>, <li>, and <p>. Do not include <html> or <body> tags.

## Additional Instruction (Important)
- Use official Japanese release titles (邦題) for all films.
- If multiple Japanese titles exist, select the most culturally established one.
- The tone should resemble a seasoned critic who understands cinematic grammar, subtext, and historical influence.

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

**Output（映画批評家寄りの文体）:**  
<div class="analysis">
  <h3>嗜好分析と映画批評的観点に基づく推薦</h3>
  <p>
    あなたが選び抜いた映画群——『ユージュアル・サスペクツ』『シンドラーのリスト』『ニュー・シネマ・パラダイス』『プライベート・ライアン』『クラッシュ』『スラムドッグ＄ミリオネア』『それでも夜は明ける』『コーダ あいのうた』『ファーザー』——は、いずれも人間存在の核心をとらえようとする力強い作品です。  
    物語の構造的完成度、倫理的緊張、映像と言語の見事な統合、といった軸に明確な嗜好が見られます。  
    以下の作品群は、その美学的感受性に呼応する映画として十分な説得力を備えています。
  </p>

  <h4>希望と人間性の再生をめぐるドラマ</h4>
  <ul>
    <li>
      <strong>ショーシャンクの空に（1994）</strong>（スコア: 0.038574）<br>
      陽光の差さない空間における精神の解放を描いた本作は、刑務所という閉鎖環境を“社会の縮図”として読み解くことが可能です。  
      物語は、抑圧に対する人間の抵抗と微細な希望の蓄積を、きわめて建築的な脚本構造で積み上げていきます。  
      『シンドラーのリスト』『コーダ あいのうた』に見られる“個人の尊厳”というテーマとの連続性は特筆に値します。
    </li>

    <li>
      <strong>フォレスト・ガンプ／一期一会（1994）</strong>（スコア: 0.017204）<br>
      人物の成長譚として読むだけでなく、アメリカ現代史を俯瞰する文化批評としても鑑賞できる多層的な作品です。  
      フォレストという“無垢な観測者”を通して国家の精神史を描き出す構造は、  
      『ニュー・シネマ・パラダイス』に通じるノスタルジアの装置を備えつつ、より社会的射程の広い映画的試みとなっています。
    </li>
  </ul>

  <h4>心理構造と社会的闇をえぐり出す作品群</h4>
  <ul>
    <li>
      <strong>ファイト・クラブ（1999）</strong>（スコア: 0.020944）<br>
      自己破壊と再構築のダイナミズムを通じて、消費資本主義の空洞化した主体性を批判する作品。  
      あなたが『クラッシュ』に見出した“社会的構造の暴露”と“人間の脆弱性”というテーマの延長線上にあります。  
      語りの信頼性（narrative reliability）を意図的に揺らがせる脚本は、映画を二度見したくなる強い構造的魅力を持ちます。
    </li>

    <li>
      <strong>羊たちの沈黙（1991）</strong>（スコア: 0.015544）<br>
      本作が優れているのは、犯罪映画ではなく“知性と倫理の対話劇”として成立している点です。  
      クラリスとレクターの対話は、権力関係と心理的裸形化の応酬として読解可能で、映像言語の精密なコントロールが光ります。  
      『ユージュアル・サスペクツ』の知的緊張感ともっとも近い位置にある作品です。
    </li>
  </ul>

  <h4>倫理的深度と家族の宿命を描く叙事詩的ドラマ</h4>
  <ul>
    <li>
      <strong>ゴッドファーザー（1972）／ゴッドファーザー PART II（1974）</strong><br>
      権力、家族、裏切りという古典的主題を、ギリシア悲劇にも通じる重層性で再構築した映画史上の金字塔。  
      特にPART IIは過去と現在を往還する編集構造が秀逸で、“父と子”の物語が悲劇的必然性を帯びて展開します。  
      『それでも夜は明ける』の倫理的緊張とも響き合う領域の深い作品群です。
    </li>
  </ul>

  <h4>存在論的問いを投げかけるSF的想像力</h4>
  <ul>
    <li>
      <strong>インセプション（2010）</strong>（スコア: 0.021474）<br>
      本作の魅力は“夢の階層構造”というギミックだけではなく、主人公の罪責と喪失が物語の駆動力として機能している点にあります。  
      現実の認識が揺らぐ感覚は、『ファーザー』の老いと記憶のドラマをSF的規模へ拡張したものと読むことができます。
    </li>

    <li>
      <strong>マトリックス（1999）</strong>（スコア: 0.019618）<br>
      フィロソフィカルな問いとアクション映画の快楽が高度に統合された作品。  
      “世界は構築物にすぎない”という発想はデカルト的懐疑を現代的に再配置しており、  
      『それでも夜は明ける』が扱った“自由とは何か”という問いをメタレベルで継承しています。
    </li>
  </ul>

  <h4>英雄神話を再解釈する叙事詩的アプローチ</h4>
  <ul>
    <li>
      <strong>ダークナイト（2008）</strong>（スコア: 0.014132）<br>
      善悪二元論を大胆に拒否し、正義の概念を揺さぶる作品。  
      ジョーカーは無秩序の象徴として、バットマンの“倫理の限界線”を炙り出します。  
      『プライベート・ライアン』の“自己犠牲の美学”を都市神話のレベルで再構築した作品です。
    </li>

    <li>
      <strong>ロード・オブ・ザ・リング／旅の仲間（2001）</strong>（スコア: 0.013056）<br>
      トールキン文学の精神を忠実に映画的文法へ翻訳し、神話的想像力を現代に蘇らせた大作。  
      友情・使命・腐敗・希望といったテーマが緻密に編まれ、  
      『ニュー・シネマ・パラダイス』が持つ“映画的美の感覚”とも共鳴します。
    </li>
  </ul>

  <h4>まとめ</h4>
  <p>
    あなたの嗜好は、物語の倫理的核心と映画表現の美学的完成度を同時に求める、成熟した映画観に裏打ちされています。  
    今回挙げた作品群は、その高い要請に応えるだけの歴史的・テーマ的重量を備えています。  
    いずれも鑑賞後に長い余韻を残し、新たな読み解きを誘う映画です。
  </p>
</div>

## User Favorite Movies
${favoriteMovies}

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
