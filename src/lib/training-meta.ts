export type TrainingCategory =
  | "driving"
  | "approach"
  | "short_game"
  | "putting"
  | "mental"
  | "fitness"
  | "other";

export const TRAINING_CATEGORIES: TrainingCategory[] = [
  "driving",
  "approach",
  "short_game",
  "putting",
  "mental",
  "fitness",
  "other",
];

export const CATEGORY_LABEL: Record<TrainingCategory, string> = {
  driving: "Salida",
  approach: "Aproximación",
  short_game: "Juego corto",
  putting: "Putt",
  mental: "Mental",
  fitness: "Físico",
  other: "Otro",
};

/** Maps a free-text category (Spanish/English from the AI or a form) to the enum. */
export function normalizeCategory(c: string): TrainingCategory {
  const v = (c || "").toLowerCase().trim();
  if (/put/.test(v)) return "putting";
  if (/corto|chip|pitch|bunker|arena/.test(v)) return "short_game";
  if (/driv|salida|tee/.test(v)) return "driving";
  if (/approach|aproxim|hierro|green|wedge/.test(v)) return "approach";
  if (/mental|psico|concentr/.test(v)) return "mental";
  if (/fit|fisic|físic|gimnas|fuerza/.test(v)) return "fitness";
  return "other";
}
