'use server';

/**
 * @fileOverview A validation utility for user guesses using Levenshtein distance.
 * It normalizes strings by removing accents and applying a dynamic threshold based on string length.
 */

export async function validateAnswer(input: { correctName: string; userGuess: string }) {
  const normalize = (str: string) => 
    str.normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .toLowerCase()
       .replace(/[^a-z0-9]/g, "")
       .trim();

  const rawCorrect = input.correctName;
  const rawGuess = input.userGuess;

  const correct = normalize(rawCorrect);
  const guess = normalize(rawGuess);

  // 1. Exact Match Check
  if (correct === guess) return { isCorrect: true };

  // 2. Partial Match Check (e.g., "Messi" for "Lionel Messi")
  const correctParts = rawCorrect.split(/\s+/).map(normalize);
  if (correctParts.includes(guess)) return { isCorrect: true };

  // 3. Levenshtein Distance Logic
  const getLevenshteinDistance = (a: string, b: string) => {
    const matrix = Array.from({ length: a.length + 1 }, () =>
      Array.from({ length: b.length + 1 }, (_, i) => i)
    );
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  };

  // Distance against the full normalized name
  const fullDistance = getLevenshteinDistance(correct, guess);
  
  // Dynamic Threshold Logic
  const getThreshold = (len: number) => {
    if (len <= 4) return 1;
    if (len <= 9) return 2;
    return 3;
  };

  if (fullDistance <= getThreshold(correct.length)) return { isCorrect: true };

  // 4. Distance against individual name parts (for names like "Szczesny")
  for (const part of correctParts) {
    if (part.length < 3) continue; // Skip very short initials or suffixes
    const partDistance = getLevenshteinDistance(part, guess);
    if (partDistance <= getThreshold(part.length)) return { isCorrect: true };
  }

  return { isCorrect: false };
}
