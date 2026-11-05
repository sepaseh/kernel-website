import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";

import {
  commandEnvironment,
  markedCliFixture,
  temporaryFixture,
} from "./deployment.test-support.mjs";
import { checkHealth } from "./healthcheck.mjs";

test("readiness probes check actual response semantics and do not follow redirects", async () => {
  const websiteContentTypes = new Map([
    ["/html-uppercase", "TeXt/HtMl ; Charset=UTF-8"],
    ["/mime-parameter", "application/json; note=text/html"],
    ["/mime-suffix", "text/html-other"],
    ["/mime-prefix", "application/not-text/html"],
    ["/mime-xhtml", "application/xhtml+xml"],
    ["/mime-missing", undefined],
  ]);
  const server = http.createServer((request, response) => {
    if (request.url === "/api") {
      response.setHeader("content-type", "application/json");
      response.end('{"status":"ok"}');
    } else if (request.url === "/bom-json") {
      response.setHeader("content-type", "application/json");
      response.end('\uFEFF{"status":"ok"}');
    } else if (request.url === "/website") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("<!doctype html><html><body>Ready</body></html>");
    } else if (request.url === "/text-only") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("Ready");
    } else if (websiteContentTypes.has(request.url)) {
      const contentType = websiteContentTypes.get(request.url);
      if (contentType !== undefined)
        response.setHeader("content-type", contentType);
      response.end("<!doctype html><html><body>Ready</body></html>");
    } else if (request.url === "/redirect") {
      response.writeHead(302, { location: "/website" });
      response.end();
    } else if (request.url === "/bad-json") {
      response.setHeader("content-type", "application/json");
      response.end('{"status":"starting"}');
    } else {
      response.writeHead(503);
      response.end("not ready");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await checkHealth("api", `${base}/api`);
    await checkHealth("api", `${base}/bom-json`);
    await checkHealth("website", `${base}/website`);
    await checkHealth("website", `${base}/html-uppercase`);
    await Promise.all(
      [
        ["api", "/bad-json"],
        ["website", "/api"],
        ["api", "/error"],
        ["website", "/redirect"],
        ["website", "/mime-parameter"],
        ["website", "/mime-suffix"],
        ["website", "/mime-prefix"],
        ["website", "/mime-xhtml"],
        ["website", "/mime-missing"],
        ["website", "/text-only"],
      ].map(([mode, target]) =>
        assert.rejects(() => checkHealth(mode, base + target)),
      ),
    );
    await assert.rejects(() => checkHealth("unknown", base));
    await assert.rejects(() => checkHealth("api", "file:///tmp/file"));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("health bodies stop at the byte limit and cancel unread response data", async (context) => {
  const limit = 1024 * 1024;
  for (const mode of ["api", "website"]) {
    const prefix = mode === "api" ? '{"status":"ok","padding":"' : "<html>";
    const suffix = mode === "api" ? '"}' : "</html>";
    const makeBody = (size) =>
      prefix + "x".repeat(size - prefix.length - suffix.length) + suffix;
    context.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(makeBody(limit), {
          headers: {
            "Content-Type": mode === "api" ? "application/json" : "text/html",
          },
        }),
    );
    await assert.doesNotReject(checkHealth(mode, "http://127.0.0.1:3010"));

    const bytes = new TextEncoder().encode(makeBody(limit * 2));
    let offset = 0;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        const next = bytes.subarray(offset, offset + 64 * 1024);
        offset += next.byteLength;
        controller.enqueue(next);
        if (offset === bytes.byteLength) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    context.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(body, {
          headers: {
            "Content-Type": mode === "api" ? "application/json" : "text/html",
          },
        }),
    );
    await assert.rejects(
      checkHealth(mode, "http://127.0.0.1:3010"),
      /1 MiB body limit/,
    );
    assert.equal(cancelled, true);
    assert.ok(offset < bytes.byteLength);
    context.mock.restoreAll();
  }
});

test("health CLI refuses a false phase before probing its explicit target", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  let requests = 0;
  const server = http.createServer((_request, response) => {
    requests += 1;
    response.setHeader("content-type", "text/html");
    response.end("<html>Owned fixture</html>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(
      process.execPath,
      [
        path.join(directory, "scripts/healthcheck.mjs"),
        "website",
        "http://127.0.0.1:" + server.address().port + "/owned-fixture",
      ],
      {
        env: commandEnvironment(),
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    const [status] = await once(child, "close");
    assert.equal(status, 1, stderr);
    assert.equal(requests, 0);
    assert.match(stderr, /applicationReady|non-runnable|runnable application/i);
    assert.doesNotMatch(stderr, /ENOENT|fetch failed|API_BASE_URL is required/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
