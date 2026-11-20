import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { haramDocuments } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { formatBytes } from "@/lib/engineering";
import { saveFileBlob } from "@/lib/fileStorage";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(haramDocuments)
      .orderBy(asc(haramDocuments.sortOrder), desc(haramDocuments.id));
    return NextResponse.json({ documents: rows });
  } catch (error) {
    console.error("GET /api/haram-documents error:", error);
    return NextResponse.json({ error: "تعذر تحميل وثائق الحرم" }, { status: 500 });
  }
}

// Add a document record; accepts an optional image/PDF scan in `file`.
export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get("content-type") || "";
    const isForm = ct.includes("multipart/form-data");
    const formData = isForm ? await request.formData() : null;
    const body = formData ? null : await request.json().catch(() => ({}));

    const read = (k: string) =>
      String(formData?.get(k) ?? (body as Record<string, unknown> | null)?.[k] ?? "").trim();

    const title = read("title");
    if (!title) {
      return NextResponse.json({ error: "يرجى إدخال اسم الوثيقة" }, { status: 400 });
    }

    const [last] = await db
      .select({ sortOrder: haramDocuments.sortOrder })
      .from(haramDocuments)
      .orderBy(desc(haramDocuments.sortOrder))
      .limit(1);

    const [created] = await db
      .insert(haramDocuments)
      .values({
        title,
        docType: read("docType") || "card",
        holderName: read("holderName") || null,
        roleTitle: read("roleTitle") || null,
        organization: read("organization") || null,
        projectTitle: read("projectTitle") || null,
        contactNumber: read("contactNumber") || null,
        cardNote: read("cardNote") || null,
        sortOrder: (Number(last?.sortOrder) || 0) + 1,
      })
      .returning();

    const file = formData?.get("file");
    if (file instanceof File && file.name && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      const storagePath = await saveFileBlob("haram_document", created.id, buffer, mimeType);
      const [stored] = await db
        .update(haramDocuments)
        .set({
          fileName: file.name,
          mimeType,
          sizeFormatted: formatBytes(buffer.byteLength),
          storagePath,
        })
        .where(eq(haramDocuments.id, created.id))
        .returning();
      return NextResponse.json({ document: stored || created }, { status: 201 });
    }

    return NextResponse.json({ document: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/haram-documents error:", error);
    return NextResponse.json({ error: "تعذر إضافة الوثيقة" }, { status: 500 });
  }
}
