import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ccf_admin_session";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type AdminSessionPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken(
  secret: string,
  now: () => Date = () => new Date()
): string {
  const issuedAt = now().getTime();
  const payload: AdminSessionPayload = {
    sub: "admin",
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_MS,
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(body, secret);

  return `${body}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  now: () => Date = () => new Date()
): AdminSessionPayload | null {
  if (!token || !secret) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [body, signature] = parts;

  if (!body || !signature || !safeEqual(signature, sign(body, secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as AdminSessionPayload;

    if (payload.sub !== "admin" || payload.exp <= now().getTime()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminPassword(
  submittedPassword: string,
  configuredPassword: string | undefined
): boolean {
  if (!configuredPassword) {
    return false;
  }

  return safeEqual(submittedPassword, configuredPassword);
}
