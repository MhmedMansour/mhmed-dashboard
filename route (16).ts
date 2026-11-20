import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generalInfo } from "@/db/schema";
import { classifyFileFormat, formatBytes } from "@/lib/engineering";
import { saveFileBlob } from "@/lib/fileStorage";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(generalInfo).orderBy(desc(generalInfo.id));
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error("GET /api/general-info error:", error);
    return NextResponse.json({ error: "تعذر تحميل المعلومات العامة" }, { status: 500 });
  }
}

// Add general-info cards: one or more images/PDFs (each becomes its own card),
// or a plain note when no file is attached.
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    const formData = isMultipart ? await request.formData() : null;
    const body = formData ? null : await request.json().catch(() => ({}));

    const read = (key: string): string =>
      String(formData?.get(key) ?? (body as Record<string, unknown> | null)?.[key] ?? "").trim();

    const title = read("title");
    const description = read("description");
    if (!title) {
      return NextResponse.json({ error: "يرجى إدخال عنوان البطاقة" }, { status: 400 });
    }

    const files: File[] = [];
    if (formData) {
      for (const entry of [...formData.getAll("files"), formData.get("file")]) {
        if (entry instanceof File && entry.name && entry.size > 0) files.push(entry);
      }
    }

    if (files.length > 0) {
      const created: (typeof generalInfo.$inferSelect)[] = [];

      for (const [index, file] of files.entries()) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || "application/octet-stream";
        const fmt = classifyFileFormat(file.name);
        const mediaType = fmt.formatGroup === "images" ? "image" : "pdf";
        // Number the cards when several files share one title so they stay distinguishable.
        const cardTitle = files.length > 1 ? `${title} (${index + 1}/${files.length})` : title;

        const [row] = await db
          .insert(generalInfo)
          .values({
            title: cardTitle,
            description: description || null,
            mediaType,
            fileName: file.name,
            storagePath: null,
            mimeType,
            sizeFormatted: formatBytes(buffer.byteLength),
          })
          .returning();

        // Keep the media bytes in PostgreSQL so they survive server restarts.
        const storagePath = await saveFileBlob("general_info", row.id, buffer, mimeType);
        const [stored] = await db
          .update(generalInfo)
          .set({ storagePath })
          .where(eq(generalInfo.id, row.id))
          .returning();

        created.push(stored || row);
      }

      return NextResponse.json({ info: created[0], items: created }, { status: 201 });
    }

    const [created] = await db
      .insert(generalInfo)
      .values({ title, description: description || null, mediaType: "note" })
      .returning();

    return NextResponse.json({ info: created, items: [created] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/general-info error:", error);
    return NextResponse.json(
      { error: "تعذر إضافة بطاقة المعلومات العامة" },
      { status: 500 }
    );
  }
}
