export type WebsiteSeoConfig = {
  url?: URL;
  indexable: boolean;
};

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^127(?:\.\d{1,3}){3}$/.test(host) ||
    host === "[::1]" ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host)
  );
}

export function readSeoConfig(
  environment: Record<string, string | undefined> = process.env,
): WebsiteSeoConfig {
  const flag = environment.WEBSITE_INDEXING_ENABLED;
  if (flag !== undefined && flag !== "false" && flag !== "true")
    throw new Error("WEBSITE_INDEXING_ENABLED must be 'true' or 'false'.");

  const requested = flag === "true";
  const configured = environment.WEBSITE_URL;
  if (configured === undefined || configured === "") {
    if (requested)
      throw new Error(
        "WEBSITE_URL is required when website indexing is enabled.",
      );
    return { indexable: false };
  }

  let url: URL;
  try {
    if (
      !/^https?:\/\/[^/?#\\]+\/?$/i.test(configured) ||
      /\s/.test(configured) ||
      [...configured].some(
        (character) =>
          character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      )
    )
      throw new Error();
    url = new URL(configured);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new Error(
      "WEBSITE_URL must be an HTTP(S) origin without credentials, a path, query or fragment.",
    );
  }

  const loopback = isLoopback(url.hostname);
  if (url.protocol === "http:" && (!loopback || requested))
    throw new Error(
      "WEBSITE_URL requires HTTPS; HTTP is allowed only for non-indexed loopback previews.",
    );
  if (requested && loopback)
    throw new Error(
      "Website indexing requires a non-loopback HTTPS WEBSITE_URL.",
    );

  return {
    url,
    indexable: requested && environment.NODE_ENV === "production",
  };
}
