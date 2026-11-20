import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { haramTasks, engineeringFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteFileBlob } from "@/lib/fileStorage";
import { normalizeCategory, normalizePriority, normalizeStatus } from "@/lib/haramExcel";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = parseId(id);
    if (!numId) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const updates: Partial<typeof haramTasks.$inferInsert> = { updatedAt: new Date() };

    const textFields = [
      "taskNo",
      "title",
      "description",
      "location",
      "requestedBy",
      "startDate",
      "endDate",
      "notes",
    ] as const;
    for (const f of textFields) {
      if (body[f] !== undefined) {
        const v = String(body[f] ?? "").trim();
        if (f === "title") {
          if (!v) return NextResponse.json({ error: "اسم المهمة لا يمكن أن يكون فارغاً" }, { status: 400 });
          updates.title = v;
        } else {
          updates[f] = v || null;
        }
      }
    }
    if (body.category !== undefined) updates.category = normalizeCategory(String(body.category));
    if (body.status !== undefined) updates.status = normalizeStatus(String(body.status));
    if (body.priority !== undefined) updates.priority = normalizePriority(String(body.priority));
    if (body.sheetsCount !== undefined) updates.sheetsCount = Math.max(0, Number(body.sheetsCount) || 0);
    if (body.hours !== undefined) updates.hours = Math.max(0, Number(body.hours) || 0);
    if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder) || 0;

    const [updated] = await db
      .update(haramTasks)
      .set(updates)
      .where(eq(haramTasks.id, numId))
      .returning();
    if (!updated) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error("PATCH /api/haram-tasks/[id] error:", error);
    return NextResponse.json({ error: "تعذر تعديل المهمة" }, { status: 500 });
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

    const [deleted] = await db.delete(haramTasks).where(eq(haramTasks.id, numId)).returning();
    if (!deleted) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

    const attached = await db
      .delete(engineeringFiles)
      .where(eq(engineeringFiles.haramTaskId, numId))
      .returning({ id: engineeringFiles.id });
    for (const f of attached) await deleteFileBlob("engineering_file", f.id);

    return NextResponse.json({ deletedId: deleted.id, removedFiles: attached.length });
  } catch (error) {
    console.error("DELETE /api/haram-tasks/[id] error:", error);
    return NextResponse.json({ error: "تعذر حذف المهمة" }, { status: 500 });
  }
}
