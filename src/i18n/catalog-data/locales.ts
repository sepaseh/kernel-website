export const localeCodes = [
  "ar",
  "de",
  "en",
  "es",
  "fa",
  "fr",
  "it",
  "pt",
  "ru",
  "tr",
] as const;

export type LocaleCode = (typeof localeCodes)[number];
