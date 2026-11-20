"use client";

import {
  globalErrorHeading as englishHeading,
  globalErrorText as englishText,
  globalErrorTitle as englishTitle,
  reload as englishReload,
} from "@/i18n/catalog-data/locales/en.json";
import {
  globalErrorHeading as persianHeading,
  globalErrorText as persianText,
  reload as persianReload,
} from "@/i18n/catalog-data/locales/fa.json";

// The root layout may fail before the configured language/provider is available.
// This bilingual error document never presents a guessed application language.
export default function GlobalError() {
  return (
    <html lang="en" dir="ltr">
      <head>
        <title>{englishTitle}</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        style={{
          margin: 0,
          background: "#131510",
          color: "#f1f2e9",
          fontFamily: "Arial, sans-serif",
          lineHeight: 1.7,
        }}
      >
        <main style={{ maxWidth: 640, margin: "12vh auto", padding: 24 }}>
          <h1>{englishHeading}</h1>
          <p>{englishText}</p>
          <section lang="fa" dir="rtl" style={{ marginBlock: 32 }}>
            <h2>{persianHeading}</h2>
            <p>{persianText}</p>
          </section>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              cursor: "pointer",
              padding: "12px 20px",
              border: "2px solid #d4e7ae",
              borderRadius: 8,
              background: "#d4e7ae",
              color: "#1b2514",
              font: "inherit",
            }}
          >
            {englishReload} /{" "}
            <span lang="fa" dir="rtl">
              {persianReload}
            </span>
          </button>
        </main>
      </body>
    </html>
  );
}
