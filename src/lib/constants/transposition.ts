export const MIN_TRANSPOSE = -5;
export const MAX_TRANSPOSE = 5;

export function clampTranspose(semitones: number): number {
  return Math.min(Math.max(semitones, MIN_TRANSPOSE), MAX_TRANSPOSE);
}
