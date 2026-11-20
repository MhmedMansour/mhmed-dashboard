import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { haramTasks, engineeringFiles } from "@/db/schema";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { parseHaramWorkbook } from "@/lib/haramExcel";
import { classifyFileFormat, formatBytes, normalizeExtension } from "@/lib/engineering";
import { deleteFileBlob, saveFileBlob } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

const EXCEL_EXT = [".xlsx", ".xlsm", ".xls", ".csv", ".ods"];

/**
 * POST /api/haram-tasks/import
 *  - multipart: file=<excel>, mode=preview|import, replace=true|false
 *  preview → returns parsed rows without saving
 *  import  → saves rows (optionally replaces previous import) and keeps a copy
 *            of the Excel file attached to the batch for future reference.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "import");
    const replace = String(formData.get("replace") || "false") === "true";

    if (!(file instanceof File) || !file.name || file.size === 0) {
      return NextResponse.json({ error: "اختَر ملف Excel أولاً (.xlsx / .xls / .csv)" }, { status: 400 });
    }
    const ext = normalizeExtension(file.name);
    if (!EXCEL_EXT.includes(ext)) {
      return NextResponse.json(
        { error: `الصيغة ${ext} غير مدعومة — ارفع ملف Excel بصيغة .xlsx أو .xls أو .csv` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseHaramWorkbook(buffer);

    if (mode === "preview") {
      return NextResponse.json({
        preview: true,
        count: parsed.tasks.length,
        skipped: parsed.skipped,
        sheets: parsed.sheets,
        warnings: parsed.warnings,
        sample: parsed.tasks.slice(0, 50),
      });
    }

    if (parsed.tasks.length === 0) {
      return NextResponse.json(
        { error: "لم يتم العثور على مهام في الملف", warnings: parsed.warnings, sheets: parsed.sheets },
        { status: 422 }
      );
    }

    const batch = `xlsx-${Date.now()}`;

    if (replace) {
      // Remove previous Excel-imported tasks (manual ones are kept), their
      // attachments, AND the old source workbooks so re-imports never pile up
      // duplicate "original Excel" files in the vault.
      const imported = await db
        .select({ id: haramTasks.id })
        .from(haramTasks)
        .where(isNotNull(haramTasks.importBatch));
      for (const t of imported) {
        const taskFiles = await db
          .delete(engineeringFiles)
          .where(eq(engineeringFiles.haramTaskId, t.id))
          .returning({ id: engineeringFiles.id });
        for (const f of taskFiles) await deleteFileBlob("engineering_file", f.id);
        await db.delete(haramTasks).where(eq(haramTasks.id, t.id));
      }
      const oldSources = await db
        .delete(engineeringFiles)
        .where(and(isNull(engineeringFiles.haramTaskId), eq(engineeringFiles.segment, "haram")))
        .returning({ id: engineeringFiles.id });
      for (const f of oldSources) await deleteFileBlob("engineering_file", f.id);
    }

    const [last] = await db
      .select({ sortOrder: haramTasks.sortOrder })
      .from(haramTasks)
      .orderBy(desc(haramTasks.sortOrder))
      .limit(1);
    let order = last?.sortOrder || 0;

    const inserted = [];
    for (const t of parsed.tasks) {
      order += 1;
      const [row] = await db
        .insert(haramTasks)
        .values({
          taskNo: t.taskNo,
          title: t.title,
          description: t.description,
          category: t.category,
          location: t.location,
          requestedBy: t.requestedBy,
          status: t.status,
          priority: t.priority,
          startDate: t.startDate,
          endDate: t.endDate,
          sheetsCount: t.sheetsCount,
          hours: t.hours,
          notes: t.notes,
          sourceSheet: t.sourceSheet,
          sourceRow: t.sourceRow,
          importBatch: batch,
          sortOrder: order,
        })
        .returning();
      inserted.push(row);
    }

    // Keep the original Excel as a durable file linked to the first task's batch
    // so the user can always re-download the source sheet.
    let sourceFile = null;
    try {
      const fmt = classifyFileFormat(ext);
      const [srcRow] = await db
        .insert(engineeringFiles)
        .values({
          fileName: file.name,
          extension: ext,
          formatGroup: fmt.formatGroup,
          sizeBytes: buffer.byteLength,
          sizeFormatted: formatBytes(buffer.byteLength),
          segment: "haram",
          projectId: null,
          certificateId: null,
          haramTaskId: null,
          projectTitle: `ملف Excel الأصلي — مهام الحرم النبوي (${inserted.length} مهمة)`,
          isClientSample: false,
          sampleNote: `دفعة الاستيراد ${batch}`,
          storagePath: null,
          mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          uploadedDate: new Date().toISOString().split("T")[0],
          downloadsCount: 0,
        })
        .returning();
      const storagePath = await saveFileBlob("engineering_file", srcRow.id, buffer, srcRow.mimeType || "application/octet-stream");
      const [stored] = await db
        .update(engineeringFiles)
        .set({ storagePath })
        .where(eq(engineeringFiles.id, srcRow.id))
        .returning();
      sourceFile = stored || srcRow;
    } catch (e) {
      console.error("source excel keep failed:", e);
    }

    return NextResponse.json(
      {
        ok: true,
        batch,
        count: inserted.length,
        skipped: parsed.skipped,
        sheets: parsed.sheets,
        warnings: parsed.warnings,
        tasks: inserted,
        sourceFile,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/haram-tasks/import error:", error);
    return NextResponse.json({ error: "تعذر قراءة ملف Excel — تأكد أنه غير محمي بكلمة مرور" }, { status: 500 });
  }
}
