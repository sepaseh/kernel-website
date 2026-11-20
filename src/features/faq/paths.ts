export const faqPageSize = 20;
export const faqMaxOffset = 10_000_000;
export const faqPath = (page = 1) => `/faq${page > 1 ? `/page/${page}` : ""}`;

export function parseFaqPage(path: string[] = []) {
  if (!path.length) return 1;
  if (path.length !== 2 || path[0] !== "page" || !/^[1-9]\d*$/.test(path[1]))
    return undefined;
  const page = Number(path[1]);
  if (!Number.isSafeInteger(page) || (page - 1) * faqPageSize > faqMaxOffset)
    return undefined;
  return page;
}
