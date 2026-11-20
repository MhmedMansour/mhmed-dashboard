import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(certificates).orderBy(desc(certificates.id));
    return NextResponse.json({ certificates: rows });
  } catch (error) {
    console.error("GET /api/certificates error:", error);
    return NextResponse.json({ error: "تعذر تحميل الشهادات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const issuer = String(body.issuer || "").trim();

    if (!title || !issuer) {
      return NextResponse.json(
        { error: "يرجى إدخال اسم الشهادة والجهة المانحة" },
        { status: 400 }
      );
    }

    const category = [
      "cad_bim",
      "om_facility",
      "safety_pm",
      "academic",
    ].includes(body.category)
      ? body.category
      : "cad_bim";

    const [created] = await db
      .insert(certificates)
      .values({
        title,
        issuer,
        category,
        credentialCode:
          String(body.credentialCode || "").trim() ||
          `CERT-${new Date().getFullYear()}-${Math.floor(
            1000 + Math.random() * 8999
          )}`,
        issueDate:
          String(body.issueDate || "").trim() ||
          new Date().toISOString().split("T")[0],
        expiryDate: body.expiryDate ? String(body.expiryDate).trim() : "مدى الحياة",
        verified: body.verified !== undefined ? Boolean(body.verified) : true,
        fileUrl: body.fileUrl ? String(body.fileUrl).trim() : null,
        highlights: body.highlights ? String(body.highlights).trim() : null,
      })
      .returning();

    return NextResponse.json({ certificate: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/certificates error:", error);
    return NextResponse.json(
      { error: "تعذر إضافة الشهادة" },
      { status: 500 }
    );
  }
}
