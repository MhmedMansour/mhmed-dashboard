import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { siteOperations } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(siteOperations).orderBy(desc(siteOperations.id));
    return NextResponse.json({ operations: rows });
  } catch (error) {
    console.error("GET /api/operations error:", error);
    return NextResponse.json({ error: "تعذر تحميل سجلات المواقع" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siteName = String(body.siteName || "").trim();
    const roleTitle = String(body.roleTitle || "").trim();

    if (!siteName || !roleTitle) {
      return NextResponse.json(
        { error: "يرجى إدخال اسم الموقع والمسمى الوظيفي" },
        { status: 400 }
      );
    }

    const operationType = [
      "preventive",
      "corrective",
      "handover",
      "inspection",
    ].includes(body.operationType)
      ? body.operationType
      : "preventive";

    const siteStatus = ["active_site", "previous_site", "scheduled"].includes(
      body.siteStatus
    )
      ? body.siteStatus
      : "active_site";

    const ticketsTotal = Math.max(1, Number(body.ticketsTotal) || 20);
    const ticketsResolved = Math.max(
      0,
      Math.min(ticketsTotal, Number(body.ticketsResolved) || ticketsTotal)
    );
    const uptimePercent = Math.max(
      50,
      Math.min(100, Number(body.uptimePercent) || 98)
    );

    const [created] = await db
      .insert(siteOperations)
      .values({
        siteName,
        projectName: body.projectName ? String(body.projectName).trim() : null,
        roleTitle,
        operationType,
        systemCategory: String(
          body.systemCategory || "أنظمة كهروميكانيك وتكييف MEP"
        ).trim(),
        siteStatus,
        uptimePercent,
        ticketsResolved,
        ticketsTotal,
        periodLabel: String(body.periodLabel || "2025 - مستمر").trim(),
        loggedDate:
          String(body.loggedDate || "").trim() ||
          new Date().toISOString().split("T")[0],
        notes: body.notes ? String(body.notes).trim() : null,
      })
      .returning();

    return NextResponse.json({ operation: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/operations error:", error);
    return NextResponse.json(
      { error: "تعذر حفظ سجل التشغيل والصيانة" },
      { status: 500 }
    );
  }
}
