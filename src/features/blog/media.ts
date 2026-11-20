import "server-only";

import { getApiBaseUrl } from "@/shared/api/origin";

import { isFileId } from "./paths";

const mediaHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function publicMedia(
  request: Request,
  id: string,
): Promise<Response> {
  if (!isFileId(id))
    return new Response(undefined, { status: 404, headers: mediaHeaders });
  try {
    const upstream = await fetch(
      new URL(`/files/${id}/content`, getApiBaseUrl()),
      {
        headers: { Accept: "image/jpeg, image/png" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
      },
    );
    if (!upstream.ok)
      return new Response(undefined, {
        status: upstream.status === 404 ? 404 : 503,
        headers: mediaHeaders,
      });
    const contentType = upstream.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (contentType !== "image/jpeg" && contentType !== "image/png")
      throw new Error("Invalid image type");
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error("Missing image body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.byteLength;
        if (size > 20 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Image limit");
        }
        chunks.push(item.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const valid =
      contentType === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : [137, 80, 78, 71, 13, 10, 26, 10].every(
            (value, index) => bytes[index] === value,
          );
    if (!valid) throw new Error("Invalid image bytes");
    return new Response(bytes, {
      headers: { ...mediaHeaders, "Content-Type": contentType },
    });
  } catch {
    return new Response(undefined, { status: 503, headers: mediaHeaders });
  }
}
