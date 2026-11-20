import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engineeringFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import { deleteFileBlob, isLocalStoragePath } from "@/lib/fileStorage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "معرف ملف غير صالح" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.isClientSample !== undefined) {
      updates.isClientSample = Boolean(body.isClientSample);
    }

    if (body.sampleNote !== undefined) {
      updates.sampleNote = body.sampleNote ? String(body.sampleNote).trim() : null;
    }

    const [updated] = await db
      .update(engineeringFiles)
      .set(updates)
      .where(eq(engineeringFiles.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ file: updated });
  } catch (error) {
    console.error("PATCH /api/files/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر تحديث بيانات الملف" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "معرف ملف غير صالح" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(engineeringFiles)
      .where(eq(engineeringFiles.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    await deleteFileBlob("engineering_file", deleted.id);

    if (
      isLocalStoragePath(deleted.storagePath) &&
      deleted.storagePath &&
      fs.existsSync(deleted.storagePath)
    ) {
      try {
        fs.unlinkSync(deleted.storagePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/files/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر حذف الملف" },
      { status: 500 }
    );
  }
}
