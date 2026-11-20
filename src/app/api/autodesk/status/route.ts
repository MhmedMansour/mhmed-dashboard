import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apsConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApsSessionId, getUserApsToken, isApsConfigured, apsRedirectUri, getPublicOrigin } from "@/lib/aps";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const configured = isApsConfigured();
  const callbackUrl = apsRedirectUri(getPublicOrigin(request));
  if (!configured) return NextResponse.json({ configured: false, connected: false, callbackUrl, setupUrl: "https://aps.autodesk.com/myapps/" });
  const sessionId = await getApsSessionId();
  if (!sessionId) return NextResponse.json({ configured: true, connected: false, callbackUrl });
  const [row] = await db.select({ displayName: apsConnections.displayName, email: apsConnections.email }).from(apsConnections).where(eq(apsConnections.sessionId, sessionId)).limit(1);
  if (!row) return NextResponse.json({ configured: true, connected: false, callbackUrl });
  const token = await getUserApsToken();
  return NextResponse.json({ configured: true, connected: Boolean(token), callbackUrl, displayName: row.displayName, email: row.email });
}

export async function DELETE() {
  const sessionId = await getApsSessionId();
  if (sessionId) await db.delete(apsConnections).where(eq(apsConnections.sessionId, sessionId));
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("mihwar_aps_session");
  return res;
}
