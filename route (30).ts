import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engineeringFiles, generalInfo, haramDocuments, shareLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encodeContentDisposition, resolveStoredFile } from "@/lib/fileStorage";
import type { BlobOwnerType } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

async function loadEntry(
  resourceType: string,
  resourceId: number,
  fileId: number | null
): Promise<
  | { ownerType: BlobOwnerType; ownerId: number; fileName: string; mimeType: string | null }
  | { manifest: string; fileName: string }
  | null
> {
  if (resourceType === "engineering_file") {
    const id = fileId ?? resourceId;
    const [f] = await db.select().from(engineeringFiles).where(eq(engineeringFiles.id, id)).limit(1);
    if (!f) return null;
    return { ownerType: "engineering_file", ownerId: f.id, fileName: f.fileName, mimeType: f.mimeType };
  }
  if (resourceType === "general_info") {
    const id = fileId ?? resourceId;
    const [g] = await db.select().from(generalInfo).where(eq(generalInfo.id, id)).limit(1);
    if (!g || !g.fileName) return null;
    return { ownerType: "general_info", ownerId: g.id, fileName: g.fileName, mimeType: g.mimeType };
  }
  if (resourceType === "haram_document") {
    const id = fileId ?? resourceId;
    const [h] = await db.select().from(haramDocuments).where(eq(haramDocuments.id, id)).limit(1);
    if (!h || !h.fileName) return null;
    return { ownerType: "haram_document", ownerId: h.id, fileName: h.fileName, mimeType: h.mimeType };
  }
  // Entity shares: the attached file must belong to the shared entity.
  if (fileId == null) return null;
  const [f] = await db.select().from(engineeringFiles).where(eq(engineeringFiles.id, fileId)).limit(1);
  if (!f) return null;
  const belongs =
    (resourceType === "project" && f.projectId === resourceId) ||
    (resourceType === "haram_task" && f.haramTaskId === resourceId) ||
    (resourceType === "certificate" && f.certificateId === resourceId);
  if (!belongs) return null;
  return { ownerType: "engineering_file", ownerId: f.id, fileName: f.fileName, mimeType: f.mimeType };
}

// GET /api/share/[token]/file?fileId=&download=1 — PUBLIC file bytes (no login)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";
    const rawFileId = searchParams.get("fileId");
    const fileId = rawFileId ? Number(rawFileId) : null;
    if (rawFileId && (!Number.isInteger(fileId) || (fileId as number) <= 0)) {
      return NextResponse.json({ error: "معرف الملف غير صالح" }, { status: 400 });
    }

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
    if (download && !link.allowDownload) {
      return NextResponse.json(
        { error: "التحميل غير مسموح لهذا الرابط — المعاينة فقط متاحة" },
        { status: 403 }
      );
    }

    const entry = await loadEntry(link.resourceType, link.resourceId, fileId);
    if (!entry) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }
    if ("manifest" in entry) {
      return new NextResponse(entry.manifest, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const stored = await resolveStoredFile(entry.ownerType, entry.ownerId, null, entry.mimeType);
    if (!stored) {
      return NextResponse.json({ error: "محتوى الملف غير متاح حالياً" }, { status: 410 });
    }

    return new NextResponse(new Uint8Array(stored.data), {
      status: 200,
      headers: {
        "Content-Type": stored.mimeType || "application/octet-stream",
        "Content-Disposition": encodeContentDisposition(
          download ? "attachment" : "inline",
          entry.fileName
        ),
        "Content-Length": String(stored.data.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/share/[token]/file error:", error);
    return NextResponse.json({ error: "تعذر جلب الملف" }, { status: 500 });
  }
}
