type Ranking = { name: string; score: number };

export function buildMovieAnalysisPromptEn(args: {
  favoriteMovies: string[];
  rankings: Ranking[];
}) {
  const { favoriteMovies, rankings } = args;

  const favoriteText = favoriteMovies.length > 0 ? favoriteMovies.map((m) => `"${m}"`).join('\n') : '(none)';
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
}