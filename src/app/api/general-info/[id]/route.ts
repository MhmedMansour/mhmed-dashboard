import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generalInfo } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import { classifyFileFormat, formatBytes } from "@/lib/engineering";
import { deleteFileBlob, isLocalStoragePath, saveFileBlob } from "@/lib/fileStorage";

// Edit a card's title/description, and optionally replace its attached file.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(generalInfo)
      .where(eq(generalInfo.id, numId))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "البطاقة غير موجودة" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";
    const formData = contentType.includes("multipart/form-data")
      ? await request.formData()
      : null;
    const body = formData ? null : await request.json().catch(() => ({}));

    const readField = (key: string): string | undefined => {
      const raw = formData ? formData.get(key) : (body as Record<string, unknown> | null)?.[key];
      if (raw === null || raw === undefined) return undefined;
      return String(raw).trim();
    };

    const updates: Partial<typeof generalInfo.$inferInsert> = {};
    const title = readField("title");
    if (title !== undefined) {
      if (!title) {
        return NextResponse.json({ error: "عنوان البطاقة لا يمكن أن يكون فارغاً" }, { status: 400 });
      }
      updates.title = title;
    }
    const description = readField("description");
    if (description !== undefined) updates.description = description || null;

    const replacement = formData?.get("file");
    if (replacement instanceof File && replacement.name && replacement.size > 0) {
      const buffer = Buffer.from(await replacement.arrayBuffer());
      const mimeType = replacement.type || "application/octet-stream";
      const fmt = classifyFileFormat(replacement.name);
      updates.mediaType = fmt.formatGroup === "images" ? "image" : "pdf";
      updates.fileName = replacement.name;
      updates.mimeType = mimeType;
      updates.sizeFormatted = formatBytes(buffer.byteLength);
      updates.storagePath = await saveFileBlob("general_info", numId, buffer, mimeType);
    }

    const [updated] = await db
      .update(generalInfo)
      .set(updates)
      .where(eq(generalInfo.id, numId))
      .returning();

    return NextResponse.json({ info: updated });
  } catch (error) {
    console.error("PATCH /api/general-info/[id] error:", error);
    return NextResponse.json({ error: "تعذر تعديل البطاقة" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(generalInfo)
      .where(eq(generalInfo.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "البطاقة غير موجودة" }, { status: 404 });
    }

    await deleteFileBlob("general_info", deleted.id);

    if (
      isLocalStoragePath(deleted.storagePath) &&
      deleted.storagePath &&
      fs.existsSync(deleted.storagePath)
    ) {
      try {
        fs.unlinkSync(deleted.storagePath);
      } catch {
        // ignore cleanup errors
      }
    }

    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/general-info/[id] error:", error);
    return NextResponse.json({ error: "تعذر حذف البطاقة" }, { status: 500 });
  }
}
