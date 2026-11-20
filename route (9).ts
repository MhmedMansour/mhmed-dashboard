import { NextRequest, NextResponse } from "next/server";
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
import {
  DateRangeKey,
  SegmentKey,
  formatBytes,
  getCutoffDate,
} from "@/lib/engineering";
import { annotateFileContent } from "@/lib/fileStorage";
import { desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "all") as DateRangeKey;
    const segment = (searchParams.get("segment") || "all") as SegmentKey;
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const samplesOnly = searchParams.get("samplesOnly") === "true";

    const cutoffDate = getCutoffDate(range);

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

    // Per-project attachment stats (always unfiltered so the register is accurate)
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

    const matchesSearch = (fields: Array<string | null | undefined>) => {
      if (!search) return true;
      return fields.some((f) => (f || "").toLowerCase().includes(search));
    };

    // Filter Projects
    const filteredProjects = allProjects.filter((p) => {
      if (cutoffDate && p.dueDate < cutoffDate) return false;
      if (segment !== "all") {
        if (segment === "parallel") {
          if (p.status !== "in_progress" && p.segment !== "parallel") return false;
        } else if (segment === "certificates") {
          return false;
        } else if (p.segment !== segment) {
          return false;
        }
      }
      if (samplesOnly && !p.isSample) return false;
      return matchesSearch([
        p.code,
        p.title,
        p.clientOrSite,
        p.discipline,
        p.software,
        p.location,
        p.sampleSummary,
      ]);
    });

    // Filter Site Operations
    const filteredOperations = allOperations.filter((op) => {
      if (cutoffDate && op.loggedDate < cutoffDate) return false;
      if (segment !== "all" && segment !== "om" && segment !== "parallel") {
        return false;
      }
      if (segment === "parallel" && op.siteStatus !== "active_site") {
        return false;
      }
      return matchesSearch([
        op.siteName,
        op.roleTitle,
        op.systemCategory,
        op.operationType,
        op.notes,
        op.periodLabel,
      ]);
    });

    // Filter Certificates
    const filteredCertificates = allCertificates.filter((cert) => {
      if (segment !== "all" && segment !== "certificates") {
        if (segment === "autocad" || segment === "revit") {
          if (cert.category !== "cad_bim") return false;
        } else if (segment === "om") {
          if (cert.category !== "om_facility" && cert.category !== "safety_pm") {
            return false;
          }
        } else {
          return false;
        }
      }
      return matchesSearch([
        cert.title,
        cert.issuer,
        cert.credentialCode,
        cert.highlights,
      ]);
    });

    // Filter Engineering Files
    const filteredFiles = allFiles.filter((file) => {
      if (cutoffDate && file.uploadedDate < cutoffDate) return false;
      if (segment !== "all") {
        if (segment === "parallel") {
          // include active project files
        } else if (file.segment !== segment) {
          return false;
        }
      }
      if (samplesOnly && !file.isClientSample) return false;
      return matchesSearch([
        file.fileName,
        file.extension,
        file.projectTitle,
        file.sampleNote,
        file.segment,
      ]);
    });

    // Compute KPI Summary Cards
    const activeParallelProjects = filteredProjects.filter(
      (p) => p.status === "in_progress" || p.status === "review"
    ).length;

    const avgProgress =
      filteredProjects.length > 0
        ? Math.round(
            filteredProjects.reduce((acc, p) => acc + p.progress, 0) /
              filteredProjects.length
          )
        : 0;

    const totalSheetsProduced = filteredProjects.reduce(
      (acc, p) => acc + p.sheetsCount,
      0
    );

    const totalHoursLogged = filteredProjects.reduce(
      (acc, p) => acc + p.hoursLogged,
      0
    );

    const omOpsForKpi =
      filteredOperations.length > 0 ? filteredOperations : allOperations;
    const avgOmUptime =
      omOpsForKpi.length > 0
        ? Number(
            (
              omOpsForKpi.reduce((acc, op) => acc + op.uptimePercent, 0) /
              omOpsForKpi.length
            ).toFixed(1)
          )
        : 98.0;

    const activeSitesCount = omOpsForKpi.filter(
      (op) => op.siteStatus === "active_site"
    ).length;

    const ticketsResolvedSum = omOpsForKpi.reduce(
      (acc, op) => acc + op.ticketsResolved,
      0
    );
    const ticketsTotalSum = omOpsForKpi.reduce(
      (acc, op) => acc + op.ticketsTotal,
      0
    );

    const totalVaultBytes = filteredFiles.reduce(
      (acc, f) => acc + Number(f.sizeBytes || 0),
      0
    );
    const readySamplesCount =
      filteredProjects.filter((p) => p.isSample).length +
      filteredFiles.filter((f) => f.isClientSample).length;

    const trendMap: Record<
      DateRangeKey,
      { projects: string; sheets: string; om: string; files: string }
    > = {
      "7d": {
        projects: "+18.4%",
        sheets: "+26.0%",
        om: "+2.4%",
        files: "+5 ملفات جديدة",
      },
      "30d": {
        projects: "+14.2%",
        sheets: "+22.5%",
        om: "+3.8%",
        files: "+8 ملفات جديدة",
      },
      "90d": {
        projects: "+19.6%",
        sheets: "+31.2%",
        om: "+4.5%",
        files: "+11 ملفات جديدة",
      },
      "1y": {
        projects: "+28.0%",
        sheets: "+44.8%",
        om: "+5.1%",
        files: "غير محدود ∞",
      },
      all: {
        projects: "+34.5%",
        sheets: "+52.0%",
        om: "+6.2%",
        files: "مجاني بالكامل ∞",
      },
    };

    // Build Line Chart Series based on range & segment
    const dailyRows = allTelemetry.filter((t) => t.granularity === "daily");
    const monthlyRows = allTelemetry.filter((t) => t.granularity === "monthly");

    let chosenTelemetry = monthlyRows;
    if (range === "7d") {
      chosenTelemetry = dailyRows.slice(-7);
    } else if (range === "30d") {
      chosenTelemetry = dailyRows;
    } else if (range === "90d") {
      chosenTelemetry = monthlyRows.slice(-4);
    } else {
      chosenTelemetry = monthlyRows;
    }

    // Add subtle dynamic boost from newly added projects beyond seed count (11)
    const extraProjectsCount = Math.max(0, allProjects.length - 11);
    const extraFilesCount = Math.max(0, allFiles.length - 12);

    const lineSeries = chosenTelemetry.map((point, idx) => {
      const isLast = idx === chosenTelemetry.length - 1;
      const cadBoost = isLast ? extraProjectsCount * 4 : 0;
      const rvtBoost = isLast ? extraProjectsCount * 3 : 0;
      const omBoost = isLast ? Math.max(0, allOperations.length - 6) * 3 : 0;

      const autocad =
        segment === "revit" || segment === "om" || segment === "certificates"
          ? 0
          : point.autocadSheets + cadBoost;
      const revit =
        segment === "autocad" || segment === "om" || segment === "certificates"
          ? 0
          : point.revitModels + rvtBoost;
      const om =
        segment === "autocad" || segment === "revit" || segment === "certificates"
          ? 0
          : point.omTasks + omBoost;

      return {
        label: point.label,
        periodDate: point.periodDate,
        autocad,
        revit,
        om,
        totalOutput: autocad + revit + om,
        hoursLogged: point.hoursLogged + (isLast ? extraFilesCount * 2 : 0),
        efficiencyRate: point.efficiencyRate,
      };
    });

    // Build Grouped/Stacked Bar Chart Series across Engineering Workstreams
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
        const certsCount = filteredCertificates.length;
        const samplesCount = filteredFiles.filter((f) => f.isClientSample).length;
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

      const matching = filteredProjects.filter((p) => p.segment === ws.key);
      const inProgress = matching.filter((p) => p.status === "in_progress").length;
      const completed = matching.filter((p) => p.status === "completed").length;
      const review = matching.filter(
        (p) => p.status === "review" || p.status === "on_hold"
      ).length;
      const hours = matching.reduce((acc, p) => acc + p.hoursLogged, 0);

      // Add O&M site operations count to the O&M bar so it reflects site logs live
      const omExtra = ws.key === "om" ? filteredOperations.length : 0;

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

    // Build Donut Chart Series (File Formats & Storage Distribution)
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

    const filesForDonut = filteredFiles.length > 0 ? filteredFiles : allFiles;
    const donutTotalCount = filesForDonut.length || 1;

    const donutSeries = formatBuckets.map((bucket) => {
      const matched = filesForDonut.filter((f) => f.formatGroup === bucket.key);
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

    return NextResponse.json({
      profile: profiles[0] || null,
      cvExperiences: expRows,
      generalInfo: infoRows,
      projectFileStats,
      filters: { range, segment, search, samplesOnly },
      kpis: {
        activeProjects: {
          value: activeParallelProjects,
          totalProjects: filteredProjects.length,
          avgProgress,
          trend: trendMap[range].projects,
        },
        sheetsAndModels: {
          value: totalSheetsProduced,
          hoursLogged: totalHoursLogged,
          trend: trendMap[range].sheets,
        },
        omEfficiency: {
          value: avgOmUptime,
          activeSites: activeSitesCount,
          totalSites: omOpsForKpi.length,
          ticketsResolved: ticketsResolvedSum,
          ticketsTotal: ticketsTotalSum,
          trend: trendMap[range].om,
        },
        vaultAndSamples: {
          fileCount: filteredFiles.length,
          totalSizeFormatted: formatBytes(totalVaultBytes),
          totalSizeBytes: totalVaultBytes,
          readySamples: readySamplesCount,
          certificatesCount: filteredCertificates.length,
          trend: trendMap[range].files,
        },
      },
      lineSeries,
      barSeries,
      donutSeries,
      projects: filteredProjects,
      siteOperations: filteredOperations,
      certificates: filteredCertificates,
      certificateFiles: await annotateFileContent(
        allFiles.filter((f) => f.certificateId != null)
      ),
      files: await annotateFileContent(filteredFiles),
    });
  } catch (error) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json(
      { error: "فشل في تحميل بيانات المنصة الهندسية" },
      { status: 500 }
    );
  }
}
