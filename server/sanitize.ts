import { FilterXSS, IFilterXSSOptions } from "xss";

// Strict sanitizer for user-generated text (project names, track names, tags, notes)
const strictOptions: IFilterXSSOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
};
const strictFilter = new FilterXSS(strictOptions);

// Relaxed sanitizer for rich content (review display, markdown-rendered content)
const relaxedOptions: IFilterXSSOptions = {
  whiteList: {
    b: [],
    i: [],
    em: [],
    strong: [],
    br: [],
    p: [],
    ul: [],
    ol: [],
    li: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    blockquote: [],
    code: [],
    pre: [],
    a: ["href", "title", "target"],
    span: ["class"],
    div: ["class"],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
  onTagAttr(tag: string, name: string, value: string) {
    // Only allow safe href values (no javascript: protocol)
    if (tag === "a" && name === "href") {
      if (/^javascript:/i.test(value.trim())) {
        return "";
      }
    }
    return undefined as unknown as string; // use default behavior
  },
};
const relaxedFilter = new FilterXSS(relaxedOptions);

/**
 * Sanitize plain text input (names, tags, notes, etc.)
 * Strips ALL HTML tags.
 */
export function sanitizeText(input: string): string {
  if (!input) return input;
  return strictFilter.process(input).trim();
}

/**
 * Sanitize rich content that may contain safe HTML (reviews, markdown output)
 * Allows a limited set of formatting tags.
 */
export function sanitizeRichContent(input: string): string {
  if (!input) return input;
  return relaxedFilter.process(input);
}

/**
 * Sanitize a URL to prevent XSS via javascript: protocol
 */
export function sanitizeUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed)) return "";
  if (/^data:/i.test(trimmed) && !/^data:image\//i.test(trimmed)) return "";
  return trimmed;
}

/**
 * Validate and sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return email;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return "";
  return trimmed;
}
