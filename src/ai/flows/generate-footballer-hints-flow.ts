'use server';
/**
 * @fileOverview A Genkit flow that generates increasingly specific hints about a footballer.
 *
 * - generateFootballerHints - A function that handles the hint generation process.
 * - GenerateFootballerHintsInput - The input type for the generateFootballerHints function.
 * - GenerateFootballerHintsOutput - The return type for the generateFootballerHints function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateFootballerHintsInputSchema = z.object({
  footballerName: z.string().describe('The name of the footballer for whom to generate hints.'),
});
export type GenerateFootballerHintsInput = z.infer<typeof GenerateFootballerHintsInputSchema>;

const GenerateFootballerHintsOutputSchema = z.object({
  hints: z.array(z.string()).describe('An array of increasingly specific hints about the footballer.'),
});
export type GenerateFootballerHintsOutput = z.infer<typeof GenerateFootballerHintsOutputSchema>;

export async function generateFootballerHints(
  input: GenerateFootballerHintsInput
): Promise<GenerateFootballerHintsOutput> {
  return generateFootballerHintsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFootballerHintsPrompt',
  input: { schema: GenerateFootballerHintsInputSchema },
  output: { schema: GenerateFootballerHintsOutputSchema },
  prompt: `You are an AI assistant specialized in generating trivia hints about famous footballers.

Generate an array of 5 increasingly specific hints about the footballer named "{{{footballerName}}}".
Each hint should be a short sentence or phrase.
The hints should start general and become more specific, leading to the player's identity.

Example for Lionel Messi:
[
  "He is often considered one of the greatest players of all time.",
  "He has spent the majority of his club career at FC Barcelona.",
  "He is an Argentine professional footballer.",
  "He has won a record eight Ballon d'Or awards.",
  "His nickname is 'La Pulga Atomica' (The Atomic Flea)."
]`,
});

const generateFootballerHintsFlow = ai.defineFlow(
  {
    name: 'generateFootballerHintsFlow',
    inputSchema: GenerateFootballerHintsInputSchema,
    outputSchema: GenerateFootballerHintsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate footballer hints.');
    }
    return output;
  }
);
