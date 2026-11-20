import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generalInfo } from "@/db/schema";
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

// Serves general-info media inline (images / PDFs) from durable storage.
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

    const [record] = await db
      .select()
      .from(generalInfo)
      .where(eq(generalInfo.id, numId))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "البطاقة غير موجودة" }, { status: 404 });
    }

    const stored = await resolveStoredFile(
      "general_info",
      record.id,
      record.storagePath,
      record.mimeType
    );

    if (!stored) {
      return NextResponse.json(
        {
          error:
            "محتوى هذه البطاقة غير متاح لأنه رُفع قبل تفعيل التخزين الدائم. أعد رفعه وسيبقى محفوظاً.",
          code: "CONTENT_MISSING",
        },
        { status: 410 }
      );
    }

    return new NextResponse(new Uint8Array(stored.data), {
      status: 200,
      headers: {
        "Content-Type": stored.mimeType || "application/octet-stream",
        "Content-Disposition": encodeContentDisposition(
          "inline",
          record.fileName || "media"
        ),
        "Content-Length": String(stored.data.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/general-info/[id]/preview error:", error);
    return NextResponse.json({ error: "تعذر عرض الوسائط" }, { status: 500 });
  }
}
