import { NextRequest, NextResponse } from "next/server";
import { getAppToken, getUserApsToken, getViewerUserToken, isApsConfigured } from "@/lib/aps";

export const dynamic = "force-dynamic";

// Viewer receives ONLY viewables:read. data:read and refresh tokens stay server-side.
export async function GET(request: NextRequest) {
  if (!isApsConfigured()) return NextResponse.json({ error: "إعدادات Autodesk APS غير موجودة" }, { status: 503 });
  const source = request.nextUrl.searchParams.get("source");
  try {
    if (source === "docs") {
      const scoped = await getViewerUserToken();
      if (!scoped) return NextResponse.json({ error: "وصّل حساب Autodesk من جديد" }, { status: 401 });
      return NextResponse.json(scoped, { headers: { "Cache-Control": "no-store" } });
    }
    if (!(await getUserApsToken())) return NextResponse.json({ error: "وصّل حساب Autodesk الأول" }, { status: 401 });
    const token = await getAppToken("viewables:read");
    return NextResponse.json(token, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("APS viewer token failed:", error);
    return NextResponse.json({ error: "تعذر الحصول على توكن العرض من Autodesk" }, { status: 502 });
  }
}
