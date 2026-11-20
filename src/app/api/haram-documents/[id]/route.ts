import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { haramDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatBytes } from "@/lib/engineering";
import { deleteFileBlob, saveFileBlob } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Edit a document's fields; multipart `file` replaces its scan.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = parseId(id);
    if (!numId) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });

    const ct = request.headers.get("content-type") || "";
    const isForm = ct.includes("multipart/form-data");
    const formData = isForm ? await request.formData() : null;
    const body = formData ? null : await request.json().catch(() => ({}));

    const read = (k: string): string | undefined => {
      const raw = formData ? formData.get(k) : (body as Record<string, unknown> | null)?.[k];
      if (raw === null || raw === undefined) return undefined;
      return String(raw).trim();
    };

    const updates: Partial<typeof haramDocuments.$inferInsert> = {};
    const title = read("title");
    if (title !== undefined) {
      if (!title) return NextResponse.json({ error: "الاسم لا يمكن أن يكون فارغاً" }, { status: 400 });
      updates.title = title;
    }
    const nullableFields = [
      "holderName",
      "roleTitle",
      "organization",
      "projectTitle",
      "contactNumber",
      "cardNote",
    ] as const;
    for (const k of nullableFields) {
      const v = read(k);
      if (v !== undefined) updates[k] = v || null;
    }
    const docType = read("docType");
    if (docType !== undefined && docType) updates.docType = docType;

    const file = formData?.get("file");
    if (file instanceof File && file.name && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      updates.fileName = file.name;
      updates.mimeType = mimeType;
      updates.sizeFormatted = formatBytes(buffer.byteLength);
      updates.storagePath = await saveFileBlob("haram_document", numId, buffer, mimeType);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات للتعديل" }, { status: 400 });
    }

    const [updated] = await db
      .update(haramDocuments)
      .set(updates)
      .where(eq(haramDocuments.id, numId))
      .returning();
    if (!updated) return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });
    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error("PATCH /api/haram-documents/[id] error:", error);
    return NextResponse.json({ error: "تعذر تعديل الوثيقة" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = parseId(id);
    if (!numId) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });

    const [deleted] = await db
      .delete(haramDocuments)
      .where(eq(haramDocuments.id, numId))
      .returning();
    if (!deleted) return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });
    await deleteFileBlob("haram_document", deleted.id);
    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/haram-documents/[id] error:", error);
    return NextResponse.json({ error: "تعذر حذف الوثيقة" }, { status: 500 });
  }
}


