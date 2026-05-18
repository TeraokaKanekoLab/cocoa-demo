type Ranking = { name: string; score: number };

export function buildMovieAnalysisPromptEn(args: {
  favoriteMovies: string[];
  rankings: Ranking[];
}) {
  const { favoriteMovies, rankings } = args;

  const favoriteText = favoriteMovies.length > 0 ? favoriteMovies.map((m) => `"${m}"`).join('\n') : '(none)';
  const rankingText = rankings.map((r) => `${r.name}: ${r.score}`).join('\n');

  return `Act as a Movie Analyst.
Explain the ranking logically based on user favorites and the given scores.

# Inputs
1. User Favorites
2. Recommendation List (Title + Score)

# Output Rules (Strict)
- Output **ONLY Markdown** in plain text.
- **Never output HTML tags** (no <div>, <p>, <ul>, etc.).
- Do not use markdown code fences.
- Language: English.

# Content Rules
1. When explaining relevance, refer only to movies listed in User Favorites.
2. Do not mention unlisted movies.
3. Use official English titles.

# Content Structure
1. **Thematic Recommendations**: Group recommendations into 2-3 themes.
   - **Theme Header**: Use Heading 3 and quote (\`> ###\`).
   - **Movie Items**:
     - **Title**: Movie title in bold (\`**Title**\`).
     - **Score**: Display the Score clearly with code formatting (\`\`\`Score: 0.XXXX\`\`\`).
     - **Description**: A single paragraph combining:
       1. **Overview**: Briefly explain what kind of movie it is.
       2. **Score**: Mention the specific score value.
       3. **Connection**: Explain *why* it fits by referencing **ONLY** the provided User Favorites.
2. **Summary Section**: A final section.
   - **Format**: Separated by a horizontal rule (\`---\`), titled with Heading 3 (\`### Summary\`).
   - **Content**: Summarize the user's detected preference and the recommendation strategy in 2-3 sentences.

# Output Example
# One-Shot Example

**Input (User Favorites):**
"Usual Suspects, The (1995)"
Schindler's List (1993)

**Input (Recommendation List):**
1 "Shawshank Redemption, The (1994)": 0.0385
2 "Inception (2010)": 0.0214

**Output:**
> ### Drama of Hope and Rebirth

**The Shawshank Redemption (1994)**  
\`\`\`Score: 0.0385\`\`\`

This is an enduring human drama depicting a man imprisoned for a crime he didn't commit, who never loses hope despite desperate circumstances. Recording a top score of **0.0385** in this analysis, the data suggests this is a "must-watch" for you. The profound theme of "human dignity in extreme conditions" found in your favorite, *Schindler's List*, resonates deeply with the story of hope portrayed in this film.  
  
> ### Suspense of Perception and Reality

**Inception (2010)**  
\`\`\`Score: 0.0214\`\`\`

A sci-fi action blockbuster with a novel premise of infiltrating dreams to steal ideas from the subconscious. With a score of **0.0214**, it ranks highly and shows a strong alignment with your taste vector. Specifically, the multi-layered structure of this film perfectly fits the intellectual curiosity you show for "unpredictable plot twists" and "complex screenplays," as seen in *The Usual Suspects*.  

---

### Summary
Your movie list indicates a strong preference for moving dramas that shine humanity in adversity, as well as intricate suspense films with unpredictable developments. In this recommendation list, we have carefully selected high-scoring analyzed works that combine "narrative weight" with "structural ingenuity."

# Actual Task
User Favorites:
${favoriteText}

Recommendation List:
${rankingText}

Generate Markdown only.`;
}
