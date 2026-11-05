import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createWebsiteApiFixture,
  startWebsiteApiFixture,
} from "./website-api-fixture.mjs";

const website = "http://127.0.0.1:3010";
const environment = () => ({
  KERNEL_SYNTHETIC_ENV: "1",
  NODE_ENV: "test",
  PORT: "3100",
  WEBSITE_URL: website,
});
const password = "  Website fixture password  ";

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function fixture(t) {
  const server = createWebsiteApiFixture(environment());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => close(server));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (pathname, options = {}) => {
    const {
      body,
      cookie,
      headers = {},
      method = "GET",
      token,
      ...rest
    } = options;
    return fetch(`${origin}${pathname}`, {
      ...rest,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(method === "GET" ? {} : { Origin: website }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      method,
      redirect: "error",
    });
  };
  return { origin, request, server };
}

async function login(
  request,
  identifier = "09123456789",
  value = "password123",
) {
  const response = await request("/auth/login", {
    body: { identifier, password: value },
    method: "POST",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  const cookie = response.headers.get("set-cookie").split(";", 1)[0];
  return { body, cookie, response, token: body.access_token };
}

async function register(request, number, firstName = "Website") {
  const otp = await request("/auth/otp-request", {
    body: { mobile: number, purpose: "register" },
    method: "POST",
  });
  assert.equal(otp.status, 200);
  const response = await request("/auth/register", {
    body: {
      first_name: firstName,
      last_name: "Tester",
      mobile: number,
      otp: "123456",
      password,
    },
    method: "POST",
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  return {
    body,
    cookie: response.headers.get("set-cookie").split(";", 1)[0],
    response,
    token: body.access_token,
  };
}

test("test-only markers, canonical origins, fixed interfaces and explicit ports guard creation before other inputs", () => {
  assert.throws(
    () =>
      createWebsiteApiFixture({
        NODE_ENV: "production",
        get WEBSITE_URL() {
          throw new Error("Origin must not be read before the guard");
        },
      }),
    /test and synthetic markers/,
  );
  for (const change of [
    { KERNEL_SYNTHETIC_ENV: undefined },
    { KERNEL_SYNTHETIC_ENV: "true" },
    { NODE_ENV: "development" },
    { HOST: "0.0.0.0" },
    { PORT: undefined },
    { PORT: 3100 },
    { PORT: "0" },
    { PORT: "65536" },
    { PORT: "03100" },
    { PORT: "3100\n" },
    { WEBSITE_FIXTURE_CONTAINER: "true" },
    { WEBSITE_URL: "http://localhost:3010" },
    { WEBSITE_URL: "http://127.0.0.1" },
    { WEBSITE_URL: "http://127.0.0.1:3010/" },
    { WEBSITE_URL: "https://production.example:443" },
    { WEBSITE_URL: "http://user:password@127.0.0.1:3010" },
  ])
    assert.throws(() =>
      createWebsiteApiFixture({ ...environment(), ...change }),
    );
  assert.doesNotThrow(() =>
    createWebsiteApiFixture({
      ...environment(),
      WEBSITE_FIXTURE_CONTAINER: "0",
    }),
  );
  const container = {
    ...environment(),
    HOST: "0.0.0.0",
    WEBSITE_FIXTURE_CONTAINER: "1",
    WEBSITE_URL: "https://www.kernel.test:43443",
  };
  assert.doesNotThrow(() => createWebsiteApiFixture(container));
  assert.throws(
    () => createWebsiteApiFixture({ ...container, HOST: "127.0.0.1" }),
    /host/,
  );
  assert.throws(
    () =>
      createWebsiteApiFixture({
        ...container,
        WEBSITE_URL: "https://operator.example:43443",
      }),
    /isolated origin/,
  );
});

test("imports stay inert and the CLI refuses non-test execution", () => {
  const runtime = Object.fromEntries(
    ["PATH", "SystemRoot", "TEMP", "TMP"]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(new URL("./website-api-fixture.mjs", import.meta.url).href)}); console.log('inert');`,
    ],
    {
      encoding: "utf8",
      env: { ...runtime, NODE_ENV: "production" },
    },
  );
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout.trim(), "inert");
  const rejected = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./website-api-fixture.mjs", import.meta.url))],
    {
      encoding: "utf8",
      env: { ...runtime, ...environment(), NODE_ENV: "production" },
    },
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /explicit test and synthetic markers/);
});

test("native HTTP exposes only known methods and rejects origin, media-type, JSON and body-size errors", async (t) => {
  const { origin, request } = await fixture(t);
  const health = await request("/health");
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("x-website-test-fixture"), "1");
  assert.match(health.headers.get("cache-control"), /no-store/);
  assert.equal((await request("/unknown")).status, 404);
  const method = await request("/auth/login");
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "POST");
  const settingsMethod = await request("/settings", {
    body: {},
    method: "DELETE",
  });
  assert.equal(settingsMethod.status, 405);
  assert.equal(settingsMethod.headers.get("allow"), "GET, PUT");
  assert.equal((await request("/account/me")).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        body: {},
        headers: { Origin: "https://other.example" },
        method: "POST",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/auth/login", {
        body: {},
        headers: { "Content-Type": "text/plain" },
        method: "POST",
      })
    ).status,
    415,
  );
  for (const body of ["{", "null", "[]"]) {
    const malformed = await fetch(`${origin}/auth/login`, {
      body,
      headers: { "Content-Type": "application/json", Origin: website },
      method: "POST",
    });
    assert.equal(malformed.status, 400);
  }
  assert.equal(
    (
      await request("/auth/login", {
        body: { identifier: "x".repeat(33 * 1024) },
        method: "POST",
      })
    ).status,
    413,
  );
  const missing = await request("/auth/login", { body: {}, method: "POST" });
  assert.equal(missing.status, 400);
  assert.deepEqual((await missing.json()).cause, {
    identifier: "Enter a valid value.",
  });
});

test("registration requires a requested destination-bound code and returns isolated HttpOnly cookie sessions", async (t) => {
  const { request } = await fixture(t);
  const number = "09180001001";
  const body = {
    first_name: "  Website  ",
    last_name: "  Tester  ",
    mobile: number,
    otp: "123456",
    password,
  };
  assert.equal(
    (await request("/auth/register", { body, method: "POST" })).status,
    400,
  );
  for (const value of [
    { mobile: "invalid", purpose: "register" },
    { mobile: number, purpose: "other" },
    { mobile: number, purpose: "forgot_password" },
  ])
    assert.equal(
      (await request("/auth/otp-request", { body: value, method: "POST" }))
        .status,
      400,
    );
  const issued = await request("/auth/otp-request", {
    body: { mobile: number, purpose: "register" },
    method: "POST",
  });
  assert.deepEqual(await issued.json(), {
    expires_in: 300,
    remaining_seconds: 60,
  });
  for (const change of [
    { otp: "000000" },
    { first_name: "x".repeat(1001) },
    { password: "short" },
  ])
    assert.equal(
      (
        await request("/auth/register", {
          body: { ...body, ...change },
          method: "POST",
        })
      ).status,
      400,
    );
  const created = await request("/auth/register", { body, method: "POST" });
  assert.equal(created.status, 201);
  const session = await created.json();
  assert.equal(session.account.first_name, "Website");
  assert.equal(session.account.last_name, "Tester");
  assert.equal(Object.hasOwn(session.account, "password"), false);
  assert.equal(typeof session.access_token, "string");
  assert.equal(typeof session.refresh_token, "string");
  const header = created.headers.get("set-cookie");
  assert.match(header, /session_token=.*; Path=\/; HttpOnly; SameSite=Lax/);
  const cookie = header.split(";", 1)[0];
  assert.deepEqual(
    await (await request("/account/me", { cookie })).json(),
    session.account,
  );
  assert.equal(
    (await request("/account/me", { cookie, token: "forged" })).status,
    401,
  );
  assert.equal(
    (await request("/auth/register", { body, method: "POST" })).status,
    409,
  );
  assert.equal(
    (
      await request("/auth/otp-request", {
        body: { mobile: number, purpose: "register" },
        method: "POST",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/auth/login", {
        body: { identifier: number, password: password.trim() },
        method: "POST",
      })
    ).status,
    401,
  );
  assert.equal((await request("/account/me", { cookie })).status, 200);
});

test("settings are owned per instance and only its administrator may update a supported language", async (t) => {
  const first = await fixture(t),
    second = await fixture(t);
  assert.equal(
    (await (await first.request("/settings")).json()).language.code,
    "en",
  );
  assert.equal(
    (
      await first.request("/settings", {
        body: { language_code: "fa" },
        method: "PUT",
      })
    ).status,
    401,
  );
  const ordinary = await register(first.request, "09180001002");
  assert.equal(
    (
      await first.request("/settings", {
        body: { language_code: "fa" },
        cookie: ordinary.cookie,
        method: "PUT",
      })
    ).status,
    403,
  );
  const administrator = await login(first.request);
  for (const code of [
    "ar",
    "de",
    "en",
    "es",
    "fa",
    "fr",
    "it",
    "pt",
    "ru",
    "tr",
  ]) {
    const saved = await first.request("/settings", {
      body: { dark_theme: {}, language_code: code, light_theme: {} },
      method: "PUT",
      token: administrator.token,
    });
    assert.equal(saved.status, 200);
    const settings = await saved.json();
    assert.equal(settings.language.code, code);
    assert.equal(
      settings.language.direction,
      ["ar", "fa"].includes(code) ? "rtl" : "ltr",
    );
    assert.deepEqual(await (await first.request("/settings")).json(), settings);
  }
  assert.equal(
    (
      await first.request("/settings", {
        body: { language_code: "unknown" },
        method: "PUT",
        token: administrator.token,
      })
    ).status,
    400,
  );
  assert.equal(
    (await (await first.request("/settings")).json()).language.code,
    "tr",
  );
  assert.equal(
    (await (await second.request("/settings")).json()).language.code,
    "en",
  );
  assert.equal(
    (await second.request("/account/me", { cookie: ordinary.cookie })).status,
    401,
  );
});

test("profile, username and destination-bound email mutations preserve other sessions and logout ownership", async (t) => {
  const { request } = await fixture(t);
  const first = await register(request, "09180001003", "First");
  const second = await register(request, "09180001004", "Second");
  const firstRequest = (path, body, method = "POST") =>
    request(path, { body, cookie: first.cookie, method });
  const updated = await firstRequest(
    "/account/update-profile",
    { first_name: " Updated ", last_name: " One " },
    "PATCH",
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).first_name, "Updated");
  assert.equal(
    (await firstRequest("/account/update-profile", { first_name: "" }, "PATCH"))
      .status,
    400,
  );
  assert.equal(
    (
      await firstRequest("/account/update-username", {
        username: "Bad Username",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await firstRequest("/account/update-username", {
        username: "website_tester",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/account/update-username", {
        body: { username: "website_tester" },
        cookie: second.cookie,
        method: "POST",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await firstRequest("/account/request-email-verification", {
        email: "invalid",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await firstRequest("/account/request-email-verification", {
        email: "first@example.test",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await firstRequest("/account/verify-email", {
        email: "other@example.test",
        otp: "123456",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await firstRequest("/account/verify-email", {
        email: "first@example.test",
        otp: "000000",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await firstRequest("/account/verify-email", {
        email: "first@example.test",
        otp: "123456",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await firstRequest("/account/verify-email", {
        email: "first@example.test",
        otp: "123456",
      })
    ).status,
    400,
  );
  const account = await (
    await request("/account/me", { cookie: first.cookie })
  ).json();
  assert.equal(account.email, "first@example.test");
  assert.equal(account.username, "website_tester");
  assert.equal(
    (await (await request("/account/me", { cookie: second.cookie })).json())
      .first_name,
    "Second",
  );
  const loggedOut = await firstRequest("/auth/logout", {});
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(
    (await request("/account/me", { cookie: first.cookie })).status,
    401,
  );
  assert.equal(
    (await request("/account/me", { cookie: second.cookie })).status,
    200,
  );
});

test("email validation rejects malformed addresses and preserves the accepted trimmed address shapes", async (t) => {
  const { request } = await fixture(t);
  const account = await register(request, "09180001006");
  const submit = (path, value) =>
    request(path, {
      body: { email: value, otp: "123456" },
      cookie: account.cookie,
      method: "POST",
    });
  for (const value of [
    "",
    null,
    "@b.c",
    "a@",
    "a@b",
    "a@.bc",
    "a@bc.",
    "a@b.c@d.e",
    "a@@b.c",
    "a@b.c@",
    "a b@c.d",
    "a@b .c",
    "a@b.c\td",
    `a@${"x".repeat(250)}`,
  ]) {
    for (const path of [
      "/account/request-email-verification",
      "/account/verify-email",
    ]) {
      const response = await submit(path, value);
      assert.equal(response.status, 400, JSON.stringify({ path, value }));
      assert.equal(Object.hasOwn((await response.json()).cause, "email"), true);
    }
  }
  assert.equal(
    Object.hasOwn(
      await (await request("/account/me", { cookie: account.cookie })).json(),
      "email",
    ),
    false,
  );
  for (const value of ["  a@b.c  ", "a@a..", "a@.a.b", "a@a.b."]) {
    assert.equal(
      (await submit("/account/request-email-verification", value)).status,
      200,
    );
    const verified = await submit("/account/verify-email", value);
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).email, value.trim());
  }
});

test("password changes and recovery preserve exact strings, reject invalid codes and revoke prior sessions", async (t) => {
  const { request } = await fixture(t);
  const number = "09180001005",
    changed = "  changed fixture password  ",
    recovered = "  recovered fixture password  ";
  const first = await register(request, number),
    another = await login(request, number, password);
  const change = (value) =>
    request("/auth/change-password", {
      body: value,
      cookie: first.cookie,
      method: "POST",
    });
  assert.equal(
    (await change({ current_password: "incorrect", new_password: changed }))
      .status,
    400,
  );
  assert.equal(
    (await request("/account/me", { cookie: first.cookie })).status,
    200,
  );
  assert.equal(
    (await change({ current_password: password, new_password: changed }))
      .status,
    200,
  );
  for (const cookie of [first.cookie, another.cookie])
    assert.equal((await request("/account/me", { cookie })).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        body: { identifier: number, password },
        method: "POST",
      })
    ).status,
    401,
  );
  const current = await login(request, number, changed);
  assert.equal(
    (
      await request("/auth/otp-request", {
        body: { mobile: number, purpose: "forgot_password" },
        method: "POST",
      })
    ).status,
    200,
  );
  const recover = (otp) =>
    request("/auth/forgot-password", {
      body: { mobile: number, otp, password: recovered },
      method: "POST",
    });
  assert.equal((await recover("000000")).status, 400);
  assert.equal(
    (await request("/account/me", { cookie: current.cookie })).status,
    200,
  );
  assert.equal((await recover("123456")).status, 200);
  assert.equal(
    (await request("/account/me", { cookie: current.cookie })).status,
    401,
  );
  assert.equal((await recover("123456")).status, 400);
  assert.equal(
    (
      await request("/auth/forgot-password", {
        body: { mobile: "09180001999", otp: "123456", password: recovered },
        method: "POST",
      })
    ).status,
    400,
  );
  await login(request, number, recovered);
});

test("start owns a loopback listener and reports an occupied port without disturbing its owner", async (t) => {
  const { origin, request, server } = await fixture(t);
  const port = new URL(origin).port;
  await assert.rejects(
    startWebsiteApiFixture({ ...environment(), PORT: port }),
    { code: "EADDRINUSE" },
  );
  assert.equal((await request("/health")).status, 200);
  // Reuse only this test's just-released port to exercise successful startup.
  await close(server);
  const started = await startWebsiteApiFixture({
    ...environment(),
    PORT: port,
  });
  t.after(() => close(started));
  assert.equal(started.address().address, "127.0.0.1");
  assert.equal((await request("/health")).status, 200);
});
