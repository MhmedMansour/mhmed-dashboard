import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates, engineeringFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { classifyFileFormat, formatBytes, normalizeExtension } from "@/lib/engineering";
import { saveFileBlob } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

function titleFromFileName(name: string): string {
  const withoutExt = name.replace(/\.[^/.]+$/, "");
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || name;
}

// Bulk-import a whole folder of certificate files. Each file becomes:
// 1) a certificate record (title derived from the file name, fully editable), and
// 2) a durable engineering_files attachment linked to that certificate.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const category = String(formData.get("category") || "cad_bim");
    const issuer = String(formData.get("issuer") || "").trim() || "جهة التدريب — قابلة للتعديل";
    const issueDate = String(formData.get("issueDate") || "").trim() || new Date().toISOString().split("T")[0];

    const validCategory = ["cad_bim", "om_facility", "safety_pm", "academic"].includes(category)
      ? category
      : "cad_bim";

    const files: File[] = [];
    for (const entry of [...formData.getAll("files"), formData.get("file")]) {
      if (entry instanceof File && entry.name && entry.size > 0) files.push(entry);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "يرجى اختيار ملف واحد على الأقل من فولدر الشهادات" },
        { status: 400 }
      );
    }

    const createdCertificates: (typeof certificates.$inferSelect)[] = [];
    const createdFiles: (typeof engineeringFiles.$inferSelect)[] = [];

    for (const [index, f] of files.entries()) {
      const buffer = Buffer.from(await f.arrayBuffer());
      const mimeType = f.type || "application/octet-stream";
      const ext = normalizeExtension(f.name);
      const fmt = classifyFileFormat(ext);

      const [cert] = await db
        .insert(certificates)
        .values({
          title: titleFromFileName(f.name),
          issuer,
          category: validCategory,
          credentialCode: `IMP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${index}`,
          issueDate,
          expiryDate: "مدى الحياة",
          verified: false,
          fileUrl: null,
          highlights: "مستورد من فولدر الشهادات — اضغط ✏️ لتعديل الاسم أو الجهة المانحة أو تاريخ الإصدار.",
        })
        .returning();
      createdCertificates.push(cert);

      const [fileRow] = await db
        .insert(engineeringFiles)
        .values({
          fileName: f.name,
          extension: ext,
          formatGroup: fmt.formatGroup,
          sizeBytes: buffer.byteLength,
          sizeFormatted: formatBytes(buffer.byteLength),
          segment: "certificates",
          projectId: null,
          certificateId: cert.id,
          projectTitle: cert.title,
          isClientSample: false,
          sampleNote: `ملف الشهادة: ${cert.title}`,
          storagePath: null,
          mimeType,
          uploadedDate: new Date().toISOString().split("T")[0],
          downloadsCount: 0,
        })
        .returning();

      const storagePath = await saveFileBlob("engineering_file", fileRow.id, buffer, mimeType);
      const [stored] = await db
        .update(engineeringFiles)
        .set({ storagePath })
        .where(eq(engineeringFiles.id, fileRow.id))
        .returning();
      createdFiles.push(stored || fileRow);
    }

    return NextResponse.json(
      {
        ok: true,
        count: createdCertificates.length,
        certificates: createdCertificates,
        files: createdFiles,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/certificates/import error:", error);
    return NextResponse.json(
      { error: "تعذر استيراد ملفات الشهادات" },
      { status: 500 }
    );
  }
}
