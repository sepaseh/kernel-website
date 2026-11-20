import "server-only";

import sanitizeHtml from "sanitize-html";

import { isFileId, mediaPath } from "./paths";

const classes = [
  "ql-align-center",
  "ql-align-right",
  "ql-align-justify",
  "ql-direction-rtl",
  "ql-size-small",
  "ql-size-large",
  "ql-size-huge",
  "ql-syntax",
  "ql-code-block",
  "ql-code-block-container",
  ...Array.from({ length: 8 }, (_, index) => `ql-indent-${index + 1}`),
];
const directionBlocks = new Set([
  "blockquote",
  "div",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "ul",
]);
export function sanitizeArticleHtml(body: string) {
  return sanitizeHtml(body, {
    allowedTags: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "div",
      "em",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "sub",
      "sup",
      "u",
      "ul",
    ],
    allowedAttributes: {
      "*": ["class", "dir"],
      a: ["href", "title", "rel"],
      img: [
        "src",
        "alt",
        "width",
        "height",
        "loading",
        "decoding",
        "data-file-id",
      ],
      li: ["data-list"],
    },
    allowedClasses: { "*": classes },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "iframe",
      "object",
      "svg",
      "math",
      "template",
    ],
    transformTags: {
      "*": (tagName, attribs) => {
        if (!directionBlocks.has(tagName)) return { tagName, attribs };
        const dir = attribs.class?.split(/\s+/).includes("ql-direction-rtl")
          ? "rtl"
          : ["auto", "ltr", "rtl"].includes(attribs.dir ?? "")
            ? attribs.dir
            : "auto";
        return { tagName, attribs: { ...attribs, dir } };
      },
      h1: "h2",
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer" },
      }),
      img: (tagName, attribs) => {
        const id = attribs["data-file-id"];
        if (!id || !isFileId(id)) return { tagName: "span", attribs: {} };
        const dimensions: Record<string, string> = {};
        for (const key of ["width", "height"])
          if (/^[1-9]\d{0,4}$/.test(attribs[key] ?? ""))
            dimensions[key] = attribs[key];
        return {
          tagName,
          attribs: {
            "data-file-id": id,
            src: mediaPath(id),
            alt: attribs.alt ?? "",
            loading: "lazy",
            decoding: "async",
            ...dimensions,
          },
        };
      },
    },
  });
}
