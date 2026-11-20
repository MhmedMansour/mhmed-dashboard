import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { makeToken, resolveShareResource, SHARE_RESOURCE_TYPES } from "@/lib/share";

export const dynamic = "force-dynamic";

function expiryFromDays(days: unknown): Date | null {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null; // 0 = never expires
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// POST /api/share — create (or reuse) a public share link
// body: { resourceType, resourceId, allowDownload?, expiresInDays? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const resourceType = String(body.resourceType || "");
    const resourceId = Number(body.resourceId);

    if (!SHARE_RESOURCE_TYPES.includes(resourceType as (typeof SHARE_RESOURCE_TYPES)[number])) {
      return NextResponse.json({ error: "نوع المورد غير مدعوم" }, { status: 400 });
    }
    if (!Number.isInteger(resourceId) || resourceId <= 0) {
      return NextResponse.json({ error: "معرف المورد غير صالح" }, { status: 400 });
    }

    const resolved = await resolveShareResource(resourceType, resourceId);
    if (!resolved) {
      return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });
    }

    const allowDownload = body.allowDownload === undefined ? true : Boolean(body.allowDownload);
    const expiresAt = expiryFromDays(body.expiresInDays);

    // Reuse an existing active link for the same resource when settings match
    // and the caller didn't explicitly ask for a fresh one.
    if (!body.fresh) {
      const [existing] = await db
        .select()
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.resourceType, resourceType),
            eq(shareLinks.resourceId, resourceId),
            eq(shareLinks.allowDownload, allowDownload)
          )
        )
        .orderBy(desc(shareLinks.id))
        .limit(1);
      if (existing && (!existing.expiresAt || existing.expiresAt.getTime() > Date.now())) {
        return NextResponse.json({ link: existing, reused: true });
      }
    }

    const [link] = await db
      .insert(shareLinks)
      .values({
        token: makeToken(),
        resourceType,
        resourceId,
        title: resolved.title,
        fileName: resolved.fileName,
        allowDownload,
        expiresAt,
      })
      .returning();

    return NextResponse.json({ link, reused: false }, { status: 201 });
  } catch (error) {
    console.error("POST /api/share error:", error);
    return NextResponse.json({ error: "تعذر إنشاء رابط المشاركة" }, { status: 500 });
  }
}

// GET /api/share?resourceType=x&resourceId=y — list active links for a resource
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get("resourceType") || "";
    const resourceId = Number(searchParams.get("resourceId"));
    if (!resourceType || !Number.isInteger(resourceId) || resourceId <= 0) {
      return NextResponse.json({ error: "حدد المورد" }, { status: 400 });
    }
    const rows = await db
      .select()
      .from(shareLinks)
      .where(
        and(eq(shareLinks.resourceType, resourceType), eq(shareLinks.resourceId, resourceId))
      )
      .orderBy(desc(shareLinks.id));
    const now = Date.now();
    return NextResponse.json({
      links: rows.map((r) => ({
        ...r,
        expired: Boolean(r.expiresAt && r.expiresAt.getTime() <= now),
      })),
    });
  } catch (error) {
    console.error("GET /api/share error:", error);
    return NextResponse.json({ error: "تعذر تحميل الروابط" }, { status: 500 });
  }
}
