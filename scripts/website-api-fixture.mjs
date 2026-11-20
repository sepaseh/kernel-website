// Test-only HTTP behavior for this website. This is not an authentication service.
import { createHash, randomUUID } from "node:crypto";
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
  constructor(status, message, fields = {}, headers = {}) {
    super(message);
    this.fields = fields;
    this.status = status;
    this.headers = headers;
  }
}

/** Admit only explicit synthetic inputs; container mode changes both binding and the allowed origin. */
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

/** Normalize fixture text fields while preserving field-keyed validation failures for form tests. */
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

/** Validate length without trimming: credential tests depend on exact whitespace preservation. */
function password(body, field = "password") {
  const value = body[field];
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw new FixtureError(400, "Invalid synthetic fixture password.", {
      [field]: "Use 8–128 characters.",
    });
  return value;
}

/** Keep synthetic account keys in the same canonical mobile form used by login and OTP lookup. */
function mobile(body) {
  const value = text(body, "mobile", 11);
  if (!/^09\d{9}$/.test(value))
    throw new FixtureError(400, "Invalid synthetic fixture mobile.", {
      mobile: "Enter an 11-digit mobile beginning with 09.",
    });
  return value;
}

/** Model the fixture's deliberately limited email shape, not full mailbox deliverability validation. */
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

/** Drain the request while retaining at most 32 KiB, then reject oversized or non-object JSON. */
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

