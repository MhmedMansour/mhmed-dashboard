import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates, engineeringFiles, haramTasks, projects } from "@/db/schema";
import {
  classifyFileFormat,
  formatBytes,
  normalizeExtension,
} from "@/lib/engineering";
import { eq, desc, isNotNull } from "drizzle-orm";
import {
  hasRecoverableBytes,
  listOwnersWithBlobs,
  saveFileBlob,
} from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPid = searchParams.get("projectId");
    const pid = rawPid ? Number(rawPid) : NaN;
    const rawCid = searchParams.get("certificateId");
    const cid = rawCid && rawCid !== "all" ? Number(rawCid) : NaN;
    const allCertificates = rawCid === "all";
    const rawHid = searchParams.get("haramTaskId");
    const hid = rawHid ? Number(rawHid) : NaN;

    const rows =
      Number.isInteger(hid) && hid > 0
        ? await db.select().from(engineeringFiles).where(eq(engineeringFiles.haramTaskId, hid)).orderBy(desc(engineeringFiles.id))
        : Number.isInteger(pid) && pid > 0
        ? await db.select().from(engineeringFiles).where(eq(engineeringFiles.projectId, pid)).orderBy(desc(engineeringFiles.id))
        : Number.isInteger(cid) && cid > 0
        ? await db.select().from(engineeringFiles).where(eq(engineeringFiles.certificateId, cid)).orderBy(desc(engineeringFiles.id))
        : allCertificates
        ? await db.select().from(engineeringFiles).where(isNotNull(engineeringFiles.certificateId)).orderBy(desc(engineeringFiles.id))
        : await db.select().from(engineeringFiles).orderBy(desc(engineeringFiles.id));

    const withBlob = await listOwnersWithBlobs(
      "engineering_file",
      rows.map((row) => row.id)
    );
    const files = rows.map((row) => ({
      ...row,
      hasContent: hasRecoverableBytes(row.storagePath, withBlob.has(row.id)),
    }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("GET /api/files error:", error);
    return NextResponse.json(
      { error: "تعذر تحميل الملفات" },
      { status: 500 }
    );
  }
}

async function findLinkedProject(rawId: unknown) {
  const pid = Number(rawId);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const [proj] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, pid))
    .limit(1);
  return proj || null;
}

async function findLinkedCertificate(rawId: unknown) {
  const cid = Number(rawId);
  if (!Number.isInteger(cid) || cid <= 0) return null;
  const [cert] = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, cid))
    .limit(1);
  return cert || null;
}

