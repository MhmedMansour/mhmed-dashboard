import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { haramDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encodeContentDisposition, resolveStoredFile } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

// Lightweight availability check used before opening a preview tab.
export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const response = await GET(request, context);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}

// Serves the document scan inline (image / PDF) from durable storage.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    const [doc] = await db
      .select()
      .from(haramDocuments)
      .where(eq(haramDocuments.id, numId))
      .limit(1);
    if (!doc) return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });

    const stored = await resolveStoredFile(
      "haram_document",
      doc.id,
      doc.storagePath,
      doc.mimeType
    );
    if (!stored) {
      return NextResponse.json(
        { error: "لا يوجد ملف مرفوع لهذه الوثيقة بعد", code: "NO_FILE" },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(stored.data), {
      status: 200,
      headers: {
        "Content-Type": stored.mimeType || "application/octet-stream",
        "Content-Disposition": encodeContentDisposition("inline", doc.fileName || doc.title),
        "Content-Length": String(stored.data.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/haram-documents/[id]/preview error:", error);
    return NextResponse.json({ error: "تعذر عرض الوثيقة" }, { status: 500 });
  }
}
