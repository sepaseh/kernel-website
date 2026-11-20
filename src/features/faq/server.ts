import "server-only";

import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { loadFaqs } from "./api";
import { faqPageSize, faqPath, parseFaqPage } from "./paths";

const getFaqs = cache(loadFaqs);

export async function resolveFaq(path?: string[]) {
  const page = parseFaqPage(path);
  if (page === undefined) notFound();
  const canonical = faqPath(page);
  if (`/faq${path?.length ? `/${path.join("/")}` : ""}` !== canonical)
    permanentRedirect(canonical);
  const faqs = await getFaqs(page);
  if (page > 1 && (page - 1) * faqPageSize >= faqs.total) notFound();
  return { page, faqs, path: canonical };
}
