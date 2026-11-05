import { readSeoConfig, type WebsiteSeoConfig } from "./config";

type WebsiteDescription = {
  name: string;
  description: string;
  language: string;
};

/**
 * Describe the configured WebSite entity without inventing an origin or additional
 * schema facts. Omit the entity entirely when no website origin is configured.
 */
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

/**
 * Serialize JSON-LD for an HTML script body, escaping every less-than character so
 * data cannot terminate the script. Reject values with no JSON representation.
 */
export function serializeJsonLd(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("Structured data must be JSON serializable.");
  return serialized.replaceAll("<", String.raw`\u003c`);
}
