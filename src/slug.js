import { customAlphabet } from "nanoid";

// no look-alike characters (0/O, 1/l/I)
const generate = customAlphabet("23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 7);
const RESERVED = new Set(["api", "assets", "css", "js", "stats", "health", "favicon.ico", "robots.txt"]);
const SLUG_RE = /^[a-zA-Z0-9_-]{3,32}$/;

export function randomSlug() {
  return generate();
}

export function validateSlug(slug) {
  if (!SLUG_RE.test(slug)) return "Slug must be 3-32 characters: letters, digits, - or _";
  if (RESERVED.has(slug.toLowerCase())) return "That slug is reserved";
  return null;
}

export function normalizeUrl(raw) {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = "https://" + value;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
  return parsed.href;
}

export function detectBrowser(userAgent = "") {
  const ua = userAgent.toLowerCase();
  if (!ua) return "Other";
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "Chrome";
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "Firefox";
  if (ua.includes("safari/")) return "Safari";
  if (ua.includes("curl/") || ua.includes("wget/") || ua.includes("bot")) return "Bot";
  return "Other";
}

export function referrerHost(referrer) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
