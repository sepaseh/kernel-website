import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
    } else if (request.url === "/website") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("<!doctype html><html><body>Ready</body></html>");
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

test("health CLI refuses a false phase before probing its explicit target", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const server = http.createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end("<html>Owned fixture</html>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const result = spawnSync(
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
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stderr,
      /applicationReady|non-runnable|runnable application/i,
    );
    assert.doesNotMatch(
      result.stderr,
      /ENOENT|fetch failed|API_BASE_URL is required/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
