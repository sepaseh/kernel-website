// Test-only HTTP behavior for this website. This is not an authentication service.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const cookieName = "website_fixture_session_token";
const verificationCode = "123456";
const languages = new Set([
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
]);

class FixtureError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.fields = fields;
    this.status = status;
  }
}

function configuration(environment) {
  if (
    environment.NODE_ENV !== "test" ||
    environment.KERNEL_SYNTHETIC_ENV !== "1"
  )
    throw new Error(
      "The website HTTP fixture requires explicit test and synthetic markers.",
    );
  const container = environment.WEBSITE_FIXTURE_CONTAINER;
  if (container !== undefined && container !== "0" && container !== "1")
    throw new Error("The fixture container marker must be 0 or 1.");
  const host = container === "1" ? "0.0.0.0" : "127.0.0.1";
  if (environment.HOST !== undefined && environment.HOST !== host)
    throw new Error("The fixture host does not match its isolated mode.");
  if (
    typeof environment.PORT !== "string" ||
    !/^[1-9]\d{0,4}$/.test(environment.PORT) ||
    String(Number(environment.PORT)) !== environment.PORT ||
    Number(environment.PORT) > 65535
  )
    throw new Error("The fixture requires an explicit nonzero TCP PORT.");
  let website;
  try {
    website = new URL(environment.WEBSITE_URL);
  } catch {
    throw new Error("The fixture requires an explicit synthetic WEBSITE_URL.");
  }
  if (
    website.origin !== environment.WEBSITE_URL ||
    !website.port ||
    website.username ||
    website.password ||
    (container === "1"
      ? website.protocol !== "https:" || website.hostname !== "www.kernel.test"
      : website.protocol !== "http:" || website.hostname !== "127.0.0.1")
  )
    throw new Error(
      "The fixture website must be the canonical isolated origin for its mode.",
    );
  return { host, port: Number(environment.PORT), website: website.origin };
}

function text(body, field, maximum = 1000) {
  const value = body[field];
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximum
  )
    throw new FixtureError(400, "Invalid synthetic fixture input.", {
      [field]: "Enter a valid value.",
    });
  return value.trim();
}

function password(body, field = "password") {
  const value = body[field];
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw new FixtureError(400, "Invalid synthetic fixture password.", {
      [field]: "Use 8–128 characters.",
    });
  return value;
}

function mobile(body) {
  const value = text(body, "mobile", 11);
  if (!/^09\d{9}$/.test(value))
    throw new FixtureError(400, "Invalid synthetic fixture mobile.", {
      mobile: "Enter an 11-digit mobile beginning with 09.",
    });
  return value;
}

function email(body) {
  const value = text(body, "email", 254);
  const parts = value.split("@");
  const [local, domain] = parts;
  if (
    parts.length !== 2 ||
    !local ||
    !domain ||
    /\s/.test(value) ||
    !domain.slice(1, -1).includes(".")
  )
    throw new FixtureError(400, "Invalid synthetic fixture email.", {
      email: "Enter a valid email.",
    });
  return value;
}

