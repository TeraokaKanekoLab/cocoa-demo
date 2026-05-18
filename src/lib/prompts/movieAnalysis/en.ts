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

# Suggested Structure
- 2-3 themed sections with \`###\` headings.
- For each recommended title, include:
  - title
  - score
  - short explanation of why it matches favorites
- End with a \`### Summary\` section (2-3 sentences).

# Actual Task
User Favorites:
${favoriteText}

Recommendation List:
${rankingText}

Generate Markdown only.`;
}
