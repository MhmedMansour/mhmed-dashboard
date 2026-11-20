import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "معرف مشروع غير صالح" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Full-field edits (from the edit modal)
    const textFields = [
      "code",
      "title",
      "clientOrSite",
      "discipline",
      "software",
      "location",
      "dueDate",
    ] as const;
    for (const field of textFields) {
      if (body[field] !== undefined) {
        const val = String(body[field] ?? "").trim();
        if (val) updates[field] = val;
        else if (field === "location") updates[field] = null;
      }
    }

    if (
      body.segment &&
      ["autocad", "revit", "om", "parallel"].includes(body.segment)
    ) {
      updates.segment = body.segment;
    }

    if (body.sheetsCount !== undefined) {
      updates.sheetsCount = Math.max(0, Number(body.sheetsCount) || 0);
    }

    if (body.hoursLogged !== undefined) {
      updates.hoursLogged = Math.max(0, Number(body.hoursLogged) || 0);
    }

    if (body.slaScore !== undefined) {
      updates.slaScore = Math.max(50, Math.min(100, Number(body.slaScore) || 95));
    }

    if (body.progress !== undefined) {
      const p = Math.max(0, Math.min(100, Number(body.progress)));
      updates.progress = p;
      if (p === 100 && body.status === undefined) {
        updates.status = "completed";
      } else if (p < 100 && body.status === undefined && body.autoInProgress) {
        updates.status = "in_progress";
      }
    }

    if (
      body.status &&
      ["in_progress", "review", "completed", "on_hold"].includes(body.status)
    ) {
      updates.status = body.status;
      if (body.status === "completed" && body.progress === undefined) {
        updates.progress = 100;
      }
    }

    if (body.priority && ["urgent", "high", "normal"].includes(body.priority)) {
      updates.priority = body.priority;
    }

    if (body.isSample !== undefined) {
      updates.isSample = Boolean(body.isSample);
    }

    if (body.sampleSummary !== undefined) {
      updates.sampleSummary = body.sampleSummary
        ? String(body.sampleSummary).trim()
        : null;
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر تحديث بيانات المشروع" },
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
      return NextResponse.json({ error: "معرف مشروع غير صالح" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(projects)
      .where(eq(projects.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر حذف المشروع" },
      { status: 500 }
    );
  }
}
