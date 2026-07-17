/**
 * Read-only lookup over the bundled exercise catalog (trimmed from
 * hasaneyldrm/exercises-dataset, MIT — see scripts/build-exercise-catalog.js).
 *
 * This is reference data, not user data: it never touches Drizzle/SQLite and
 * never syncs. It only powers the exercise-name search in the "add exercise"
 * picker — gym_exercises still stores a plain `name` string.
 */
import catalogData from '../data/exerciseCatalog.json';

export interface CatalogExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  instructions: { en?: string; es?: string };
  instruction_steps: { en?: string[]; es?: string[] };
}

const catalog = catalogData as CatalogExercise[];

const DEFAULT_LIMIT = 20;

/**
 * Case-insensitive substring search over exercise names. Prefix matches rank
 * above substring-only matches. Empty query returns no results (the picker
 * shows nothing until the user starts typing, matching the old free-text field).
 */
export function searchExercises(query: string, limit = DEFAULT_LIMIT): CatalogExercise[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const prefixMatches: CatalogExercise[] = [];
  const substringMatches: CatalogExercise[] = [];

  for (const exercise of catalog) {
    const name = exercise.name.toLowerCase();
    if (name.startsWith(trimmed)) {
      prefixMatches.push(exercise);
    } else if (name.includes(trimmed)) {
      substringMatches.push(exercise);
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, limit);
}
