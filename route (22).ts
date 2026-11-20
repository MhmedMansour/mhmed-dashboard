import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { haramTasks, engineeringFiles } from "@/db/schema";
import { asc, desc, eq, isNotNull, or } from "drizzle-orm";
import { annotateFileContent } from "@/lib/fileStorage";
import { normalizeCategory, normalizePriority, normalizeStatus } from "@/lib/haramExcel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [tasks, files] = await Promise.all([
      db.select().from(haramTasks).orderBy(asc(haramTasks.sortOrder), desc(haramTasks.id)),
      // Task attachments + the original Excel sheets (segment "haram", no task).
      db
        .select()
        .from(engineeringFiles)
        .where(or(isNotNull(engineeringFiles.haramTaskId), eq(engineeringFiles.segment, "haram")))
        .orderBy(desc(engineeringFiles.id)),
    ]);
    return NextResponse.json({
      tasks,
      files: await annotateFileContent(files),
    });
  } catch (error) {
    console.error("GET /api/haram-tasks error:", error);
    return NextResponse.json({ error: "تعذر تحميل مهام الحرم" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "يرجى إدخال اسم المهمة" }, { status: 400 });
    }
    const [last] = await db
      .select({ sortOrder: haramTasks.sortOrder })
      .from(haramTasks)
      .orderBy(desc(haramTasks.sortOrder))
      .limit(1);
    const nextOrder = (last?.sortOrder ?? 0) + 1;

    const [created] = await db
      .insert(haramTasks)
      .values({
        taskNo: body.taskNo ? String(body.taskNo).trim() : null,
        title,
        description: body.description ? String(body.description).trim() : null,
        category: normalizeCategory(String(body.category || "")) ,
        location: body.location ? String(body.location).trim() : null,
        requestedBy: body.requestedBy ? String(body.requestedBy).trim() : null,
        status: normalizeStatus(String(body.status || "completed")),
        priority: normalizePriority(String(body.priority || "normal")),
        startDate: body.startDate ? String(body.startDate).trim() : null,
        endDate: body.endDate ? String(body.endDate).trim() : null,
        sheetsCount: Math.max(0, Number(body.sheetsCount) || 0),
        hours: Math.max(0, Number(body.hours) || 0),
        notes: body.notes ? String(body.notes).trim() : null,
        sourceSheet: "يدوي",
        sortOrder: nextOrder,
      })
      .returning();

    return NextResponse.json({ task: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/haram-tasks error:", error);
    return NextResponse.json({ error: "تعذر إضافة المهمة" }, { status: 500 });
  }
}
