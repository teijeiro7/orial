import { searchExercises } from './exerciseCatalogService';

describe('searchExercises', () => {
  it('returns matches whose name contains the query (case-insensitive)', () => {
    const results = searchExercises('bench press');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.name.toLowerCase()).toContain('bench press');
    }
  });

  it('returns an empty array for an empty query', () => {
    expect(searchExercises('')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchExercises('zzz-not-a-real-exercise-zzz')).toEqual([]);
  });

  it('respects the limit parameter', () => {
    const results = searchExercises('a', 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('ranks prefix matches before substring-only matches', () => {
    const results = searchExercises('squat', 20);
    const firstNonPrefixIndex = results.findIndex(
      (r) => !r.name.toLowerCase().startsWith('squat'),
    );
    const lastPrefixIndex = results
      .map((r) => r.name.toLowerCase().startsWith('squat'))
      .lastIndexOf(true);
    if (firstNonPrefixIndex !== -1 && lastPrefixIndex !== -1) {
      expect(lastPrefixIndex).toBeLessThan(firstNonPrefixIndex);
    }
  });
});
