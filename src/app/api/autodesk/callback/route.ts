import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apsConnections } from "@/db/schema";
import { APS_COOKIE, APS_OAUTH_COOKIE, APS_API, encryptTokens, exchangeApsToken, getPublicOrigin, isApsConfigured } from "@/lib/aps";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const go = (status: string) => NextResponse.redirect(new URL(`/?autodesk=${status}`, origin));
  if (!isApsConfigured()) return go("setup");
  const params = request.nextUrl.searchParams;
  const raw = request.cookies.get(APS_OAUTH_COOKIE)?.value;
  if (!raw) return go("state-error");
  let oauth: { state: string; verifier: string; sessionId: string; callback: string };
  try { oauth = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")); }
  catch { return go("state-error"); }
  if (!oauth.state || params.get("state") !== oauth.state || !oauth.verifier || !oauth.sessionId) return go("state-error");
  const code = params.get("code");
  if (!code || params.get("error")) return go("denied");
  try {
    const result = await exchangeApsToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: oauth.callback,
      code_verifier: oauth.verifier,
      client_id: process.env.APS_CLIENT_ID!,
      client_secret: process.env.APS_CLIENT_SECRET!,
    }, false);
    if (!result.refresh_token) throw new Error("No Autodesk refresh token returned");
    let displayName: string | null = null;
    let email: string | null = null;
    try {
      const profile = await fetch(`${APS_API}/userprofile/v1/users/@me`, {
        headers: { Authorization: `Bearer ${result.access_token}` }, cache: "no-store",
      });
      if (profile.ok) {
        const u = await profile.json();
        displayName = u.userName || u.firstName || u.name || null;
        email = u.emailId || u.email || null;
      }
    } catch { /* optional profile */ }
    await db.insert(apsConnections).values({
      sessionId: oauth.sessionId,
      encryptedTokens: encryptTokens({ accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000, scope: result.scope }),
      displayName, email,
    }).onConflictDoUpdate({ target: apsConnections.sessionId, set: {
      encryptedTokens: encryptTokens({ accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000, scope: result.scope }),
      displayName, email, updatedAt: new Date(),
    } });
    const res = go("connected");
    res.cookies.set(APS_COOKIE, oauth.sessionId, { httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    res.cookies.delete(APS_OAUTH_COOKIE);
    return res;
  } catch (error) {
    console.error("Autodesk OAuth callback:", error);
    const res = go("error");
    res.cookies.delete(APS_OAUTH_COOKIE);
    return res;
  }
}
