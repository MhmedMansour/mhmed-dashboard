"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Loader2,
  Printer,
  Filter,
  X,
} from "lucide-react";
import { exportToExcel, exportToPdf, buildSection } from "@/lib/reporting";
import { CollapsibleSection } from "./CollapsibleSection";
import type {
  ProjectRecord,
  SiteOperationRecord,
  CertificateRecord,
  HaramTaskRecord,
  EngineeringFileRecord,
} from "@/db/schema";

const STATUS_AR: Record<string, string> = {
  in_progress: "قيد التنفيذ",
  review: "مراجعة واعتماد",
  completed: "مكتمل ومسلّم",
  on_hold: "متوقف مؤقتاً",
};

const PRIORITY_AR: Record<string, string> = {
  urgent: "عاجل",
  high: "عالية",
  normal: "عادية",
};

const CATEGORY_AR: Record<string, string> = {
  drawing: "رسم ولوحات",
  survey: "رفع مساحي وحصر",
  planning: "تخطيط تشغيلي",
  coordination: "تنسيق ومتابعة",
  operation: "تشغيل ونظافة",
  other: "أعمال أخرى",
};

type RangeKey = "7d" | "30d" | "90d" | "1y" | "all";

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوم",
  "90d": "آخر 90 يوم",
  "1y": "آخر سنة",
  all: "كل الفترات",
};

