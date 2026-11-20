import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { apsConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export const APS_API = "https://developer.api.autodesk.com";
export const APS_COOKIE = "mihwar_aps_session";
export const APS_OAUTH_COOKIE = "mihwar_aps_oauth";
export const APS_SCOPES = "data:read viewables:read user-profile:read";

export function isApsConfigured() {
  return Boolean(process.env.APS_CLIENT_ID && process.env.APS_CLIENT_SECRET);
}

export function getPublicOrigin(request: NextRequest): string {
  if (process.env.APS_CALLBACK_URL) {
    try { return new URL(process.env.APS_CALLBACK_URL).origin; } catch { /* ignore */ }
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try { return new URL(process.env.NEXT_PUBLIC_APP_URL).origin; } catch { /* ignore */ }
  }
  // Behind a hosted preview/reverse proxy, request.url may be 0.0.0.0.
  // x-forwarded-host and x-forwarded-proto carry the actual browser origin.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) || !["http", "https"].includes(proto)) {
    return new URL(request.url).origin;
  }
  return `${proto}://${host}`;
}

export function apsRedirectUri(origin: string): string {
  return process.env.APS_CALLBACK_URL || `${origin}/api/autodesk/callback`;
}

function encryptionKey(): Buffer {
  const secret = process.env.APS_ENCRYPTION_KEY || process.env.APS_CLIENT_SECRET;
  if (!secret) throw new Error("Autodesk encryption key is not configured");
  return createHash("sha256").update(`mihwar-aps-tokens:${secret}`).digest();
}

export function encryptTokens(payload: ApsTokenData): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTokens(value: string): ApsTokenData {
  const [iv, tag, contents] = value.split(".");
  if (!iv || !tag || !contents) throw new Error("Invalid Autodesk connection");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(contents, "base64url")), decipher.final()]).toString("utf8")) as ApsTokenData;
}

export interface ApsTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export async function exchangeApsToken(fields: Record<string, string>, basicAuth = true): Promise<TokenResponse> {
  const id = process.env.APS_CLIENT_ID;
  const secret = process.env.APS_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Autodesk credentials not configured");
  const body = new URLSearchParams(fields);
  const response = await fetch(`${APS_API}/authentication/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...(basicAuth ? { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` } : {}),
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("APS token exchange failed:", response.status, error.slice(0, 300));
    throw new Error(`تعذر الاتصال بـ Autodesk (${response.status}). تحقق من إعدادات APS وعنوان Callback.`);
  }
  return (await response.json()) as TokenResponse;
}

export async function getApsSessionId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(APS_COOKIE)?.value;
  return value && /^[a-zA-Z0-9_-]{24,120}$/.test(value) ? value : null;
}

export async function getUserApsToken(): Promise<string | null> {
  const sessionId = await getApsSessionId();
  if (!sessionId || !isApsConfigured()) return null;
  const [connection] = await db.select().from(apsConnections).where(eq(apsConnections.sessionId, sessionId)).limit(1);
  if (!connection) return null;
  let tokens: ApsTokenData;
  try { tokens = decryptTokens(connection.encryptedTokens); } catch { return null; }
  if (tokens.expiresAt > Date.now() + 90_000) return tokens.accessToken;
  try {
    const refreshed = await exchangeApsToken({ grant_type: "refresh_token", refresh_token: tokens.refreshToken });
    tokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      scope: refreshed.scope || tokens.scope,
    };
    await db.update(apsConnections).set({ encryptedTokens: encryptTokens(tokens), updatedAt: new Date() }).where(eq(apsConnections.sessionId, sessionId));
    return tokens.accessToken;
  } catch { return null; }
}

// This token has only viewables:read and is safe to hand to the Viewer SDK.
export async function getViewerUserToken(): Promise<{ access_token: string; expires_in: number } | null> {
  const sessionId = await getApsSessionId();
  if (!sessionId || !isApsConfigured()) return null;
  const [connection] = await db.select().from(apsConnections).where(eq(apsConnections.sessionId, sessionId)).limit(1);
  if (!connection) return null;
  try {
    const tokens = decryptTokens(connection.encryptedTokens);
    const scoped = await exchangeApsToken({ grant_type: "refresh_token", refresh_token: tokens.refreshToken, scope: "viewables:read" });
    // APS refresh tokens rotate, so persist it even for a scope-down exchange.
    if (scoped.refresh_token) {
      await db.update(apsConnections).set({ encryptedTokens: encryptTokens({ ...tokens, refreshToken: scoped.refresh_token }), updatedAt: new Date() }).where(eq(apsConnections.sessionId, sessionId));
    }
    return { access_token: scoped.access_token, expires_in: scoped.expires_in };
  } catch { return null; }
}

export async function getAppToken(scopes: string): Promise<{ access_token: string; expires_in: number }> {
  const id = process.env.APS_CLIENT_ID;
  const secret = process.env.APS_CLIENT_SECRET;
  if (!id || !secret) throw new Error("APS credentials missing");
  const data = await exchangeApsToken({ grant_type: "client_credentials", scope: scopes });
  return { access_token: data.access_token, expires_in: data.expires_in };
}

export async function apsFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${APS_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...init?.headers },
    cache: "no-store",
  });
}

export function urnify(raw: string) {
  return Buffer.from(raw).toString("base64url");
}
