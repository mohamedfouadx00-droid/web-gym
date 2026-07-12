/** Normalises common Arabic spelling variants so search feels forgiving. */
export function normalizeArabicSearch(value: string) {
  return value
    .toLocaleLowerCase('ar-EG')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesArabicSearch(value: string, query: string) {
  const normalizedQuery = normalizeArabicSearch(query)
  return !normalizedQuery || normalizeArabicSearch(value).includes(normalizedQuery)
}