/** Expose only the account projection needed by the website, leaving fixture passwords private. */
function publicAccount(account) {
  return {
    email: account.email,
    first_name: account.first_name,
    id: account.id,
    is_system_admin: account.administrator,
    last_name: account.last_name,
    mobile: account.mobile,
    permissions: account.administrator
      ? [
          "settings.update",
          "faqs.create",
          "faqs.delete",
          "faqs.read",
          "faqs.update",
        ]
      : [],
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

  /** Derive locale metadata from this responder's state so separate fixture instances stay isolated. */
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
  /** Mirror browser cookie attributes for the declared origin; expiry removes only this fixture cookie. */
  const cookie = (value, expired = false) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax${config.website.startsWith("https:") ? "; Secure" : ""}${expired ? "; Max-Age=0" : ""}`;
  /** An explicit Authorization header takes precedence, even when invalid; never fall back to a cookie. */
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
  /** Resolve sessions only within this responder, preserving the protected-route 401 contract. */
  const accountFor = (request) => {
    const account = sessions.get(tokenFor(request));
    if (!account)
      throw new FixtureError(
        401,
        "The synthetic session is not authenticated.",
      );
    return account;
  };
  /** Password changes revoke every session owned by this exact in-memory account object. */
  const invalidate = (account) => {
    for (const [token, owner] of sessions)
      if (owner === account) sessions.delete(token);
  };
  /** Mark synthetic JSON responses explicitly and disable storage of account/session responses. */
  const send = (response, status, value, headers = {}) => {
    response.writeHead(status, {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Website-Test-Fixture": "1",
      ...headers,
    });
    response.end(JSON.stringify(value));
  };
  /** Issue an instance-owned session plus deliberate token fields for proxy-redaction tests. */
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
  /** Replace the current expiry for a purpose/account/destination key; no real delivery occurs. */
  const requestCode = (key) => {
    codes.set(key, Date.now() + 300_000);
    return { expires_in: 300, remaining_seconds: 60 };
  };
  /** Consume a destination-bound code only after a successful match against its unexpired request. */
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

  const category = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Field notes",
    description: "Practical ideas for building thoughtfully.",
    created_at: "2026-11-01T09:00:00.000Z",
    updated_at: "2026-11-01T09:00:00.000Z",
  };
  const posts = new Map(
    Array.from({ length: 13 }, (_, index) => {
      const id = 48629173 + index;
      const title =
        index === 0
          ? "Building with clear boundaries"
          : `A practical guide ${index + 1}`;
      const published = {
        id,
        title,
        url_title:
          index === 0
            ? "building-with-clear-boundaries"
            : `practical-guide-${index + 1}`,
        excerpt: "Useful ideas, with room for your own direction.",
        body: "<h2>A practical beginning</h2><p>Public articles arrive as server-rendered HTML.</p><p>این نوشته برای خواندن روشن و ساده آماده شده است.</p>",
        category,
        tags: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Foundations",
            created_at: category.created_at,
            updated_at: category.updated_at,
          },
        ],
        published_at: category.created_at,
        public_updated_at: category.updated_at,
      };
      return [
        id,
        {
          published,
          working: {
            ...published,
            title: "Saved working title",
            url_title: "saved-working-title",
            body: "<p>Private saved working content.</p>",
          },
        },
      ];
    }),
  );
  posts.set(87654321, {
    working: {
      id: 87654321,
      title: "A private draft",
      url_title: "a-private-draft",
      excerpt: "Not published.",
      body: "<p>Private saved working content.</p>",
      tags: [],
    },
  });
  const faqs = new Map(
    Array.from({ length: 22 }, (_, index) => {
      const id = `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`;
      return [
        id,
        {
          id,
          question:
            index === 21
              ? "Inactive fixture question"
              : index === 0
                ? "How do I get started?"
                : index === 1
                  ? "از کجا شروع کنم؟"
                  : `Practical question ${index + 1}`,
          answer:
            index === 0
              ? "Begin with the essentials and take the next step.\n\n<script>Plain text stays plain.</script>\n\nپاسخ روشن و ساده از همین‌جا آغاز می‌شود."
              : "Explore the starter and adapt each part to your project.\nKeep your changes focused and easy to review.",
          sort: Math.floor(index / 2),
          is_active: index < 21,
        },
      ];
    }),
  );
  const faqHandler = (pathname) => {
    const id = /^\/faqs\/([\da-f-]+)$/.exec(pathname)?.[1];
    if (!id) return undefined;
    return {
      PATCH: (request, response, body) => {
        if (!accountFor(request).administrator)
          throw new FixtureError(
            403,
            "FAQ editing requires the fixture administrator.",
          );
        const current = faqs.get(id);
        if (!current) throw new FixtureError(404, "Unknown fixture FAQ.");
        const keys = Object.keys(body);
        if (
          !keys.length ||
          keys.some(
            (key) => !["question", "answer", "sort", "is_active"].includes(key),
          )
        )
          throw new FixtureError(400, "Invalid FAQ patch.");
        const next = { ...current };
        if (Object.hasOwn(body, "question"))
          next.question = text(body, "question", 300);
        if (Object.hasOwn(body, "answer"))
          next.answer = text(body, "answer", 5000);
        if (Object.hasOwn(body, "sort")) {
          if (
            !Number.isSafeInteger(body.sort) ||
            body.sort < 0 ||
            body.sort > 1_000_000
          )
            throw new FixtureError(400, "Invalid FAQ order.");
          next.sort = body.sort;
        }
        if (Object.hasOwn(body, "is_active")) {
          if (typeof body.is_active !== "boolean")
            throw new FixtureError(400, "Invalid FAQ visibility.");
          next.is_active = body.is_active;
        }
        faqs.set(id, next);
        return send(response, 200, { id });
      },
    };
  };
  const capabilities = new Map();
  const publishedPosts = () =>
    [...posts.values()].flatMap((post) =>
      post.published ? [post.published] : [],
    );
  const slicePosts = (request, maximum = 100) => {
    const query = new URL(request.url, "http://127.0.0.1").searchParams;
    const offset = Number(query.get("offset") ?? 0);
    const size = Number(query.get("size") ?? 12);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > maximum
    )
      throw new FixtureError(400, "Invalid fixture pagination.");
    const items = publishedPosts().filter(
      (post) =>
        !query.has("category_id") ||
        post.category?.id === query.get("category_id"),
    );
    return { items: items.slice(offset, offset + size), total: items.length };
  };
  const blogHandler = (pathname) => {
    const detail = /^\/public\/posts\/([1-9]\d{7})(\/preview)?$/.exec(pathname);
    if (detail)
      return {
        GET: (request, response) => {
          const value = posts.get(Number(detail[1]));
          if (detail[2]) {
            const capability = capabilities.get(tokenFor(request));
            if (
              !capability ||
              capability.id !== Number(detail[1]) ||
              capability.expires <= Date.now() ||
              !sessions.has(capability.session)
            )
              throw new FixtureError(
                401,
                "The fixture preview is unavailable.",
              );
            return send(response, 200, value.working);
          }
          if (!value?.published)
            throw new FixtureError(404, "Article not found.");
          return send(response, 200, value.published);
        },
      };
    const operation =
      /^\/posts\/([1-9]\d{7})\/(preview-token|publish|unpublish)$/.exec(
        pathname,
      );
    if (operation)
      return {
        POST: (request, response) => {
          if (!accountFor(request).administrator)
            throw new FixtureError(
              403,
              "The fixture action requires an administrator.",
            );
          const id = Number(operation[1]);
          const post = posts.get(id);
          if (!post) throw new FixtureError(404, "Article not found.");
          if (operation[2] === "preview-token") {
            const token = `fixture_preview_${randomUUID()}`;
            const expires = Date.now() + 300_000;
            capabilities.set(token, {
              id,
              expires,
              session: tokenFor(request),
            });
            return send(response, 200, {
              token,
              expires_at: new Date(expires).toISOString(),
            });
          }
          if (operation[2] === "publish")
            post.published = {
              ...post.working,
              published_at: new Date().toISOString(),
              public_updated_at: new Date().toISOString(),
            };
          else delete post.published;
          return send(response, 200, { updated: true });
        },
      };
    if (pathname.startsWith("/public/categories/"))
      return {
        GET: (_request, response) => {
          if (pathname !== `/public/categories/${category.id}`)
            throw new FixtureError(404, "Category not found.");
          return send(response, 200, category);
        },
      };
    return undefined;
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

  handlers.set("/public/posts", {
    GET: (request, response) => {
      const result = slicePosts(request);
      return send(response, 200, {
        ...result,
        items: result.items.map((post) => {
          const item = { ...post };
          delete item.body;
          return item;
        }),
      });
    },
  });
  handlers.set("/public/posts/sitemap", {
    GET: (request, response) => {
      const result = slicePosts(request, 1000);
      return send(response, 200, {
        ...result,
        items: result.items.map(({ id, url_title, public_updated_at }) => ({
          id,
          url_title,
          public_updated_at,
        })),
      });
    },
  });
  handlers.set("/public/categories", {
    GET: (_request, response) =>
      send(response, 200, { items: [category], total: 1 }),
  });
  const contactReceipts = new Map();
  const contactMessages = [];
  const contactQuotas = new Map();
  let contactPeer = { count: 0, expires: 0 };
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  handlers.set("/public/contact-messages", {
    POST: (request, response, body) => {
      const key = request.headers["idempotency-key"];
      if (
        typeof key !== "string" ||
        !/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
          key,
        )
      )
        throw new FixtureError(400, "A UUID submission key is required.");
      if (
        Object.keys(body).some(
          (key) => !["name", "mobile", "description"].includes(key),
        )
      )
        throw new FixtureError(
          400,
          "Only name, mobile and description are accepted.",
        );
      const name = text(body, "name", 120);
      const description = text(body, "description", 5000);
      let number = text(body, "mobile", 32)
        .replace(/[۰-۹]/g, (digit) => String(digit.codePointAt(0) - 1776))
        .replace(/[٠-٩]/g, (digit) => String(digit.codePointAt(0) - 1632));
      if (number.startsWith("09")) number = `+98${number.slice(1)}`;
      if (!/^\+989\d{9}$/.test(number))
        throw new FixtureError(400, "Invalid mobile.", {
          mobile: "Enter a valid Iranian mobile number.",
        });
      const stamp = Date.now();
      const keyDigest = digest(key.toLowerCase());
      const signature = digest(
        JSON.stringify({ name, mobile: number, description }),
      );
      for (const [key, value] of contactReceipts)
        if (value.expires <= stamp) contactReceipts.delete(key);
      for (const [key, value] of contactQuotas)
        if (value.expires <= stamp) contactQuotas.delete(key);
      const previous = contactReceipts.get(keyDigest);
      if (previous) {
        if (previous.signature !== signature)
          throw new FixtureError(
            409,
            "This submission key belongs to different content.",
          );
        return send(response, 201, previous.receipt);
      }
      const mobileDigest = digest(number);
      const existing = contactQuotas.get(mobileDigest);
      const quota =
        existing?.expires > stamp
          ? existing
          : { count: 0, expires: stamp + 600_000 };
      if (contactPeer.expires <= stamp)
        contactPeer = { count: 0, expires: stamp + 600_000 };
      const limited =
        quota.count >= 5
          ? quota
          : contactPeer.count >= 100
            ? contactPeer
            : undefined;
      if (limited)
        throw new FixtureError(
          429,
          "Too many contact messages.",
          {},
          {
            "Retry-After": String(
              Math.max(1, Math.ceil((limited.expires - stamp) / 1000)),
            ),
          },
        );
      const receipt = {
        id: randomUUID(),
        created_at: new Date(stamp).toISOString(),
      };
      contactMessages.push({
        ...receipt,
        name,
        mobile: number,
        description,
        is_read: false,
      });
      quota.count++;
      contactPeer.count++;
      contactQuotas.set(mobileDigest, quota);
      contactReceipts.set(keyDigest, {
        signature,
        receipt,
        expires: stamp + 86_400_000,
      });
      return send(response, 201, receipt);
    },
  });
  handlers.set("/contact-messages", {
    GET: (request, response) => {
      if (!accountFor(request).administrator)
        throw new FixtureError(
          403,
          "The fixture inbox requires its administrator.",
        );
      return send(response, 200, {
        items: [...contactMessages].reverse(),
        total: contactMessages.length,
      });
    },
  });
  handlers.set("/public/faqs", {
    GET: (request, response) => {
      const query = new URL(request.url, "http://127.0.0.1").searchParams;
      if (
        [...query.keys()].some(
          (key) =>
            !["offset", "size"].includes(key) || query.getAll(key).length !== 1,
        )
      )
        throw new FixtureError(400, "Unknown FAQ query.");
      const rawOffset = query.get("offset") ?? "0";
      const rawSize = query.get("size") ?? "20";
      const offset = Number(rawOffset),
        size = Number(rawSize);
      if (
        !/^\d+$/.test(rawOffset) ||
        !/^\d+$/.test(rawSize) ||
        !Number.isSafeInteger(offset) ||
        offset > 10_000_000 ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 100
      )
        throw new FixtureError(400, "Invalid FAQ pagination.");
      const active = [...faqs.values()]
        .filter((item) => item.is_active)
        .sort(
          (left, right) =>
            left.sort - right.sort ||
            (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
        );
      return send(response, 200, {
        items: active
          .slice(offset, offset + size)
          .map(({ id, question, answer, sort }) => ({
            id,
            question,
            answer,
            sort,
          })),
        total: active.length,
      });
    },
  });
  /** Dispatch only owned routes/methods and require the exact configured website origin for mutations. */
  const handle = async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const methods =
      handlers.get(pathname) ?? blogHandler(pathname) ?? faqHandler(pathname);
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
      send(
        response,
        error instanceof FixtureError ? error.status : 500,
        {
          cause: error instanceof FixtureError ? error.fields : {},
          message:
            error instanceof FixtureError
              ? error.message
              : "The synthetic fixture request failed.",
        },
        error instanceof FixtureError ? error.headers : {},
      );
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
    /** Close this listener once; the fixture owns no external services or persistent account state. */
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
