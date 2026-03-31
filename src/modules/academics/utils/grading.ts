// ─── Shared Grading Utility ──────────────────────────────────────────

export interface GradeDef {
  grade: string;
  minScore: number;
  maxScore: number;
  interpretation: string;
  gradePoint: number;
}

/**
 * Look up grade from a grading scale given a numeric score.
 * gradeDefinitions should be sorted by minScore desc.
 */
export function lookupGrade(
  score: number,
  gradeDefinitions: GradeDef[],
): { grade: string; interpretation: string } | null {
  for (const gd of gradeDefinitions) {
    if (score >= gd.minScore && score <= gd.maxScore) {
      return { grade: gd.grade, interpretation: gd.interpretation };
    }
  }
  // Fallback to lowest grade if score is below all ranges
  if (gradeDefinitions.length > 0) {
    const lowest = gradeDefinitions[gradeDefinitions.length - 1];
    return { grade: lowest.grade, interpretation: lowest.interpretation };
  }
  return null;
}
