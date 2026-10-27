import { readSeoConfig, type WebsiteSeoConfig } from "./config";

type WebsiteDescription = {
  name: string;
  description: string;
  language: string;
};

export function createWebsiteJsonLd(
  { name, description, language }: WebsiteDescription,
  config: WebsiteSeoConfig = readSeoConfig(),
) {
  if (!config.url) return undefined;
  const url = new URL("/", config.url).href;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": url,
    url,
    name,
    description,
    inLanguage: language,
  };
}

export function serializeJsonLd(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("Structured data must be JSON serializable.");
  return serialized.replace(/</g, "\\u003c");
}
