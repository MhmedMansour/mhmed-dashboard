import { db } from "@/db";
import {
  certificates,
  engineeringFiles,
  generalInfo,
  haramDocuments,
  haramTasks,
  projects,
  siteOperations,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { annotateFileContent } from "@/lib/fileStorage";

export const SHARE_RESOURCE_TYPES = [
  "engineering_file",
  "general_info",
  "haram_document",
  "project",
  "haram_task",
  "certificate",
  "operation",
] as const;

export type ShareResourceType = (typeof SHARE_RESOURCE_TYPES)[number];

export interface ShareFileItem {
  id: number;
  kind: "engineering_file" | "general_info" | "haram_document";
  fileName: string;
  mimeType: string | null;
  sizeFormatted: string | null;
  uploadedDate?: string;
  previewUrl: string;
  downloadUrl: string;
  hasContent: boolean;
}

export interface ResolvedShare {
  resourceType: ShareResourceType;
  resourceId: number;
  title: string;
  subtitle: string | null;
  details: Array<{ label: string; value: string }>;
  isFile: boolean;
  fileName: string | null;
  mimeType: string | null;
  sizeFormatted: string | null;
  files: ShareFileItem[];
}

function isFileType(t: string): boolean {
  return t === "engineering_file" || t === "general_info" || t === "haram_document";
}

export function makeToken(): string {
  return randomBytes(24).toString("base64url");
}

export function shareFileUrls(token: string, fileId: number, kind: ShareFileItem["kind"]) {
  const base =
    kind === "engineering_file"
      ? `/api/files/${fileId}`
      : kind === "general_info"
      ? `/api/general-info/${fileId}`
      : `/api/haram-documents/${fileId}`;
  return {
    previewUrl: `${base}/preview`,
    // Direct backend URLs keep working for Save-to-Drive even without the token page.
    downloadUrl: `${base}/download`,
    tokenPreviewUrl: `/api/share/${token}/file?fileId=${fileId}`,
    tokenDownloadUrl: `/api/share/${token}/file?fileId=${fileId}&download=1`,
  };
}

export async function resolveShareResource(
  resourceType: string,
  resourceId: number
): Promise<ResolvedShare | null> {
  if (!SHARE_RESOURCE_TYPES.includes(resourceType as ShareResourceType)) return null;

  if (resourceType === "engineering_file") {
    const [f] = await db
      .select()
      .from(engineeringFiles)
      .where(eq(engineeringFiles.id, resourceId))
      .limit(1);
    if (!f) return null;
    const [annotated] = await annotateFileContent([f]);
    return {
      resourceType: "engineering_file",
      resourceId: f.id,
      title: f.fileName,
      subtitle: f.projectTitle,
      details: [
        { label: "الحجم", value: f.sizeFormatted },
        { label: "النوع", value: (f.mimeType || f.extension || "").toString() },
        { label: "تاريخ الرفع", value: f.uploadedDate },
      ],
      isFile: true,
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeFormatted: f.sizeFormatted,
      files: [
        {
          id: f.id,
          kind: "engineering_file",
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeFormatted: f.sizeFormatted,
          uploadedDate: f.uploadedDate,
          previewUrl: `/api/files/${f.id}/preview`,
          downloadUrl: `/api/files/${f.id}/download`,
          hasContent: annotated?.hasContent ?? false,
        },
      ],
    };
  }

  if (resourceType === "general_info") {
    const [g] = await db
      .select()
      .from(generalInfo)
      .where(eq(generalInfo.id, resourceId))
      .limit(1);
    if (!g) return null;
    const hasFile = Boolean(g.storagePath && g.fileName);
    return {
      resourceType: "general_info",
      resourceId: g.id,
      title: g.title,
      subtitle: g.description,
      details: [
        ...(g.fileName ? [{ label: "الملف", value: g.fileName }] : []),
        ...(g.sizeFormatted ? [{ label: "الحجم", value: g.sizeFormatted }] : []),
        ...(g.description ? [{ label: "الوصف", value: g.description }] : []),
      ],
      isFile: hasFile,
      fileName: g.fileName,
      mimeType: g.mimeType,
      sizeFormatted: g.sizeFormatted,
      files: hasFile
        ? [
            {
              id: g.id,
              kind: "general_info",
              fileName: g.fileName as string,
              mimeType: g.mimeType,
              sizeFormatted: g.sizeFormatted,
              previewUrl: `/api/general-info/${g.id}/preview`,
              downloadUrl: `/api/general-info/${g.id}/preview`,
              hasContent: true,
            },
          ]
        : [],
    };
  }

  if (resourceType === "haram_document") {
    const [h] = await db
      .select()
      .from(haramDocuments)
      .where(eq(haramDocuments.id, resourceId))
      .limit(1);
    if (!h) return null;
    const hasFile = Boolean(h.storagePath && h.fileName);
    return {
      resourceType: "haram_document",
      resourceId: h.id,
      title: h.title,
      subtitle: h.holderName,
      details: [
        ...(h.holderName ? [{ label: "صاحب البطاقة", value: h.holderName }] : []),
        ...(h.roleTitle ? [{ label: "الصفة", value: h.roleTitle }] : []),
        ...(h.organization ? [{ label: "الجهة", value: h.organization }] : []),
        ...(h.projectTitle ? [{ label: "المشروع", value: h.projectTitle }] : []),
        ...(h.contactNumber ? [{ label: "تواصل", value: h.contactNumber }] : []),
        ...(h.cardNote ? [{ label: "ملاحظات", value: h.cardNote }] : []),
      ],
      isFile: hasFile,
      fileName: h.fileName,
      mimeType: h.mimeType,
      sizeFormatted: h.sizeFormatted,
      files: hasFile
        ? [
            {
              id: h.id,
              kind: "haram_document",
              fileName: h.fileName as string,
              mimeType: h.mimeType,
              sizeFormatted: h.sizeFormatted,
              previewUrl: `/api/haram-documents/${h.id}/preview`,
              downloadUrl: `/api/haram-documents/${h.id}/preview`,
              hasContent: true,
            },
          ]
        : [],
    };
  }

  if (resourceType === "project") {
    const [p] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, resourceId))
      .limit(1);
    if (!p) return null;
    const rows = await db
      .select()
      .from(engineeringFiles)
      .where(eq(engineeringFiles.projectId, p.id))
      .orderBy(desc(engineeringFiles.id));
    const annotated = await annotateFileContent(rows);
    return {
      resourceType: "project",
      resourceId: p.id,
      title: p.title,
      subtitle: p.clientOrSite,
      details: [
        { label: "الكود", value: p.code },
        { label: "العميل / الموقع", value: p.clientOrSite },
        { label: "التخصص", value: p.discipline },
        { label: "البرنامج", value: p.software },
        { label: "الحالة", value: p.status },
        { label: "نسبة الإنجاز", value: `${p.progress}%` },
      ],
      isFile: false,
      fileName: null,
      mimeType: null,
      sizeFormatted: null,
      files: annotated.map((f) => ({
        id: f.id,
        kind: "engineering_file" as const,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeFormatted: f.sizeFormatted,
        uploadedDate: f.uploadedDate,
        previewUrl: `/api/files/${f.id}/preview`,
        downloadUrl: `/api/files/${f.id}/download`,
        hasContent: f.hasContent,
      })),
    };
  }

  if (resourceType === "haram_task") {
    const [t] = await db
      .select()
      .from(haramTasks)
      .where(eq(haramTasks.id, resourceId))
      .limit(1);
    if (!t) return null;
    const rows = await db
      .select()
      .from(engineeringFiles)
      .where(eq(engineeringFiles.haramTaskId, t.id))
      .orderBy(desc(engineeringFiles.id));
    const annotated = await annotateFileContent(rows);
    return {
      resourceType: "haram_task",
      resourceId: t.id,
      title: t.title,
      subtitle: t.location,
      details: [
        ...(t.taskNo ? [{ label: "رقم المهمة", value: t.taskNo }] : []),
        ...(t.location ? [{ label: "الموقع", value: t.location }] : []),
        ...(t.requestedBy ? [{ label: "الجهة الطالبة", value: t.requestedBy }] : []),
        { label: "الحالة", value: t.status },
        ...(t.startDate ? [{ label: "البدء", value: t.startDate }] : []),
        ...(t.endDate ? [{ label: "الانتهاء", value: t.endDate }] : []),
        ...(t.description ? [{ label: "الوصف", value: t.description }] : []),
      ],
      isFile: false,
      fileName: null,
      mimeType: null,
      sizeFormatted: null,
      files: annotated.map((f) => ({
        id: f.id,
        kind: "engineering_file" as const,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeFormatted: f.sizeFormatted,
        uploadedDate: f.uploadedDate,
        previewUrl: `/api/files/${f.id}/preview`,
        downloadUrl: `/api/files/${f.id}/download`,
        hasContent: f.hasContent,
      })),
    };
  }

  if (resourceType === "certificate") {
    const [c] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, resourceId))
      .limit(1);
    if (!c) return null;
    const rows = await db
      .select()
      .from(engineeringFiles)
      .where(eq(engineeringFiles.certificateId, c.id))
      .orderBy(desc(engineeringFiles.id));
    const annotated = await annotateFileContent(rows);
    return {
      resourceType: "certificate",
      resourceId: c.id,
      title: c.title,
      subtitle: c.issuer,
      details: [
        { label: "الجهة المانحة", value: c.issuer },
        { label: "التصنيف", value: c.category },
        { label: "الكود", value: c.credentialCode },
        { label: "تاريخ الإصدار", value: c.issueDate },
        ...(c.expiryDate ? [{ label: "الصلاحية", value: c.expiryDate }] : []),
        ...(c.highlights ? [{ label: "أبرز النقاط", value: c.highlights }] : []),
      ],
      isFile: false,
      fileName: null,
      mimeType: null,
      sizeFormatted: null,
      files: annotated.map((f) => ({
        id: f.id,
        kind: "engineering_file" as const,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeFormatted: f.sizeFormatted,
        uploadedDate: f.uploadedDate,
        previewUrl: `/api/files/${f.id}/preview`,
        downloadUrl: `/api/files/${f.id}/download`,
        hasContent: f.hasContent,
      })),
    };
  }

  // operation
  const [o] = await db
    .select()
    .from(siteOperations)
    .where(eq(siteOperations.id, resourceId))
    .limit(1);
  if (!o) return null;
  return {
    resourceType: "operation",
    resourceId: o.id,
    title: o.siteName,
    subtitle: o.roleTitle,
    details: [
      { label: "الدور", value: o.roleTitle },
      { label: "نوع العملية", value: o.operationType },
      { label: "الفئة", value: o.systemCategory },
      ...(o.projectName ? [{ label: "المشروع", value: o.projectName }] : []),
      { label: "الحالة", value: o.siteStatus },
      { label: "الإنجاز", value: `${o.uptimePercent}%` },
      ...(o.notes ? [{ label: "ملاحظات", value: o.notes }] : []),
    ],
    isFile: false,
    fileName: null,
    mimeType: null,
    sizeFormatted: null,
    files: [],
  };
}

export function isShareFileType(t: string): boolean {
  return isFileType(t);
}
