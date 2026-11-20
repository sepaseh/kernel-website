import { afterEach, describe, expect, it, vi } from "vitest";

import { submitContact } from "./api";

const body = {
  name: " Ada ",
  mobile: "۰۹۱۲۳۴۵۶۷۸۹",
  description: "<script>plain text</script>\nSecond",
};
const key = "11111111-1111-4111-8111-111111111111";
const receipt = {
  id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-11-07T10:00:00.000Z",
};
afterEach(() => vi.unstubAllGlobals());
describe("anonymous contact request", () => {
  it("sends only the three fields and UUID header, never cookies, and returns only safe receipt fields", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...receipt, ignored: true }, { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await submitContact(body, key, "fa")).toEqual(receipt);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/public/contact-messages");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      cache: "no-store",
    });
    expect(JSON.parse(init.body)).toEqual(body);
    expect(new Headers(init.headers).get("idempotency-key")).toBe(key);
  });
  it.each([
    null,
    [],
    {},
    { ...receipt, id: "wrong" },
    { ...receipt, created_at: "wrong" },
    { ...receipt, created_at: "9999-99-99T00:00:00.000Z" },
  ])("treats malformed receipt %# as an uncertain failure", async (value) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(value, { status: 201 })),
    );
    await expect(submitContact(body, key, "en")).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});
