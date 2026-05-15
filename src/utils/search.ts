const DIACRITICS = /[̀-ͯ]/g;

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

export function matches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return normalize(haystack).includes(normalize(needle));
}