export function ReportsPanel({
  projects,
  operations,
  certificates,
  haramTasks,
  files,
  activeRange,
}: {
  projects: ProjectRecord[];
  operations: SiteOperationRecord[];
  certificates: CertificateRecord[];
  haramTasks: HaramTaskRecord[];
  files: EngineeringFileRecord[];
  activeRange: RangeKey;
}) {
  const [filterText, setFilterText] = useState("");
  const [includeFiles, setIncludeFiles] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const cutoff = useMemo(() => {
    if (activeRange === "all") return null;
    const days: Record<Exclude<RangeKey, "all">, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };
    const d = new Date();
    d.setDate(d.getDate() - days[activeRange]);
    return d.toISOString().slice(0, 10);
  }, [activeRange]);

  const inRange = useCallback(
    (date: string | null) => !cutoff || !date || date >= cutoff,
    [cutoff]
  );

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const hit = (...vals: Array<string | null | undefined>) =>
      !q || vals.some((v) => (v || "").toLowerCase().includes(q));

    const projectsOut = projects.filter(
      (p) =>
        inRange(p.dueDate) &&
        hit(p.title, p.clientOrSite, p.code, p.discipline, p.location)
    );
    const opsOut = operations.filter(
      (o) =>
        inRange(o.loggedDate) &&
        hit(o.siteName, o.roleTitle, o.systemCategory, o.projectName)
    );
    const certsOut = certificates.filter(
      (c) => inRange(c.issueDate) && hit(c.title, c.issuer, c.credentialCode)
    );
    const tasksOut = haramTasks.filter(
      (t) =>
        (inRange(t.startDate) || inRange(t.endDate)) &&
        hit(t.title, t.location, t.requestedBy, t.description)
    );
    const filesOut = includeFiles
      ? files.filter(
          (f) => inRange(f.uploadedDate) && hit(f.fileName, f.projectTitle)
        )
      : [];

    return { projectsOut, opsOut, certsOut, tasksOut, filesOut };
  }, [projects, operations, certificates, haramTasks, files, filterText, includeFiles, inRange]);

  const meta = (title: string, fileName: string) => ({
    title,
    fileName,
    subtitle: `${RANGE_LABEL[activeRange]} • ${projects.length} مشروع • ${certificates.length} شهادة • ${haramTasks.length} مهمة حرم • ${operations.length} موقع — ${
      filterText ? `فلتر: ${filterText}` : "بدون فلتر"
    }`,
  });

  const projectCols = [
    { header: "الكود", accessor: (r: ProjectRecord) => r.code, width: 16 },
    { header: "المشروع", accessor: (r: ProjectRecord) => r.title, width: 44 },
    { header: "العميل / الموقع", accessor: (r: ProjectRecord) => r.clientOrSite, width: 26 },
    { header: "التخصص", accessor: (r: ProjectRecord) => r.discipline, width: 24 },
    { header: "البرنامج", accessor: (r: ProjectRecord) => r.software, width: 20 },
    { header: "الحالة", accessor: (r: ProjectRecord) => STATUS_AR[r.status] || r.status, width: 14 },
    { header: "الأولوية", accessor: (r: ProjectRecord) => PRIORITY_AR[r.priority] || r.priority, width: 10 },
    { header: "الإنجاز %", accessor: (r: ProjectRecord) => `${r.progress}%`, width: 10 },
    { header: "اللوحات", accessor: (r: ProjectRecord) => r.sheetsCount, width: 9 },
    { header: "الساعات", accessor: (r: ProjectRecord) => r.hoursLogged, width: 9 },
    { header: "المدينة", accessor: (r: ProjectRecord) => r.location, width: 16 },
    { header: "تاريخ التسليم", accessor: (r: ProjectRecord) => r.dueDate, width: 13 },
  ];

  const opCols = [
    { header: "الموقع", accessor: (r: SiteOperationRecord) => r.siteName, width: 26 },
    { header: "المشروع", accessor: (r: SiteOperationRecord) => r.projectName, width: 32 },
    { header: "الدور", accessor: (r: SiteOperationRecord) => r.roleTitle, width: 26 },
    { header: "الأنظمة", accessor: (r: SiteOperationRecord) => r.systemCategory, width: 28 },
    { header: "الحالة", accessor: (r: SiteOperationRecord) => (r.siteStatus === "active_site" ? "موقع حالي" : "خبرة سابقة"), width: 12 },
    { header: "الجاهزية %", accessor: (r: SiteOperationRecord) => `${r.uptimePercent}%`, width: 11 },
    { header: "البلاغات", accessor: (r: SiteOperationRecord) => `${r.ticketsResolved}/${r.ticketsTotal}`, width: 11 },
    { header: "الفترة", accessor: (r: SiteOperationRecord) => r.periodLabel, width: 16 },
  ];

  const certCols = [
    { header: "الشهادة", accessor: (r: CertificateRecord) => r.title, width: 44 },
    { header: "الجهة المانحة", accessor: (r: CertificateRecord) => r.issuer, width: 30 },
    { header: "الكود", accessor: (r: CertificateRecord) => r.credentialCode, width: 18 },
    { header: "التصنيف", accessor: (r: CertificateRecord) => r.category, width: 14 },
    { header: "الإصدار", accessor: (r: CertificateRecord) => r.issueDate, width: 12 },
    { header: "الصلاحية", accessor: (r: CertificateRecord) => r.expiryDate, width: 14 },
  ];

  const taskCols = [
    { header: "الرقم", accessor: (r: HaramTaskRecord) => r.taskNo, width: 8 },
    { header: "المهمة", accessor: (r: HaramTaskRecord) => r.title, width: 44 },
    { header: "التصنيف", accessor: (r: HaramTaskRecord) => CATEGORY_AR[r.category] || r.category, width: 16 },
    { header: "الموقع", accessor: (r: HaramTaskRecord) => r.location, width: 20 },
    { header: "الجهة الطالبة", accessor: (r: HaramTaskRecord) => r.requestedBy, width: 20 },
    { header: "الحالة", accessor: (r: HaramTaskRecord) => STATUS_AR[r.status] || r.status, width: 12 },
    { header: "البدء", accessor: (r: HaramTaskRecord) => r.startDate, width: 11 },
    { header: "الانتهاء", accessor: (r: HaramTaskRecord) => r.endDate, width: 11 },
    { header: "اللوحات", accessor: (r: HaramTaskRecord) => r.sheetsCount, width: 9 },
  ];

  const fileCols = [
    { header: "الملف", accessor: (r: EngineeringFileRecord) => r.fileName, width: 40 },
    { header: "الصيغة", accessor: (r: EngineeringFileRecord) => r.extension, width: 10 },
    { header: "الحجم", accessor: (r: EngineeringFileRecord) => r.sizeFormatted, width: 11 },
    { header: "المشروع", accessor: (r: EngineeringFileRecord) => r.projectTitle, width: 30 },
    { header: "تاريخ الرفع", accessor: (r: EngineeringFileRecord) => r.uploadedDate, width: 12 },
  ];

  const run = (kind: "excel" | "pdf") => {
    setBusy(kind);
    try {
      const sections = [
        buildSection({ heading: "سجل المشاريع", rows: filtered.projectsOut, columns: projectCols }),
        buildSection({ heading: "مهام الحرم النبوي", rows: filtered.tasksOut, columns: taskCols }),
        buildSection({ heading: "سجل التشغيل والصيانة", rows: filtered.opsOut, columns: opCols }),
        buildSection({ heading: "الشهادات والاعتمادات", rows: filtered.certsOut, columns: certCols }),
        ...(includeFiles
          ? [buildSection({ heading: "خزنة الملفات", rows: filtered.filesOut, columns: fileCols })]
          : []),
      ];

      if (kind === "excel") {
        exportToExcel(filtered.projectsOut, projectCols, meta("سجل المشاريع الهندسية", "مِحور-مشاريع"));
        return;
      }
      exportToPdf(sections, meta("التقرير الهندسي الشامل", "مِحور-تقرير-هندسي"));
    } finally {
      setTimeout(() => setBusy(null), 500);
    }
  };

  const totalRows =
    filtered.projectsOut.length +
    filtered.opsOut.length +
    filtered.certsOut.length +
    filtered.tasksOut.length +
    filtered.filesOut.length;

  return (
    <CollapsibleSection
      storageKey="reports"
      title="التقارير الهندسية — PDF و Excel"
      subtitle="تصدير بياناتك الحقيقية مطابقة للفترة الزمنية والفلاتر المختارة في الداشبورد"
      icon={
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#3f8696] text-white shadow-md">
          <FileSpreadsheet className="w-5 h-5" />
        </span>
      }
      badge={
        <span className="rounded-full border border-[#b5e2d4] bg-[#dff3ee] px-2 py-0.5 font-mono text-[11px] font-bold text-[#14614f] dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {totalRows} سجل
        </span>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Filter className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="فلتر للتقرير: اسم مشروع، موقع، جهة، رقم شهادة…"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
                aria-label="مسح الفلتر"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <input
              type="checkbox"
              checked={includeFiles}
              onChange={(e) => setIncludeFiles(e.target.checked)}
              className="rounded text-emerald-600"
            />
            تضمين خزنة الملفات ({files.length})
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "مشاريع", n: filtered.projectsOut.length },
            { label: "مهام حرم", n: filtered.tasksOut.length },
            { label: "مواقع O&M", n: filtered.opsOut.length },
            { label: "شهادات", n: filtered.certsOut.length },
            ...(includeFiles ? [{ label: "ملفات", n: filtered.filesOut.length }] : []),
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {s.label}
              </div>
              <div className="font-mono text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                {s.n}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null || filtered.projectsOut.length === 0}
            onClick={() => run("excel")}
            className="clay-btn-teal inline-flex cursor-pointer items-center gap-2 px-5 py-2.5 text-xs disabled:opacity-50"
          >
            {busy === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            تصدير Excel — سجل المشاريع
          </button>

          <button
            type="button"
            disabled={busy !== null || totalRows === 0}
            onClick={() => run("pdf")}
            className="clay-pill inline-flex cursor-pointer items-center gap-2 px-5 py-2.5 text-xs"
          >
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            التقرير الشامل / PDF
          </button>

          {totalRows === 0 && (
            <span className="text-[11px] font-bold text-amber-600">
              لا توجد بيانات — وسّع الفترة أو أزل الفلتر
            </span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Excel يحتوي أعمدة عربية بعرض تلقائي واتجاه RTL؛ PDF يفتح نافذة الطباعة بمقاس
          A4 — اختر «حفظ كملف PDF» من نافذة الطباعة.
        </p>
      </div>
    </CollapsibleSection>
  );
}
