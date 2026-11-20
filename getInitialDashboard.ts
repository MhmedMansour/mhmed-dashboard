import { db } from "@/db";
import {
  projects,
  siteOperations,
  certificates,
  engineeringFiles,
  telemetrySnapshots,
  engineerProfile,
  cvExperiences,
  generalInfo,
} from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { formatBytes, SegmentKey } from "@/lib/engineering";
import { annotateFileContent } from "@/lib/fileStorage";
import { DashboardPayload } from "@/components/DashboardClient";
import { desc, asc } from "drizzle-orm";

export async function getInitialDashboard(): Promise<DashboardPayload> {
  await ensureSeeded();

  const [
    allProjects,
    allOperations,
    allCertificates,
    allFiles,
    allTelemetry,
    profiles,
  ] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.id)),
    db.select().from(siteOperations).orderBy(desc(siteOperations.id)),
    db.select().from(certificates).orderBy(desc(certificates.id)),
    db.select().from(engineeringFiles).orderBy(desc(engineeringFiles.id)),
    db.select().from(telemetrySnapshots).orderBy(asc(telemetrySnapshots.periodDate)),
    db.select().from(engineerProfile).limit(1),
  ]);

  const [expRows, infoRows] = await Promise.all([
    db.select().from(cvExperiences).orderBy(asc(cvExperiences.sortOrder)),
    db.select().from(generalInfo).orderBy(desc(generalInfo.id)),
  ]);

  const projectFileStats: Record<
    string,
    { count: number; sizeBytes: number; sizeFormatted: string }
  > = {};
  for (const f of allFiles) {
    if (f.projectId == null) continue;
    const key = String(f.projectId);
    if (!projectFileStats[key]) {
      projectFileStats[key] = { count: 0, sizeBytes: 0, sizeFormatted: "0 MB" };
    }
    projectFileStats[key].count += 1;
    projectFileStats[key].sizeBytes += Number(f.sizeBytes || 0);
  }
  for (const key of Object.keys(projectFileStats)) {
    projectFileStats[key].sizeFormatted = formatBytes(
      projectFileStats[key].sizeBytes
    );
  }

  const activeParallelProjects = allProjects.filter(
    (p) => p.status === "in_progress" || p.status === "review"
  ).length;

  const avgProgress =
    allProjects.length > 0
      ? Math.round(
          allProjects.reduce((acc, p) => acc + p.progress, 0) /
            allProjects.length
        )
      : 0;

  const totalSheetsProduced = allProjects.reduce(
    (acc, p) => acc + p.sheetsCount,
    0
  );
  const totalHoursLogged = allProjects.reduce(
    (acc, p) => acc + p.hoursLogged,
    0
  );

  const avgOmUptime =
    allOperations.length > 0
      ? Number(
          (
            allOperations.reduce((acc, op) => acc + op.uptimePercent, 0) /
            allOperations.length
          ).toFixed(1)
        )
      : 98.0;

  const activeSitesCount = allOperations.filter(
    (op) => op.siteStatus === "active_site"
  ).length;

  const ticketsResolvedSum = allOperations.reduce(
    (acc, op) => acc + op.ticketsResolved,
    0
  );
  const ticketsTotalSum = allOperations.reduce(
    (acc, op) => acc + op.ticketsTotal,
    0
  );

  const totalVaultBytes = allFiles.reduce(
    (acc, f) => acc + Number(f.sizeBytes || 0),
    0
  );
  const readySamplesCount =
    allProjects.filter((p) => p.isSample).length +
    allFiles.filter((f) => f.isClientSample).length;

  const monthlyRows = allTelemetry.filter((t) => t.granularity === "monthly");
  const lineSeries = monthlyRows.map((point) => ({
    label: point.label,
    periodDate: point.periodDate,
    autocad: point.autocadSheets,
    revit: point.revitModels,
    om: point.omTasks,
    totalOutput: point.autocadSheets + point.revitModels + point.omTasks,
    hoursLogged: point.hoursLogged,
    efficiencyRate: point.efficiencyRate,
  }));

  const workstreams: Array<{
    key: SegmentKey;
    label: string;
    shortLabel: string;
  }> = [
    { key: "autocad", label: "رسومات أوتوكاد AutoCAD", shortLabel: "أوتوكاد" },
    { key: "revit", label: "نمذجة ريفيت Revit BIM", shortLabel: "ريفيت BIM" },
    { key: "om", label: "التشغيل والصيانة O&M", shortLabel: "تشغيل وصيانة" },
    { key: "parallel", label: "مشاريع متوازية", shortLabel: "مهام متوازية" },
    { key: "certificates", label: "شهادات وعينات", shortLabel: "شهادات وعينات" },
  ];

  const barSeries = workstreams.map((ws) => {
    if (ws.key === "certificates") {
      const certsCount = allCertificates.length;
      const samplesCount = allFiles.filter((f) => f.isClientSample).length;
      return {
        key: ws.key,
        label: ws.label,
        shortLabel: ws.shortLabel,
        inProgress: samplesCount,
        completed: certsCount,
        review: 2,
        total: certsCount + samplesCount + 2,
        hours: (certsCount + samplesCount) * 14,
      };
    }
    const matching = allProjects.filter((p) => p.segment === ws.key);
    const inProgress = matching.filter((p) => p.status === "in_progress").length;
    const completed = matching.filter((p) => p.status === "completed").length;
    const review = matching.filter(
      (p) => p.status === "review" || p.status === "on_hold"
    ).length;
    const hours = matching.reduce((acc, p) => acc + p.hoursLogged, 0);
    const omExtra = ws.key === "om" ? allOperations.length : 0;

    return {
      key: ws.key,
      label: ws.label,
      shortLabel: ws.shortLabel,
      inProgress: inProgress + Math.ceil(omExtra / 2),
      completed: completed + Math.floor(omExtra / 2),
      review,
      total: inProgress + completed + review + omExtra,
      hours: hours + omExtra * 18,
    };
  });

  const formatBuckets: Array<{
    key: string;
    label: string;
    extensions: string;
    color: string;
    segmentLink: SegmentKey;
  }> = [
    {
      key: "revit_bim",
      label: "نماذج Revit & BIM",
      extensions: ".RVT / .IFC / .NWD / .RFA",
      color: "#6366F1",
      segmentLink: "revit",
    },
    {
      key: "autocad",
      label: "رسومات AutoCAD",
      extensions: ".DWG / .DXF",
      color: "#2563EB",
      segmentLink: "autocad",
    },
    {
      key: "documents_pdf",
      label: "مستندات ولوحات PDF",
      extensions: ".PDF / .DOCX / .TXT",
      color: "#0D9488",
      segmentLink: "om",
    },
    {
      key: "images",
      label: "صور ومرئيات بصرية",
      extensions: ".PNG / .JPG / .SVG / .WEBP",
      color: "#EC4899",
      segmentLink: "all",
    },
    {
      key: "archives_other",
      label: "أرشيف وحصر كميات",
      extensions: ".ZIP / .XLSX / أخرى",
      color: "#D97706",
      segmentLink: "all",
    },
  ];

  const donutTotalCount = allFiles.length || 1;
  const donutSeries = formatBuckets.map((bucket) => {
    const matched = allFiles.filter((f) => f.formatGroup === bucket.key);
    const bytes = matched.reduce((acc, f) => acc + Number(f.sizeBytes || 0), 0);
    const countVal = matched.length;
    return {
      key: bucket.key,
      label: bucket.label,
      extensions: bucket.extensions,
      color: bucket.color,
      segmentLink: bucket.segmentLink,
      count: countVal,
      sizeBytes: bytes,
      sizeFormatted: formatBytes(bytes),
      percentage: Math.round((countVal / donutTotalCount) * 100),
    };
  });

  return {
    profile: profiles[0] || null,
    cvExperiences: expRows,
    generalInfo: infoRows,
    projectFileStats,
    filters: {
      range: "all",
      segment: "all",
      search: "",
      samplesOnly: false,
    },
    kpis: {
      activeProjects: {
        value: activeParallelProjects,
        totalProjects: allProjects.length,
        avgProgress,
        trend: "+34.5%",
      },
      sheetsAndModels: {
        value: totalSheetsProduced,
        hoursLogged: totalHoursLogged,
        trend: "+52.0%",
      },
      omEfficiency: {
        value: avgOmUptime,
        activeSites: activeSitesCount,
        totalSites: allOperations.length,
        ticketsResolved: ticketsResolvedSum,
        ticketsTotal: ticketsTotalSum,
        trend: "+6.2%",
      },
      vaultAndSamples: {
        fileCount: allFiles.length,
        totalSizeFormatted: formatBytes(totalVaultBytes),
        totalSizeBytes: totalVaultBytes,
        readySamples: readySamplesCount,
        certificatesCount: allCertificates.length,
        trend: "مجاني بالكامل ∞",
      },
    },
    lineSeries,
    barSeries,
    donutSeries,
    projects: allProjects,
    siteOperations: allOperations,
    certificates: allCertificates,
    certificateFiles: await annotateFileContent(
      allFiles.filter((f) => f.certificateId != null)
    ),
    files: await annotateFileContent(allFiles),
  };
}
