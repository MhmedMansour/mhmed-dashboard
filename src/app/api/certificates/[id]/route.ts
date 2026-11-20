import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates, engineeringFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteFileBlob } from "@/lib/fileStorage";

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

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    const textFields = [
      "title",
      "issuer",
      "credentialCode",
      "issueDate",
      "expiryDate",
      "fileUrl",
      "highlights",
    ] as const;
    for (const field of textFields) {
      if (body[field] !== undefined) {
        const val = String(body[field] ?? "").trim();
        updates[field] =
          val ||
          (field === "expiryDate"
            ? "مدى الحياة"
            : field === "fileUrl" || field === "highlights"
            ? null
            : val);
      }
    }

    if (
      body.category &&
      ["cad_bim", "om_facility", "safety_pm", "academic"].includes(body.category)
    ) {
      updates.category = body.category;
    }

    if (body.verified !== undefined) {
      updates.verified = Boolean(body.verified);
    }

    const [updated] = await db
      .update(certificates)
      .set(updates)
      .where(eq(certificates.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "الشهادة غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ certificate: updated });
  } catch (error) {
    console.error("PATCH /api/certificates/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر تحديث بيانات الشهادة" },
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
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(certificates)
      .where(eq(certificates.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "الشهادة غير موجودة" }, { status: 404 });
    }

    // Remove the certificate's attached files and their stored bytes as well.
    const attached = await db
      .delete(engineeringFiles)
      .where(eq(engineeringFiles.certificateId, numId))
      .returning({ id: engineeringFiles.id });
    for (const file of attached) {
      await deleteFileBlob("engineering_file", file.id);
    }

    return NextResponse.json({ deletedId: deleted.id, removedFiles: attached.length });
  } catch (error) {
    console.error("DELETE /api/certificates/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر حذف الشهادة" },
      { status: 500 }
    );
  }
}
