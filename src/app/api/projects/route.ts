import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const clientOrSite = String(body.clientOrSite || "").trim();

    if (!title || !clientOrSite) {
      return NextResponse.json(
        { error: "يرجى إدخال عنوان المشروع واسم العميل أو الموقع" },
        { status: 400 }
      );
    }

    const segment = ["autocad", "revit", "om", "parallel"].includes(body.segment)
      ? body.segment
      : "autocad";

    const prefixMap: Record<string, string> = {
      autocad: "CAD",
      revit: "BIM",
      om: "OM",
      parallel: "PAR",
    };

    const code =
      String(body.code || "").trim() ||
      `${prefixMap[segment]}-${new Date().getFullYear()}-${Math.floor(
        100 + Math.random() * 899
      )}`;

    const status = ["in_progress", "review", "completed", "on_hold"].includes(
      body.status
    )
      ? body.status
      : "in_progress";

    const priority = ["urgent", "high", "normal"].includes(body.priority)
      ? body.priority
      : "high";

    const progress = Math.max(
      0,
      Math.min(100, Number.isFinite(Number(body.progress)) ? Number(body.progress) : 25)
    );

    const [created] = await db
      .insert(projects)
      .values({
        code,
        title,
        clientOrSite,
        segment,
        discipline: String(body.discipline || "هندسة وتصميم CAD / BIM").trim(),
        software: String(body.software || "AutoCAD / Revit 2025").trim(),
        status: progress === 100 ? "completed" : status,
        priority,
        progress,
        sheetsCount: Math.max(0, Number(body.sheetsCount) || 12),
        hoursLogged: Math.max(0, Number(body.hoursLogged) || 16),
        slaScore: Math.max(50, Math.min(100, Number(body.slaScore) || 97)),
        isSample: Boolean(body.isSample),
        sampleSummary: body.sampleSummary ? String(body.sampleSummary).trim() : null,
        location: body.location ? String(body.location).trim() : "القاهرة",
        dueDate:
          String(body.dueDate || "").trim() ||
          new Date().toISOString().split("T")[0],
      })
      .returning();

    return NextResponse.json({ project: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "تعذر حفظ المشروع الجديد" },
      { status: 500 }
    );
  }
}
