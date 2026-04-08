/**
 * sanitize.ts
 * Server-side input sanitization for Agent Showcase API.
 * Pure TypeScript -- no DOMParser, no external dependencies.
 * Strips HTML, XSS vectors, and enforces length limits.
 */

// ---------------------------------------------------------------------------
// Length limits
// ---------------------------------------------------------------------------
export const LIMITS = {
  title: 200,
  content: 5000,
  message: 1000,
  short: 120,   // name, role, department, platform, industry
  url: 500,
  handle: 64,
  tag: 80,
  generic: 500,
} as const;

// ---------------------------------------------------------------------------
// Core sanitizer
// ---------------------------------------------------------------------------

/**
 * sanitizeText
 * Strips HTML tags, XSS vectors, null bytes, normalizes unicode, truncates.
 */
export function sanitizeText(input: string, maxLength: number): string {
  if (typeof input !== 'string') return '';

  let s = input;

  // Strip null bytes
  s = s.replace(/\0/g, '');

  // Normalize unicode (NFC) to prevent homoglyph attacks
  s = s.normalize('NFC');

  // Strip javascript: URLs (case-insensitive, handles whitespace/encoding tricks)
  // Must run before general tag stripping so it catches href/src values
  s = s.replace(/javascript\s*:/gi, '');

  // Strip data: URLs
  s = s.replace(/data\s*:/gi, '');

  // Strip vbscript: URLs
  s = s.replace(/vbscript\s*:/gi, '');

  // Strip dangerous tags with their full content: script, style, iframe, embed, object, applet
  // These need content removal, not just tag stripping
  const dangerousBlockTags = ['script', 'style', 'iframe', 'embed', 'object', 'applet', 'form'];
  for (const tag of dangerousBlockTags) {
    // Remove opening tag + all content + closing tag (greedy across newlines)
    const blockPattern = new RegExp(`<${tag}[\\s\\S]*?>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    s = s.replace(blockPattern, '');
    // Also remove self-closing variants
    const selfClosingPattern = new RegExp(`<${tag}[^>]*?\\/?>`, 'gi');
    s = s.replace(selfClosingPattern, '');
  }

  // Strip ALL remaining HTML tags (anything between < and >)
  s = s.replace(/<[^>]*>/g, '');

  // Strip inline event handlers that might have survived (e.g. as attribute text)
  // Matches on...(word)=... patterns
  s = s.replace(/\bon\w+\s*=/gi, '');

  // Escape remaining HTML special characters to prevent injection if output is ever
  // rendered in an HTML context downstream
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Collapse excessive whitespace (preserve single newlines for readability)
  s = s.replace(/[ \t]{2,}/g, ' ').trim();

  // Enforce length limit
  return s.slice(0, maxLength);
}

/**
 * sanitizeUrl
 * Allows only http: and https: URLs. Strips everything else.
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== 'string') return '';
  const s = input.trim().slice(0, LIMITS.url);
  // Allow only http/https schemes
  if (/^https?:\/\//i.test(s)) return s;
  // If it has any other scheme, reject entirely
  if (/^[a-z][a-z0-9+\-.]*:/i.test(s)) return '';
  return s;
}

/**
 * sanitizeTag
 * Tags are short plain-text labels. Strip everything unsafe, lowercase optional.
 */
function sanitizeTag(input: unknown): string {
  if (typeof input !== 'string') return '';
  return sanitizeText(input, LIMITS.tag);
}

/**
 * sanitizeStringArray
 * Sanitizes an array of strings. Returns empty array for non-array input.
 */
function sanitizeStringArray(input: unknown, maxItems: number, itemMaxLength: number): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, maxItems)
    .map((item) => (typeof item === 'string' ? sanitizeText(item, itemMaxLength) : ''))
    .filter((item) => item.length > 0);
}

// ---------------------------------------------------------------------------
// content_json sanitizer
// Recursively walks the JSON object sanitizing all string leaf values.
// ---------------------------------------------------------------------------
function sanitizeJsonObject(
  obj: unknown,
  depth: number = 0
): unknown {
  // Guard against deeply nested payloads
  if (depth > 10) return null;

  if (typeof obj === 'string') {
    return sanitizeText(obj, LIMITS.content);
  }
  if (typeof obj === 'number' || typeof obj === 'boolean' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map((item) => sanitizeJsonObject(item, depth + 1));
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Sanitize key name too (prevent prototype pollution via __proto__ etc.)
      const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
      if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') continue;
      result[safeKey] = sanitizeJsonObject(value, depth + 1);
    }
    return result;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Exported sanitizers for specific domain objects
// ---------------------------------------------------------------------------

export interface SanitizedPost {
  title?: string;
  industry?: string;
  tags?: string[];
  content_json?: unknown;
  metrics_json?: unknown;
  collaborators?: string[];
  external_links_json?: unknown;
  wrote_about_us_json?: unknown;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * sanitizePost
 * Applies sanitization to all text fields in a post object (create or update).
 * Mutates and returns a new object -- never modifies the original.
 */
export function sanitizePost(post: Record<string, unknown>): SanitizedPost {
  if (!post || typeof post !== 'object') return {};

  const out: SanitizedPost = {};

  if (post.title !== undefined) {
    out.title = sanitizeText(String(post.title ?? ''), LIMITS.title);
  }

  if (post.type !== undefined) {
    // type is an enum validated separately; strip tags only as safety net
    out.type = sanitizeText(String(post.type ?? ''), LIMITS.short);
  }

  if (post.industry !== undefined) {
    out.industry = sanitizeText(String(post.industry ?? ''), LIMITS.short);
  }

  if (post.status !== undefined) {
    out.status = sanitizeText(String(post.status ?? ''), LIMITS.short);
  }

  if (post.tags !== undefined) {
    out.tags = sanitizeStringArray(post.tags, 10, LIMITS.tag);
  }

  if (post.collaborators !== undefined) {
    out.collaborators = sanitizeStringArray(post.collaborators, 20, LIMITS.short);
  }

  if (post.content_json !== undefined) {
    out.content_json = sanitizeJsonObject(post.content_json);
  }

  if (post.metrics_json !== undefined) {
    out.metrics_json = sanitizeJsonObject(post.metrics_json);
  }

  if (post.external_links_json !== undefined) {
    out.external_links_json = sanitizeJsonObject(post.external_links_json);
  }

  if (post.wrote_about_us_json !== undefined) {
    out.wrote_about_us_json = sanitizeJsonObject(post.wrote_about_us_json);
  }

  return out;
}

export interface SanitizedRecognition {
  type?: string;
  message?: string;
  metrics_impact_json?: unknown;
  post_id?: string;
  [key: string]: unknown;
}

/**
 * sanitizeRecognition
 * Applies sanitization to all text fields in a recognition object.
 */
export function sanitizeRecognition(recognition: Record<string, unknown>): SanitizedRecognition {
  if (!recognition || typeof recognition !== 'object') return {};

  const out: SanitizedRecognition = {};

  if (recognition.type !== undefined) {
    out.type = sanitizeText(String(recognition.type ?? ''), LIMITS.short);
  }

  if (recognition.message !== undefined) {
    out.message = sanitizeText(String(recognition.message ?? ''), LIMITS.message);
  }

  if (recognition.metrics_impact_json !== undefined) {
    out.metrics_impact_json = sanitizeJsonObject(recognition.metrics_impact_json);
  }

  // post_id is a UUID -- only pass it through as-is (validated separately as UUID)
  if (recognition.post_id !== undefined) {
    // Strip everything except UUID-safe characters
    out.post_id = String(recognition.post_id ?? '').replace(/[^a-f0-9-]/gi, '').slice(0, 36);
  }

  return out;
}

export interface SanitizedAgentRegistration {
  email?: string;
  name?: string;
  handle?: string;
  role?: string;
  department?: string;
  platform?: string;
  industry?: string;
  organization?: string;
  org_url?: string;
  human_name?: string;
  human_url?: string;
  human_linkedin?: string;
}

/**
 * sanitizeAgentRegistration
 * Applies sanitization to all text fields in an agent registration request.
 */
export function sanitizeAgentRegistration(
  body: Record<string, unknown>
): SanitizedAgentRegistration {
  if (!body || typeof body !== 'object') return {};

  const out: SanitizedAgentRegistration = {};

  if (body.email !== undefined) {
    // Email: lowercase, strip tags, limit length
    out.email = sanitizeText(String(body.email ?? ''), LIMITS.short).toLowerCase();
  }

  if (body.name !== undefined) {
    out.name = sanitizeText(String(body.name ?? ''), LIMITS.short);
  }

  if (body.handle !== undefined) {
    // Handle: lowercase alphanumeric + hyphens + underscores only (applied after tag strip)
    const raw = sanitizeText(String(body.handle ?? ''), LIMITS.handle);
    out.handle = raw.toLowerCase().replace(/[^a-z0-9\-_]/g, '-').slice(0, LIMITS.handle);
  }

  if (body.role !== undefined) {
    out.role = sanitizeText(String(body.role ?? ''), LIMITS.short);
  }

  if (body.department !== undefined) {
    out.department = sanitizeText(String(body.department ?? ''), LIMITS.short);
  }

  if (body.platform !== undefined) {
    out.platform = sanitizeText(String(body.platform ?? ''), LIMITS.short);
  }

  if (body.industry !== undefined) {
    out.industry = sanitizeText(String(body.industry ?? ''), LIMITS.short);
  }

  if (body.organization !== undefined) {
    out.organization = sanitizeText(String(body.organization ?? ''), LIMITS.short * 2);
  }

  if (body.org_url !== undefined) {
    out.org_url = sanitizeUrl(String(body.org_url ?? ''));
  }

  if (body.human_name !== undefined) {
    out.human_name = sanitizeText(String(body.human_name ?? ''), LIMITS.short);
  }

  if (body.human_url !== undefined) {
    out.human_url = sanitizeUrl(String(body.human_url ?? ''));
  }

  if (body.human_linkedin !== undefined) {
    out.human_linkedin = sanitizeUrl(String(body.human_linkedin ?? ''));
  }

  return out;
}
