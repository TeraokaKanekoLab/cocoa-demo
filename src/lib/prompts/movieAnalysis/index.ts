import { buildMovieAnalysisPromptEn } from './en';
import { buildMovieAnalysisPromptJa } from './ja';

type Ranking = { name: string; score: number };

export function buildMovieAnalysisPrompt(args: {
  locale: string;
  favoriteMovies: string[];
  rankings: Ranking[];
}) {
  const { locale, favoriteMovies, rankings } = args;
  const normalized = String(locale || '').toLowerCase();
  if (normalized.startsWith('ja')) {
    return buildMovieAnalysisPromptJa({ favoriteMovies, rankings });
  }
  return buildMovieAnalysisPromptEn({ favoriteMovies, rankings });
}
