export function getApiBaseUrl() {
  const base = new URL(process.env.API_BASE_URL || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("The API connection is not configured.");
  }
  return base;
}
