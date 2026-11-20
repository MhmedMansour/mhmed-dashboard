import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  engineerProfile,
  projects,
  siteOperations,
  certificates,
  engineeringFiles,
} from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const isExport = searchParams.get("export") === "true";

    const [profile] = await db.select().from(engineerProfile).limit(1);

    if (isExport) {
      const [allProjects, allOperations, allCertificates, allFiles] =
        await Promise.all([
          db.select().from(projects),
          db.select().from(siteOperations),
          db.select().from(certificates),
          db.select().from(engineeringFiles),
        ]);

      const backupPayload = {
        exportedAt: new Date().toISOString(),
        platform: "MiHwar Engineering Workspace (AutoCAD / Revit / O&M)",
        profile,
        projects: allProjects,
        siteOperations: allOperations,
        certificates: allCertificates,
        files: allFiles,
      };

      return new NextResponse(JSON.stringify(backupPayload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="mihwar-engineering-backup-${
            new Date().toISOString().split("T")[0]
          }.json"`,
        },
      });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET /api/workspace error:", error);
    return NextResponse.json(
      { error: "تعذر تحميل إعدادات مساحة العمل" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const action = String(body.action || "update_profile");

    const existing = await db.select().from(engineerProfile).limit(1);
    const currentId = existing[0]?.id;

    if (action === "start_clean") {
      await db.delete(projects);
      await db.delete(siteOperations);
      await db.delete(certificates);
      await db.delete(engineeringFiles);

      if (currentId) {
        const [updated] = await db
          .update(engineerProfile)
          .set({
            workspaceMode: "clean_empty",
            isActivated: true,
            updatedAt: new Date(),
          })
          .where(eq(engineerProfile.id, currentId))
          .returning();
        return NextResponse.json({ ok: true, profile: updated });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "restore_samples") {
      await db.delete(projects);
      await db.delete(siteOperations);
      await db.delete(certificates);
      await db.delete(engineeringFiles);

      if (currentId) {
        await db
          .update(engineerProfile)
          .set({
            workspaceMode: "live_active",
            isActivated: true,
            updatedAt: new Date(),
          })
          .where(eq(engineerProfile.id, currentId));
      }

      await ensureSeeded(true);
      const [profile] = await db.select().from(engineerProfile).limit(1);
      return NextResponse.json({ ok: true, profile });
    }

    // Default: update_profile
    const fullName =
      String(body.fullName || "").trim() ||
      existing[0]?.fullName ||
      "م. مهندس تصميم وتشغيل";
    const headline =
      String(body.headline || "").trim() ||
      existing[0]?.headline ||
      "مهندس AutoCAD & Revit BIM | تشغيل وصيانة مواقع O&M";

    const values = {
      fullName,
      headline,
      phoneOrWhatsapp:
        body.phoneOrWhatsapp !== undefined
          ? String(body.phoneOrWhatsapp).trim()
          : existing[0]?.phoneOrWhatsapp || "",
      email:
        body.email !== undefined
          ? String(body.email).trim()
          : existing[0]?.email || "",
      city:
        body.city !== undefined
          ? String(body.city).trim()
          : existing[0]?.city || "القاهرة",
      yearsExperience: Math.max(
        0,
        Number(body.yearsExperience ?? existing[0]?.yearsExperience ?? 5)
      ),
      isActivated: true,
      updatedAt: new Date(),
    };

    if (currentId) {
      const [updated] = await db
        .update(engineerProfile)
        .set(values)
        .where(eq(engineerProfile.id, currentId))
        .returning();
      return NextResponse.json({ ok: true, profile: updated });
    } else {
      const [created] = await db
        .insert(engineerProfile)
        .values({ ...values, workspaceMode: "live_active" })
        .returning();
      return NextResponse.json({ ok: true, profile: created });
    }
  } catch (error) {
    console.error("POST /api/workspace error:", error);
    return NextResponse.json(
      { error: "تعذر تفعيل أو تحديث مساحة العمل" },
      { status: 500 }
    );
  }
}
