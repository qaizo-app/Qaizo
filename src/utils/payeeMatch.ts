// src/utils/payeeMatch.ts
// Tiny case-insensitive substring matcher for payee/recipient strings.
// Used by statement reconciliation and smart categorisation so both layers
// agree on what "the same merchant" means.

function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // collapse runs of non-alphanumerics
    .trim();
}

export function fuzzyPayee(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}
