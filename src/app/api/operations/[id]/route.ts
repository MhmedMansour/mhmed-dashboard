import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { siteOperations } from "@/db/schema";
import { eq } from "drizzle-orm";

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
      "siteName",
      "projectName",
      "roleTitle",
      "systemCategory",
      "periodLabel",
      "loggedDate",
      "notes",
    ] as const;
    for (const field of textFields) {
      if (body[field] !== undefined) {
        const val = String(body[field] ?? "").trim();
        updates[field] = val || (field === "notes" ? null : val);
      }
    }

    if (
      body.operationType &&
      ["preventive", "corrective", "handover", "inspection"].includes(
        body.operationType
      )
    ) {
      updates.operationType = body.operationType;
    }

    if (
      body.siteStatus &&
      ["active_site", "previous_site", "scheduled"].includes(body.siteStatus)
    ) {
      updates.siteStatus = body.siteStatus;
    }

    if (body.uptimePercent !== undefined) {
      updates.uptimePercent = Math.max(
        50,
        Math.min(100, Number(body.uptimePercent))
      );
    }

    if (body.ticketsTotal !== undefined) {
      updates.ticketsTotal = Math.max(1, Number(body.ticketsTotal) || 1);
    }

    if (body.ticketsResolved !== undefined) {
      updates.ticketsResolved = Math.max(0, Number(body.ticketsResolved));
    }

    const [updated] = await db
      .update(siteOperations)
      .set(updates)
      .where(eq(siteOperations.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "السجل غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ operation: updated });
  } catch (error) {
    console.error("PATCH /api/operations/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر تحديث سجل الموقع" },
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
      .delete(siteOperations)
      .where(eq(siteOperations.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "السجل غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/operations/[id] error:", error);
    return NextResponse.json(
      { error: "تعذر حذف سجل الموقع" },
      { status: 500 }
    );
  }
}