async function readJson(request) {
  if (
    request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new FixtureError(415, "Send a JSON fixture request.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes <= 32 * 1024) chunks.push(chunk);
  }
  if (bytes > 32 * 1024)
    throw new FixtureError(413, "The fixture request is too large.");
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new FixtureError(400, "Send a JSON object.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FixtureError(400, "Send a JSON object.");
  return value;
}

function publicAccount(account) {
  return {
    email: account.email,
    first_name: account.first_name,
    id: account.id,
    is_system_admin: account.administrator,
    last_name: account.last_name,
    mobile: account.mobile,
    permissions: account.administrator ? ["settings.update"] : [],
    status: "active",
    username: account.username,
  };
}

/** Create an unbound, independently owned in-memory responder after validating its test-only inputs. */
export function createWebsiteApiFixture(environment = process.env) {
  const config = configuration(environment);
  const accounts = new Map();
  const sessions = new Map();
  const codes = new Map();
  let language = "en";
  const administrator = {
    administrator: true,
    first_name: "Website",
    id: "website-fixture-administrator",
    last_name: "Fixture",
    mobile: "09123456789",
    password: "password123",
  };
  accounts.set(administrator.mobile, administrator);

  const settings = () => ({
    dark_theme: {},
    language: {
      calendar: language === "fa" ? "jalali" : "gregorian",
      code: language,
      direction: ["ar", "fa"].includes(language) ? "rtl" : "ltr",
      name: language,
      native_name: language,
    },
    light_theme: {},
  });
  const cookie = (value, expired = false) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax${config.website.startsWith("https:") ? "; Secure" : ""}${expired ? "; Max-Age=0" : ""}`;
  const tokenFor = (request) => {
    const authorization = request.headers.authorization;
    if (authorization !== undefined)
      return /^Bearer ([^\s]+)$/.exec(authorization)?.[1];
    return request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
  };
  const accountFor = (request) => {
    const account = sessions.get(tokenFor(request));
    if (!account)
      throw new FixtureError(
        401,
        "The synthetic session is not authenticated.",
      );
    return account;
  };
  const invalidate = (account) => {
    for (const [token, owner] of sessions)
      if (owner === account) sessions.delete(token);
  };
  const send = (response, status, value, headers = {}) => {
    response.writeHead(status, {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Website-Test-Fixture": "1",
      ...headers,
    });
    response.end(JSON.stringify(value));
  };
  const authenticate = (response, account, status = 200) => {
    const token = randomUUID();
    sessions.set(token, account);
    // Deliberate synthetic credential fields exercise the website's proxy redaction.
    send(
      response,
      status,
      {
        access_token: token,
        account: publicAccount(account),
        refresh_token: `fixture-${token}`,
      },
      { "Set-Cookie": cookie(token) },
    );
  };
  const requestCode = (key) => {
    codes.set(key, Date.now() + 300_000);
    return { expires_in: 300, remaining_seconds: 60 };
  };
  const verifyCode = (key, value) => {
    const expires = codes.get(key);
    if (
      value !== verificationCode ||
      expires === undefined ||
      expires <= Date.now()
    )
      throw new FixtureError(
        400,
        "The synthetic verification code is invalid.",
        { otp: "Enter the requested verification code." },
      );
    codes.delete(key);
  };

  const handlers = new Map([
    [
      "/account/me",
      {
        GET: (request, response) =>
          send(response, 200, publicAccount(accountFor(request))),
      },
    ],
    [
      "/account/request-email-verification",
      {
        POST: (request, response, body) => {
          const account = accountFor(request);
          const destination = email(body);
          return send(
            response,
            200,
            requestCode(`email:${account.id}:${destination}`),
          );
        },
      },
    ],
    [
      "/account/update-profile",
      {
        PATCH: (request, response, body) => {
          const account = accountFor(request);
          const first =
            body.first_name === undefined
              ? account.first_name
              : text(body, "first_name");
          const last =
            body.last_name === undefined
              ? account.last_name
              : text(body, "last_name");
          account.first_name = first;
          account.last_name = last;
          return send(response, 200, publicAccount(account));
        },
      },
    ],
    [
      "/account/update-username",
      {
        POST: (request, response, body) => {
          const account = accountFor(request);
          const username = text(body, "username", 30);
          if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username))
            throw new FixtureError(400, "Invalid synthetic fixture username.");
          if (
            [...accounts.values()].some(
              (owner) =>
                owner !== account &&
                (owner.username === username || owner.mobile === username),
            )
          )
            throw new FixtureError(
              409,
              "The synthetic username is already taken.",
            );
          account.username = username;
          return send(response, 200, publicAccount(account));
        },
      },
    ],
    [
      "/account/verify-email",
      {
        POST: (request, response, body) => {
          const account = accountFor(request);
          const destination = email(body);
          verifyCode(`email:${account.id}:${destination}`, body.otp);
          account.email = destination;
          return send(response, 200, publicAccount(account));
        },
      },
    ],
    [
      "/auth/change-password",
      {
        POST: (request, response, body) => {
          const account = accountFor(request);
          if (body.current_password !== account.password)
            throw new FixtureError(
              400,
              "The synthetic current password is invalid.",
            );
          account.password = password(body, "new_password");
          invalidate(account);
          return send(
            response,
            200,
            { updated: true },
            { "Set-Cookie": cookie("", true) },
          );
        },
      },
    ],
    [
      "/auth/forgot-password",
      {
        POST: (_request, response, body) => {
          const number = mobile(body);
          const account = accounts.get(number);
          if (!account)
            throw new FixtureError(
              400,
              "The synthetic account does not exist.",
            );
          const changed = password(body);
          verifyCode(`forgot_password:${number}`, body.otp);
          account.password = changed;
          invalidate(account);
          return send(
            response,
            200,
            { updated: true },
            { "Set-Cookie": cookie("", true) },
          );
        },
      },
    ],
    [
      "/auth/login",
      {
        POST: (_request, response, body) => {
          const identifier = text(body, "identifier", 254);
          const account =
            accounts.get(identifier) ??
            [...accounts.values()].find(
              (owner) =>
                owner.username === identifier || owner.email === identifier,
            );
          if (!account || account.password !== body.password)
            throw new FixtureError(
              401,
              "The synthetic credentials are invalid.",
            );
          return authenticate(response, account);
        },
      },
    ],
    [
      "/auth/logout",
      {
        POST: (request, response) => {
          accountFor(request);
          sessions.delete(tokenFor(request));
          return send(
            response,
            200,
            { signed_out: true },
            { "Set-Cookie": cookie("", true) },
          );
        },
      },
    ],
    [
      "/auth/otp-request",
      {
        POST: (_request, response, body) => {
          const number = mobile(body);
          if (!["forgot_password", "register"].includes(body.purpose))
            throw new FixtureError(
              400,
              "Unknown fixture verification purpose.",
            );
          if (body.purpose === "register" && accounts.has(number))
            throw new FixtureError(
              409,
              "The synthetic mobile is already registered.",
            );
          if (body.purpose === "forgot_password" && !accounts.has(number))
            throw new FixtureError(
              400,
              "The synthetic account does not exist.",
            );
          return send(response, 200, requestCode(`${body.purpose}:${number}`));
        },
      },
    ],
    [
      "/auth/register",
      {
        POST: (_request, response, body) => {
          const number = mobile(body);
          if (accounts.has(number))
            throw new FixtureError(
              409,
              "The synthetic mobile is already registered.",
            );
          if ([...accounts.values()].some((owner) => owner.username === number))
            throw new FixtureError(
              409,
              "The synthetic mobile is already used as a username.",
            );
          const account = {
            administrator: false,
            first_name: text(body, "first_name"),
            id: randomUUID(),
            last_name: text(body, "last_name"),
            mobile: number,
            password: password(body),
          };
          verifyCode(`register:${number}`, body.otp);
          accounts.set(number, account);
          return authenticate(response, account, 201);
        },
      },
    ],
    [
      "/health",
      { GET: (_request, response) => send(response, 200, { status: "ok" }) },
    ],
    [
      "/settings",
      {
        GET: (_request, response) => send(response, 200, settings()),
        PUT: (request, response, body) => {
          if (!accountFor(request).administrator)
            throw new FixtureError(
              403,
              "Only the synthetic administrator can change fixture settings.",
            );
          if (!languages.has(body.language_code))
            throw new FixtureError(400, "Unknown fixture language.");
          language = body.language_code;
          return send(response, 200, settings());
        },
      },
    ],
  ]);

  const handle = async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const methods = handlers.get(pathname);
    if (!methods) throw new FixtureError(404, "Unknown website fixture route.");
    if (!Object.hasOwn(methods, request.method)) {
      send(
        response,
        405,
        { message: "The fixture method is not allowed." },
        { Allow: Object.keys(methods).join(", ") },
      );
      return;
    }
    if (request.method !== "GET" && request.headers.origin !== config.website)
      throw new FixtureError(
        403,
        "The fixture mutation requires its explicit website origin.",
      );
    const body = request.method === "GET" ? undefined : await readJson(request);
    return methods[request.method](request, response, body);
  };
  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      send(response, error instanceof FixtureError ? error.status : 500, {
        cause: error instanceof FixtureError ? error.fields : {},
        message:
          error instanceof FixtureError
            ? error.message
            : "The synthetic fixture request failed.",
      });
    });
  });
  server.headersTimeout = 5_000;
  server.requestTimeout = 5_000;
  return server;
}

/** Listen only on the fixed interface admitted by the test-only mode. */
export async function startWebsiteApiFixture(environment = process.env) {
  const config = configuration(environment);
  const server = createWebsiteApiFixture(environment);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return server;
}

if (import.meta.main) {
  try {
    const server = await startWebsiteApiFixture();
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      server.close(() => {
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", stop);
      });
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    console.log("Owned website HTTP test fixture is listening.");
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Website fixture startup failed.",
    );
    process.exitCode = 1;
  }
}
