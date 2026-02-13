type Ranking = { name: string; score: number };

export function buildMovieAnalysisPromptJa(args: {
  favoriteMovies: string[];
  rankings: Ranking[];
}) {
  const { favoriteMovies, rankings } = args;

  const favoriteText = favoriteMovies.length > 0 ? favoriteMovies.map((m) => `「${m}」`).join('\n') : '（指定なし）';
  const rankingText = rankings.map((r) => `${r.name}: ${r.score}`).join('\n');

  return `Act as a Movie Analyst.
Your goal is to recommend movies based on user favorites, displayed in a constrained text box (vertical flow).
You must explain the recommendation logically using the provided "Score".

# Inputs
1. **User Favorites**: A list of movies the user loves.
2. **Recommendation List**: A ranked list of movies to recommend (Score, Title).

# Output Format
- Output **ONLY** a raw HTML snippet wrapped in a single \`<div>\`.
- Do NOT use markdown code blocks.
- **Language**: Japanese (Must be written in natural, professional Japanese).
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

Note: Since the output language is Japanese, you may label the summary section in Japanese (e.g., "まとめ").

# One-Shot Example

**Input (User Favorites):**
"Usual Suspects, The (1995)"
Schindler's List (1993)

**Input (Recommendation List):**
1 "ショーシャンクの空に": 0.0385
2 "インセプション": 0.0214

**Output:**
<div class="font-sans text-gray-800 leading-relaxed p-2">
  <h3 class="text-base font-bold text-gray-800 mb-3 flex items-center border-l-4 border-indigo-500 pl-2">
    希望と再生のドラマ
  </h3>
  <div class="space-y-6 mb-8">
    <div>
      <div class="font-bold text-indigo-700 text-base">ショーシャンクの空に</div>
      <div class="mt-1 mb-2">
        <span class="bg-indigo-50 text-indigo-800 text-xs px-2 py-1 rounded border border-indigo-100 font-mono">
          マッチスコア: 0.0385
        </span>
      </div>
      <p class="text-sm text-gray-700">
        無実の罪で投獄された男が、過酷な状況でも希望を失わずに生き抜く姿を描いたヒューマンドラマです。本分析では <strong>0.0385</strong> という高いスコアを記録しており、あなたの嗜好に強く合致していることを示します。お気に入りの <em>Schindler's List</em> にも見られる「極限状況における人間の尊厳」というテーマが、この作品の希望の物語と深く響き合います。
      </p>
    </div>
  </div>

  <h3 class="text-base font-bold text-gray-800 mb-3 flex items-center border-l-4 border-teal-500 pl-2">
    認識と現実が揺らぐサスペンス
  </h3>
  <div class="space-y-6 mb-8">
    <div>
      <div class="font-bold text-teal-700 text-base">インセプション</div>
      <div class="mt-1 mb-2">
        <span class="bg-teal-50 text-teal-800 text-xs px-2 py-1 rounded border border-teal-100 font-mono">
          マッチスコア: 0.0214
        </span>
      </div>
      <p class="text-sm text-gray-700">
        夢に潜入して潜在意識から情報を盗み出すという斬新な設定のSFアクション大作です。スコア <strong>0.0214</strong> により上位にランクインしており、あなたの嗜好ベクトルとの適合度が高いことが示されています。特に、<em>The Usual Suspects</em> で示されているような「予測不能な展開」や「複雑な脚本」への知的好奇心に、この作品の多層構造は非常によく合います。
      </p>
    </div>
  </div>
  
  <div class="bg-gray-50 p-4 rounded-lg text-sm border border-gray-200 mt-6">
    <h4 class="font-bold text-gray-700 mb-2">まとめ</h4>
    <p class="text-gray-600">
      あなたのお気に入りからは、逆境の中で人間性が輝く骨太なドラマと、先の読めない展開を持つ緻密なサスペンスへの強い嗜好が読み取れます。本ランキングでは、その傾向に沿って「物語の重み」と「構造の巧みさ」を兼ね備え、スコアが高い作品を優先して選定しています。
    </p>
  </div>
</div>

# Actual Task

**User Favorites:**
${favoriteMovies}

**Recommendation List:**
${rankingText}

**Generate the Output HTML:**`;
}