async function findLinkedHaramTask(rawId: unknown) {
  const hid = Number(rawId);
  if (!Number.isInteger(hid) || hid <= 0) return null;
  const [task] = await db
    .select()
    .from(haramTasks)
    .where(eq(haramTasks.id, hid))
    .limit(1);
  return task || null;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const uploadedFiles = formData.getAll("files");
      const singleFile = formData.get("file");

      const fileList: File[] = [];
      for (const item of uploadedFiles) {
        if (item instanceof File && item.name) {
          fileList.push(item);
        }
      }
      if (fileList.length === 0 && singleFile instanceof File && singleFile.name) {
        fileList.push(singleFile);
      }

      if (fileList.length === 0) {
        return NextResponse.json(
          { error: "يرجى اختيار ملف واحد على الأقل للرفع" },
          { status: 400 }
        );
      }

      const linkedProject = await findLinkedProject(formData.get("projectId"));
      const linkedCertificate = await findLinkedCertificate(formData.get("certificateId"));
      const linkedHaramTask = await findLinkedHaramTask(formData.get("haramTaskId"));
      const requestedSegment = String(formData.get("segment") || "auto");
      const projectTitle = String(formData.get("projectTitle") || "").trim() || null;
      const isClientSample = formData.get("isClientSample") === "true";
      const sampleNote = String(formData.get("sampleNote") || "").trim() || null;
      const customExt = String(formData.get("customExtension") || "").trim();

      const insertedRecords = [];

      for (const f of fileList) {
        const ext = customExt
          ? normalizeExtension(customExt)
          : normalizeExtension(f.name);
        const classification = classifyFileFormat(ext);

        const segment =
          requestedSegment !== "auto" &&
          ["autocad", "revit", "om", "certificates", "samples", "haram"].includes(
            requestedSegment
          )
            ? requestedSegment
            : linkedHaramTask
            ? "haram"
            : linkedCertificate
            ? "certificates"
            : linkedProject?.segment || classification.suggestedSegment;

        const arrayBuffer = await f.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = f.type || "application/octet-stream";

        const sizeBytes = buffer.byteLength;
        const sizeFormatted = formatBytes(sizeBytes);

        const [created] = await db
          .insert(engineeringFiles)
          .values({
            fileName: f.name,
            extension: ext,
            formatGroup: classification.formatGroup,
            sizeBytes,
            sizeFormatted,
            segment,
            projectId: linkedCertificate || linkedHaramTask ? null : linkedProject?.id ?? null,
            certificateId: linkedCertificate?.id ?? null,
            haramTaskId: linkedHaramTask?.id ?? null,
            projectTitle:
              (linkedHaramTask ? `مهمة الحرم: ${linkedHaramTask.title}` : null) ||
              linkedCertificate?.title ||
              linkedProject?.title ||
              projectTitle ||
              classification.labelAr,
            isClientSample,
            sampleNote:
              sampleNote ||
              (isClientSample ? "عينة عمل مرفوعة حديثاً وجاهزة للعرض" : null),
            storagePath: null,
            mimeType,
            uploadedDate: new Date().toISOString().split("T")[0],
            downloadsCount: 0,
          })
          .returning();

        // Persist the bytes in PostgreSQL so previews/downloads survive restarts.
        const storagePath = await saveFileBlob(
          "engineering_file",
          created.id,
          buffer,
          mimeType
        );
        const [stored] = await db
          .update(engineeringFiles)
          .set({ storagePath })
          .where(eq(engineeringFiles.id, created.id))
          .returning();

        insertedRecords.push({ ...(stored || created), hasContent: true });
      }

      return NextResponse.json(
        {
          files: insertedRecords,
          file: insertedRecords[0],
        },
        { status: 201 }
      );
    }

    // JSON mode: register large multi-GB archives of any format & size,
    // optionally linked to an existing project in the master register.
    const body = await request.json();
    const rawName = String(body.fileName || "").trim();
    if (!rawName) {
      return NextResponse.json(
        { error: "يرجى إدخال اسم الملف أو الحزمة الهندسية" },
        { status: 400 }
      );
    }

    const linkedProject = await findLinkedProject(body.projectId);
    const linkedCertificate = await findLinkedCertificate(body.certificateId);
    const ext = body.extension
      ? normalizeExtension(String(body.extension))
      : normalizeExtension(rawName);
    const fileName = rawName.includes(".") ? rawName : `${rawName}${ext}`;
    const classification = classifyFileFormat(ext);

    const sizeNum = Math.max(0.01, Number(body.sizeValue) || 120);
    const unit = String(body.sizeUnit || "MB").toUpperCase();
    const multiplier =
      unit === "TB"
        ? 1024 ** 4
        : unit === "GB"
        ? 1024 ** 3
        : unit === "KB"
        ? 1024
        : 1024 ** 2;
    const sizeBytes = Math.round(sizeNum * multiplier);
    const sizeFormatted = formatBytes(sizeBytes);

    const segment = ["autocad", "revit", "om", "certificates", "samples"].includes(
      body.segment
    )
      ? body.segment
      : linkedCertificate
      ? "certificates"
      : linkedProject?.segment || classification.suggestedSegment;

    const [created] = await db
      .insert(engineeringFiles)
      .values({
        fileName,
        extension: ext,
        formatGroup: classification.formatGroup,
        sizeBytes,
        sizeFormatted,
        segment,
        projectId: linkedCertificate ? null : linkedProject?.id ?? null,
        certificateId: linkedCertificate?.id ?? null,
        projectTitle:
          linkedCertificate?.title ||
          linkedProject?.title ||
          (body.projectTitle
            ? String(body.projectTitle).trim()
            : classification.labelAr),
        isClientSample: Boolean(body.isClientSample),
        sampleNote: body.sampleNote ? String(body.sampleNote).trim() : null,
        storagePath: body.storagePath
          ? String(body.storagePath).trim()
          : `workstation://Vault/${fileName}`,
        mimeType: "application/octet-stream",
        uploadedDate: new Date().toISOString().split("T")[0],
        downloadsCount: 0,
      })
      .returning();

    return NextResponse.json({ file: created, files: [created] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/files error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء رفع أو تسجيل الملف" },
      { status: 500 }
    );
  }
}
