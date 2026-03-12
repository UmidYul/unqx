const net = require("node:net");

const { env } = require("../config/env");

const LOOPBACK_CIDRS = ["127.0.0.0/8", "::1/128"];

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripIpv6Brackets(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("[") && raw.includes("]")) {
    return raw.slice(1, raw.indexOf("]"));
  }
  return raw;
}

function stripPort(value) {
  const raw = stripIpv6Brackets(value);
  if (!raw) return "";

  if (raw.includes(":")) {
    const ipv6Check = net.isIP(raw);
    if (ipv6Check === 6) {
      return raw;
    }

    const parts = raw.split(":");
    if (parts.length === 2 && /^\d+$/.test(parts[1])) {
      return parts[0];
    }
  }

  return raw;
}

function normalizeIp(value) {
  const raw = stripPort(value).toLowerCase();
  if (!raw) return "";

  if (raw.startsWith("::ffff:")) {
    const v4 = raw.slice(7);
    return net.isIP(v4) ? v4 : "";
  }

  if (raw === "::1") {
    return "127.0.0.1";
  }

  return net.isIP(raw) ? raw : "";
}

function parseXForwardedFor(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeIp(item))
    .filter(Boolean);
}

function ipv4ToBigInt(ip) {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts.reduce((acc, part) => (acc << 8n) + BigInt(part), 0n);
}

function expandIpv6(ip) {
  if (!ip.includes("::")) {
    const parts = ip.split(":");
    if (parts.length !== 8) return null;
    return parts.map((part) => part.padStart(4, "0"));
  }

  const sides = ip.split("::");
  if (sides.length !== 2) return null;
  const left = sides[0] ? sides[0].split(":") : [];
  const right = sides[1] ? sides[1].split(":") : [];
  if (left.length + right.length > 8) return null;

  const missing = new Array(8 - left.length - right.length).fill("0");
  const joined = [...left, ...missing, ...right].map((part) => (part || "0").padStart(4, "0"));
  return joined.length === 8 ? joined : null;
}

function ipv6ToBigInt(ip) {
  const parts = expandIpv6(ip);
  if (!parts) return null;
  try {
    return parts.reduce((acc, part) => (acc << 16n) + BigInt(parseInt(part, 16)), 0n);
  } catch {
    return null;
  }
}

function parseCidr(value) {
  const raw = String(value || "").trim();
  if (!raw.includes("/")) {
    const ip = normalizeIp(raw);
    if (!ip) return null;
    return { ip, prefix: net.isIP(ip) === 4 ? 32 : 128 };
  }

  const [ipRaw, prefixRaw] = raw.split("/");
  const ip = normalizeIp(ipRaw);
  if (!ip) return null;
  const version = net.isIP(ip);
  const maxBits = version === 4 ? 32 : 128;
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) return null;
  return { ip, prefix };
}

function matchesCidr(ip, cidr) {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;
  const version = net.isIP(parsed.ip);
  if (version !== net.isIP(ip)) return false;

  if (version === 4) {
    const ipValue = ipv4ToBigInt(ip);
    const cidrValue = ipv4ToBigInt(parsed.ip);
    if (ipValue === null || cidrValue === null) return false;
    const hostBits = 32n - BigInt(parsed.prefix);
    const mask = hostBits === 0n ? 0xffffffffn : ((1n << 32n) - 1n) ^ ((1n << hostBits) - 1n);
    return (ipValue & mask) === (cidrValue & mask);
  }

  const ipValue = ipv6ToBigInt(ip);
  const cidrValue = ipv6ToBigInt(parsed.ip);
  if (ipValue === null || cidrValue === null) return false;
  const hostBits = 128n - BigInt(parsed.prefix);
  const mask = hostBits === 0n ? ((1n << 128n) - 1n) : ((1n << 128n) - 1n) ^ ((1n << hostBits) - 1n);
  return (ipValue & mask) === (cidrValue & mask);
}

const TRUSTED_PROXY_IPS = new Set(parseCsv(env.TRUSTED_PROXY_IPS).map((item) => normalizeIp(item)).filter(Boolean));
const TRUSTED_PROXY_CIDRS = [...LOOPBACK_CIDRS, ...parseCsv(env.TRUSTED_PROXY_CIDRS)];

function isTrustedProxy(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  if (TRUSTED_PROXY_IPS.has(normalized)) return true;
  return TRUSTED_PROXY_CIDRS.some((cidr) => matchesCidr(normalized, cidr));
}

function resolveClientIp(req) {
  const remoteIp = normalizeIp(req?.socket?.remoteAddress || req?.connection?.remoteAddress || req?.ip || "");
  const remoteTrusted = isTrustedProxy(remoteIp);

  if (remoteTrusted) {
    const cloudflareIp = normalizeIp(req.get("cf-connecting-ip"));
    if (cloudflareIp) {
      return cloudflareIp;
    }

    const forwarded = parseXForwardedFor(req.get("x-forwarded-for"));
    if (forwarded.length) {
      for (const candidate of forwarded) {
        if (!isTrustedProxy(candidate)) {
          return candidate;
        }
      }
      return forwarded[0];
    }

    const realIp = normalizeIp(req.get("x-real-ip"));
    if (realIp) {
      return realIp;
    }
  }

  return remoteIp || "";
}

function buildViewerFingerprint(req, ip) {
  const safeIp = normalizeIp(ip);
  const userAgent = String(req.get("user-agent") || "").trim().slice(0, 400);
  const acceptLanguage = String(req.get("accept-language") || "").trim().slice(0, 120);
  if (!safeIp || !userAgent && !acceptLanguage) {
    return "";
  }
  return `${safeIp}|${userAgent}|${acceptLanguage}`;
}

module.exports = {
  normalizeIp,
  resolveClientIp,
  buildViewerFingerprint,
  isTrustedProxy,
};
