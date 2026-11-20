import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { APS_API, APS_OAUTH_COOKIE, APS_SCOPES, apsRedirectUri, getPublicOrigin, isApsConfigured } from "@/lib/aps";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApsConfigured()) {
    return NextResponse.redirect(new URL("/?autodesk=setup", getPublicOrigin(request)));
  }
  const origin = getPublicOrigin(request);
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const sessionId = randomBytes(32).toString("base64url");
  const callback = apsRedirectUri(origin);
  const url = new URL(`${APS_API}/authentication/v2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.APS_CLIENT_ID!);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", APS_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  const res = NextResponse.redirect(url);
  res.cookies.set(APS_OAUTH_COOKIE, Buffer.from(JSON.stringify({ state, verifier, sessionId, callback })).toString("base64url"), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
