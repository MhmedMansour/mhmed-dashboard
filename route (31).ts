import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveShareResource } from "@/lib/share";

export const dynamic = "force-dynamic";

// GET /api/share/[token] — PUBLIC metadata (no login required)
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token))
      .limit(1);

    if (!link) {
      return NextResponse.json({ error: "الرابط غير موجود أو تم إلغاؤه" }, { status: 404 });
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "انتهت صلاحية هذا الرابط", expired: true }, { status: 410 });
    }

    const resolved = await resolveShareResource(link.resourceType, link.resourceId);
    if (!resolved) {
      return NextResponse.json({ error: "العنصر المرتبط بهذا الرابط تم حذفه" }, { status: 404 });
    }

    return NextResponse.json({
      token: link.token,
      title: resolved.title,
      subtitle: resolved.subtitle,
      details: resolved.details,
      resourceType: link.resourceType,
      isFile: resolved.isFile,
      fileName: resolved.fileName,
      mimeType: resolved.mimeType,
      sizeFormatted: resolved.sizeFormatted,
      allowDownload: link.allowDownload,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      files: resolved.files,
    });
  } catch (error) {
    console.error("GET /api/share/[token] error:", error);
    return NextResponse.json({ error: "تعذر فتح الرابط" }, { status: 500 });
  }
}

// PATCH /api/share/[token] — update settings { allowDownload?, expiresInDays? }
// expiresInDays: 0 = never, >0 = days from now, null/undefined = keep
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    const updates: { allowDownload?: boolean; expiresAt?: Date | null } = {};
    if (body.allowDownload !== undefined) updates.allowDownload = Boolean(body.allowDownload);
    if (body.expiresInDays !== undefined) {
      const n = Number(body.expiresInDays);
      updates.expiresAt = Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 86400000) : null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "لا توجد إعدادات للتحديث" }, { status: 400 });
    }
    const [updated] = await db
      .update(shareLinks)
      .set(updates)
      .where(eq(shareLinks.token, token))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "الرابط غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ link: updated });
  } catch (error) {
    console.error("PATCH /api/share/[token] error:", error);
    return NextResponse.json({ error: "تعذر تحديث الرابط" }, { status: 500 });
  }
}

// DELETE /api/share/[token] — revoke a link
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const [deleted] = await db
      .delete(shareLinks)
      .where(eq(shareLinks.token, token))
      .returning({ id: shareLinks.id });
    if (!deleted) {
      return NextResponse.json({ error: "الرابط غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("DELETE /api/share/[token] error:", error);
    return NextResponse.json({ error: "تعذر إلغاء الرابط" }, { status: 500 });
  }
}
