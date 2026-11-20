import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engineeringFiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  encodeContentDisposition,
  isDbStoragePath,
  isLocalStoragePath,
  resolveStoredFile,
} from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "معرف ملف غير صالح" }, { status: 400 });
    }

    const [file] = await db
      .select()
      .from(engineeringFiles)
      .where(eq(engineeringFiles.id, numId))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    const stored = await resolveStoredFile(
      "engineering_file",
      file.id,
      file.storagePath,
      file.mimeType
    );

    if (stored) {
      await db
        .update(engineeringFiles)
        .set({ downloadsCount: sql`${engineeringFiles.downloadsCount} + 1` })
        .where(eq(engineeringFiles.id, numId));

      return new NextResponse(new Uint8Array(stored.data), {
        status: 200,
        headers: {
          "Content-Type": stored.mimeType || "application/octet-stream",
          "Content-Disposition": encodeContentDisposition("attachment", file.fileName),
          "Content-Length": String(stored.data.byteLength),
          "Cache-Control": "private, no-store",
        },
      });
    }

    // Uploaded earlier to the temporary disk vault that no longer exists.
    if (isLocalStoragePath(file.storagePath) || isDbStoragePath(file.storagePath)) {
      return NextResponse.json(
        {
          error:
            "محتوى هذا الملف غير متاح لأنه رُفع قبل تفعيل التخزين الدائم. ارفعه مرة أخرى وسيبقى محفوظاً.",
          code: "CONTENT_MISSING",
        },
        { status: 410 }
      );
    }

    // Registered archive (kept on the user's workstation/cloud) — provide a manifest.
    const manifest = [
      "=================================================================",
      "   مِحور الهندسي | MiHwar CAD / BIM & O&M Engineering Vault",
      "=================================================================",
      `File Name       : ${file.fileName}`,
      `Format / Ext    : ${file.extension.toUpperCase()} (${file.formatGroup})`,
      `Package Size    : ${file.sizeFormatted} (${file.sizeBytes.toLocaleString()} bytes)`,
      `Discipline      : ${file.segment.toUpperCase()}`,
      `Linked Project  : ${file.projectTitle || "N/A"}`,
      `Client Sample   : ${file.isClientSample ? "YES - Verified Portfolio Sample" : "Internal Archive"}`,
      `Archive Source  : ${file.storagePath || "Workstation Local Vault"}`,
      `Uploaded Date   : ${file.uploadedDate}`,
      `Technical Notes : ${file.sampleNote || "Verified CAD/BIM deliverable"}`,
      "=================================================================",
    ].join("\n");

    return new NextResponse(manifest, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": encodeContentDisposition(
          "attachment",
          `${file.fileName}.manifest.txt`
        ),
      },
    });
  } catch (error) {
    console.error("GET /api/files/[id]/download error:", error);
    return NextResponse.json({ error: "تعذر تحميل الملف" }, { status: 500 });
  }
}
