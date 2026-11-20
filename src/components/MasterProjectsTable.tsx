"use client";

import React, { useState, useMemo, useRef, Fragment } from "react";
import { ProjectRecord, EngineeringFileRecord } from "@/db/schema";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  formatBytes,
  isImageExtension,
  isPdfExtension,
} from "@/lib/engineering";
import {
  downloadStoredFile,
  isContentAvailable,
  openStoredPreview,
} from "@/lib/clientFiles";
import { queueOp } from "@/lib/offlineDb";
import { requestBackgroundSync } from "@/lib/offlineSync";

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}
import { CollapseToggle, useCollapsed } from "./CollapsibleSection";
import { ShareButton } from "./ShareDialog";
import { AutodeskFileButton } from "./AutodeskFileButton";
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  Copy,
  Check,
  Trash2,
  FileSpreadsheet,
  SlidersHorizontal,
  MapPin,
  Cpu,
  Paperclip,
  ChevronDown,
  Download,
  UploadCloud,
  FileCode2,
  HardDrive,
  FileText,
  FileArchive,
  Loader2,
  RefreshCw,
  Pencil,
  Image as ImageIcon,
  Eye,
} from "lucide-react";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
};

type SortKey =
  | "code"
  | "title"
  | "clientOrSite"
  | "status"
  | "priority"
  | "progress"
  | "sheetsCount"
  | "dueDate";

function attachmentIcon(group: string) {
  if (group === "autocad")
    return {
      Icon: FileCode2,
      cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800",
    };
  if (group === "revit_bim")
    return {
      Icon: HardDrive,
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800",
    };
  if (group === "documents_pdf")
    return {
      Icon: FileText,
      cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800",
    };
  return {
    Icon: FileArchive,
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
  };
}

export function MasterProjectsTable({
  projects,
  fileStats,
  onUpdateProject,
  onDeleteProject,
  onOpenNewProject,
  onFilesChanged,
  onToggleFileSample,
  onDeleteFile,
  onOpenEditProject,
}: {
  projects: ProjectRecord[];
  fileStats: Record<
    string,
    { count: number; sizeBytes: number; sizeFormatted: string }
  >;
  onUpdateProject: (
    id: number,
    payload: Record<string, unknown>
  ) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
  onOpenNewProject: () => void;
  onFilesChanged: () => Promise<void>;
  onToggleFileSample: (id: number, current: boolean) => Promise<void>;
  onDeleteFile: (id: number) => Promise<void>;
  onOpenEditProject: (project: ProjectRecord) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("id" as SortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [onlySamples, setOnlySamples] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Project attachments state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rowFiles, setRowFiles] = useState<
    Record<number, EngineeringFileRecord[]>
  >({});
  const [rowLoading, setRowLoading] = useState<number | null>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const [rowNotice, setRowNotice] = useState<{
    projectId: number;
    text: string;
    ok: boolean;
  } | null>(null);
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const uploadTargetRef = useRef<number | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const tableOpen = useCollapsed("projects-table", true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    const filtered = projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (onlySamples && !p.isSample) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "progress" || sortKey === "sheetsCount") {
        cmp = a[sortKey] - b[sortKey];
      } else if (sortKey === "priority") {
        cmp =
          (PRIORITY_RANK[a.priority] || 0) - (PRIORITY_RANK[b.priority] || 0);
      } else {
        const valA = String((a as Record<string, unknown>)[sortKey] ?? "");
        const valB = String((b as Record<string, unknown>)[sortKey] ?? "");
        cmp = valA.localeCompare(valB, "ar");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [projects, statusFilter, onlySamples, sortKey, sortDir]);

  const fetchRowFiles = async (projectId: number) => {
    setRowLoading(projectId);
    try {
      const res = await fetch(`/api/files?projectId=${projectId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setRowFiles((prev) => ({
          ...prev,
          [projectId]: Array.isArray(data.files) ? data.files : [],
        }));
      } else if (!navigator.onLine) {
        showRowNotice(projectId, "أوفلاين — تُعرض آخر قائمة ملفات محفوظة", false);
      }
    } catch {
      if (!navigator.onLine) {
        showRowNotice(projectId, "أوفلاين — تُعرض آخر قائمة ملفات محفوظة", false);
      }
    } finally {
      setRowLoading(null);
    }
  };

  const toggleExpand = (projectId: number) => {
    if (expandedId === projectId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(projectId);
    fetchRowFiles(projectId);
  };

  const showRowNotice = (projectId: number, text: string, ok: boolean) => {
    setRowNotice({ projectId, text, ok });
    setTimeout(() => setRowNotice(null), 3200);
  };

  const uploadFilesToProject = async (
    projectId: number,
    fileList: FileList | File[]
  ) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadingFor(projectId);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("projectId", String(projectId));
      formData.append("segment", "auto");
      const res = await fetch("/api/files", {
        credentials: "include",
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      const n = Array.isArray(data.files) ? data.files.length : 1;
      await fetchRowFiles(projectId);
      await onFilesChanged();
      showRowNotice(
        projectId,
        `تم رفع وربط ${n} ${n === 1 ? "ملف" : "ملفات"} بالمشروع ✓`,
        true
      );
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "file-upload",
            label: `إرفاق ${files.length} ${files.length === 1 ? "ملف" : "ملفات"} لمشروع #${projectId} أوفلاين`,
            method: "POST",
            url: "/api/files",
            formFields: { projectId: String(projectId), segment: "auto" },
            files: files.map((f) => ({
              field: "files",
              name: f.name,
              type: f.type || "application/octet-stream",
              blob: f,
            })),
          });
          requestBackgroundSync().catch(() => {});
          showRowNotice(projectId, "💾 محفوظ أوفلاين — هيترفع تلقائياً أول ما النت يرجع", true);
        } catch {
          showRowNotice(projectId, "تعذر الحفظ أوفلاين — الملفات كبيرة غالباً", false);
        }
      } else {
        showRowNotice(projectId, "تعذر رفع الملفات — حاول مرة أخرى", false);
      }
    } finally {
      setUploadingFor(null);
    }
  };

  const triggerUpload = (projectId: number) => {
    uploadTargetRef.current = projectId;
    hiddenInputRef.current?.click();
  };

  const copySampleCard = async (p: ProjectRecord) => {
    const text = `📐 عينة عمل هندسية (${p.code})\n• المشروع: ${p.title}\n• العميل/الموقع: ${p.clientOrSite} (${p.location || "مصر"})\n• التخصص والبرنامج: ${p.discipline} | ${p.software}\n• حجم الإنجاز: ${p.sheetsCount} لوحة/نموذج (${p.hoursLogged} ساعة عمل)\n• الملخص الفني: ${p.sampleSummary || p.title}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2200);
    } catch {
      // Ignore clipboard failure in restricted contexts
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    );
  };

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Hidden multi-file input used by every row's attach button */}
      <input
        ref={hiddenInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const target = uploadTargetRef.current;
          if (target && e.target.files && e.target.files.length > 0) {
            uploadFilesToProject(target, e.target.files);
          }
          e.target.value = "";
        }}
      />

      {/* Table Header & Inline Filter Controls */}
      <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              سجل المشاريع الهندسية والمهام المتوازية
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
              {filteredAndSorted.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            اضغط 📎 بجانب أي مشروع لعرض ملفاته المرفقة أو رفع ملفات جديدة تخصه — أي صيغة وأي حجم
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
            {[
              { key: "all", label: "الكل" },
              { key: "in_progress", label: "قيد التنفيذ" },
              { key: "review", label: "مراجعة" },
              { key: "completed", label: "مكتمل" },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === st.key
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlySamples((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              onlySamples
                ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-300"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                onlySamples ? "fill-amber-500 text-amber-500" : "text-slate-400"
              }`}
            />
            عينات الشغل فقط
          </button>

          <CollapseToggle
            open={tableOpen.open}
            onToggle={tableOpen.toggle}
            controls="projects-table-body"
          />
        </div>
      </div>

      {/* Responsive Table */}
      {tableOpen.open && (
      <div id="projects-table-body" className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("code")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  الكود
                  {renderSortIcon("code")}
                </button>
              </th>
              <th className="py-3.5 px-4 min-w-[260px]">
                <button
                  type="button"
                  onClick={() => handleSort("title")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  المشروع والتخصص الهندسي
                  {renderSortIcon("title")}
                </button>
              </th>
              <th className="py-3.5 px-4 min-w-[180px]">
                <button
                  type="button"
                  onClick={() => handleSort("clientOrSite")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  العميل / الموقع
                  {renderSortIcon("clientOrSite")}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("status")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  الحالة
                  {renderSortIcon("status")}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("priority")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  الأولوية
                  {renderSortIcon("priority")}
                </button>
              </th>
              <th className="py-3.5 px-4 min-w-[165px]">
                <button
                  type="button"
                  onClick={() => handleSort("progress")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  نسبة الإنجاز
                  {renderSortIcon("progress")}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("sheetsCount")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  اللوحات / الساعات
                  {renderSortIcon("sheetsCount")}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("dueDate")}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  التاريخ
                  {renderSortIcon("dueDate")}
                </button>
              </th>
              <th className="py-3.5 px-4 text-center whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  ملفات المشروع
                </span>
              </th>
              <th className="py-3.5 px-4 text-center whitespace-nowrap">
                عينة وإجراءات
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    لا توجد مشاريع تطابق الفلاتر المحددة حالياً
                  </p>
                  <button
                    type="button"
                    onClick={onOpenNewProject}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    + إضافة مشروع أو مهمة جديدة
                  </button>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((proj) => {
                const st =
                  STATUS_CONFIG[proj.status] || STATUS_CONFIG.in_progress;
                const pr =
                  PRIORITY_CONFIG[proj.priority] || PRIORITY_CONFIG.normal;
                const isBusy = updatingId === proj.id;
                const stats = fileStats[String(proj.id)];
                const attachCount =
                  stats?.count ?? rowFiles[proj.id]?.length ?? 0;
                const isExpanded = expandedId === proj.id;
                const files = rowFiles[proj.id] || [];
                const isLoadingFiles = rowLoading === proj.id;
                const isUploading = uploadingFor === proj.id;
                const totalRowBytes = files.reduce(
                  (acc, f) => acc + Number(f.sizeBytes || 0),
                  0
                );

                return (
                  <Fragment key={proj.id}>
                    <tr
                      className={`transition-colors group ${
                        isExpanded
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span className="inline-block font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 tabular-nums">
                          {proj.code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {proj.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                            {proj.software}
                          </span>
                          <span>•</span>
                          <span>{proj.discipline}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {proj.clientOrSite}
                        </div>
                        {proj.location && (
                          <div className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-teal-500" />
                            {proj.location}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <select
                          aria-label={`حالة المشروع ${proj.title}`}
                          value={proj.status}
                          disabled={isBusy}
                          onChange={async (e) => {
                            setUpdatingId(proj.id);
                            try {
                              await onUpdateProject(proj.id, {
                                status: e.target.value,
                              });
                            } finally {
                              setUpdatingId(null);
                            }
                          }}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${st.badgeClass}`}
                        >
                          <option value="in_progress">قيد التنفيذ</option>
                          <option value="review">مراجعة واعتماد</option>
                          <option value="completed">مكتمل ومسلّم</option>
                          <option value="on_hold">متوقف مؤقتاً</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${pr.className}`}
                        >
                          {pr.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center justify-between text-xs font-mono font-bold mb-1 tabular-nums">
                          <span
                            className={
                              proj.progress === 100
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-blue-600 dark:text-blue-400"
                            }
                          >
                            {proj.progress}%
                          </span>
                          <div className="flex items-center gap-1">
                            {proj.progress < 100 && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setUpdatingId(proj.id);
                                  try {
                                    await onUpdateProject(proj.id, {
                                      progress: Math.min(
                                        100,
                                        proj.progress + 10
                                      ),
                                    });
                                  } finally {
                                    setUpdatingId(null);
                                  }
                                }}
                                title="زيادة الإنجاز +10%"
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-[10px] text-slate-700 dark:text-slate-300"
                              >
                                +10%
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              proj.progress === 100
                                ? "bg-emerald-500"
                                : proj.segment === "revit"
                                ? "bg-indigo-500"
                                : proj.segment === "om"
                                ? "bg-teal-600"
                                : "bg-blue-600"
                            }`}
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap font-mono text-xs tabular-nums">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {proj.sheetsCount} لوحة/نموذج
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {proj.hoursLogged} ساعة عمل
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        {proj.dueDate}
                      </td>

                      {/* Attachments cell */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(proj.id)}
                            title="عرض ملفات المشروع المرفقة أو رفع ملفات جديدة تخصه"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                              isExpanded
                                ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                                : attachCount > 0
                                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950"
                                : "border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                            }`}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums">
                              {attachCount}
                            </span>
                            {attachCount === 0 && !isExpanded && (
                              <span className="text-[10px]">إرفاق</span>
                            )}
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </div>
                        {attachCount > 0 && stats && (
                          <div className="text-center text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1 tabular-nums">
                            {stats.sizeFormatted}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenEditProject(proj)}
                            title="تعديل كل بيانات المشروع (الاسم، العميل، التخصص، البرنامج...)"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 dark:hover:bg-amber-950/60 dark:hover:text-amber-400 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setUpdatingId(proj.id);
                              try {
                                await onUpdateProject(proj.id, {
                                  isSample: !proj.isSample,
                                });
                              } finally {
                                setUpdatingId(null);
                              }
                            }}
                            title={
                              proj.isSample
                                ? "معروض كعينة شغل للعملاء"
                                : "إضافة إلى عينات الشغل"
                            }
                            className={`p-1.5 rounded-lg border transition-colors ${
                              proj.isSample
                                ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500"
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                proj.isSample ? "fill-amber-500" : ""
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => copySampleCard(proj)}
                            title="نسخ ملخص المشروع لإرساله للعميل"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 transition-colors"
                          >
                            {copiedId === proj.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteProject(proj.id)}
                            title="حذف المشروع"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ShareButton
                            resourceType="project"
                            resourceId={proj.id}
                            title={proj.title}
                            label=""
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-400 transition-colors"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* Expanded attachments panel */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-900/50">
                        <td colSpan={10} className="px-4 pb-4 pt-1">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverRow(proj.id);
                            }}
                            onDragLeave={() => setDragOverRow(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverRow(null);
                              if (e.dataTransfer.files?.length) {
                                uploadFilesToProject(
                                  proj.id,
                                  e.dataTransfer.files
                                );
                              }
                            }}
                            className={`rounded-2xl border-2 p-4 transition-all ${
                              dragOverRow === proj.id
                                ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/30"
                                : "border-dashed border-slate-300/80 dark:border-slate-700 bg-white/70 dark:bg-[#0D1424]/70"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
                                  <Paperclip className="w-3.5 h-3.5" />
                                </span>
                                <span className="font-extrabold text-slate-900 dark:text-white">
                                  ملفات المشروع «{proj.code}»
                                </span>
                                <span className="font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                  ({files.length}{" "}
                                  {files.length > 0 &&
                                    `• ${formatBytes(totalRowBytes)}`}
                                  )
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {rowNotice?.projectId === proj.id && (
                                  <span
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                                      rowNotice.ok
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                    }`}
                                  >
                                    {rowNotice.text}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => fetchRowFiles(proj.id)}
                                  title="تحديث قائمة الملفات"
                                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <RefreshCw
                                    className={`w-3.5 h-3.5 ${
                                      isLoadingFiles ? "animate-spin" : ""
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={() => triggerUpload(proj.id)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-2xs transition-colors"
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      جاري الرفع...
                                    </>
                                  ) : (
                                    <>
                                      <UploadCloud className="w-3.5 h-3.5" />
                                      إرفاق ملفات للمشروع
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {isLoadingFiles && files.length === 0 ? (
                              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                جاري تحميل ملفات المشروع...
                              </div>
                            ) : files.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => triggerUpload(proj.id)}
                                className="w-full py-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                              >
                                <UploadCloud className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-500 mb-1.5" />
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  لسه مفيش ملفات مرفقة بالمشروع ده
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  اسحب وأفلت الملفات هنا أو اضغط للاختيار — DWG / RVT / PDF / PNG / JPG / SVG / ZIP وأي صيغة وأي حجم
                                </div>
                              </button>
                            ) : (
                              <div className="space-y-2">
                                {files.map((f) => {
                                  const { Icon, cls } = attachmentIcon(
                                    f.formatGroup
                                  );
                                  const fileBusy = busyFileId === f.id;
                                  return (
                                    <div
                                      key={f.id}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-3 py-2.5"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 ${cls}`}
                                        >
                                          <Icon className="w-4 h-4" />
                                        </span>
                                        <div className="min-w-0">
                                          <div
                                            className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[260px] sm:max-w-[380px]"
                                            title={f.fileName}
                                          >
                                            {f.fileName}
                                          </div>
                                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                                            <span className="uppercase font-bold text-blue-600 dark:text-blue-400">
                                              {f.extension}
                                            </span>
                                            <span>{f.sizeFormatted}</span>
                                            <span>• {f.uploadedDate}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          disabled={fileBusy}
                                          onClick={async () => {
                                            setBusyFileId(f.id);
                                            try {
                                              await onToggleFileSample(
                                                f.id,
                                                f.isClientSample
                                              );
                                              await fetchRowFiles(proj.id);
                                            } finally {
                                              setBusyFileId(null);
                                            }
                                          }}
                                          title={
                                            f.isClientSample
                                              ? "عينة معتمدة للعملاء — اضغط للإزالة من العينات"
                                              : "اعتماد الملف كعينة شغل للعميل"
                                          }
                                          className={`p-1.5 rounded-lg border transition-colors ${
                                            f.isClientSample
                                              ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-400"
                                              : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500"
                                          }`}
                                        >
                                          <Star
                                            className={`w-3.5 h-3.5 ${
                                              f.isClientSample
                                                ? "fill-amber-500"
                                                : ""
                                            }`}
                                          />
                                        </button>

                                        {isContentAvailable(f) ? (
                                          <>
                                            {(isImageExtension(f.extension) ||
                                              isPdfExtension(f.extension)) && (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  const result = await openStoredPreview(
                                                    `/api/files/${f.id}/preview`,
                                                    f.fileName
                                                  );
                                                  if (!result.ok) {
                                                    showRowNotice(proj.id, result.message, false);
                                                  }
                                                }}
                                                title="معاينة مباشرة (صورة / PDF) في تاب جديد"
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white dark:bg-pink-950/70 dark:text-pink-300 dark:hover:bg-pink-600 dark:hover:text-white text-[11px] font-bold transition-colors"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                                معاينة
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              disabled={fileBusy}
                                              onClick={async () => {
                                                setBusyFileId(f.id);
                                                const result = await downloadStoredFile(
                                                  `/api/files/${f.id}/download`,
                                                  f.fileName
                                                );
                                                setBusyFileId(null);
                                                if (!result.ok) {
                                                  showRowNotice(proj.id, result.message, false);
                                                } else {
                                                  await fetchRowFiles(proj.id);
                                                }
                                              }}
                                              title={`تحميل الملف (${f.downloadsCount} تحميل)`}
                                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-blue-950/70 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white text-[11px] font-bold transition-colors disabled:opacity-60"
                                            >
                                              <Download className="w-3.5 h-3.5" />
                                              تحميل
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => triggerUpload(proj.id)}
                                            title="محتوى الملف غير متاح لأنه رُفع قبل تفعيل التخزين الدائم — ارفعه مرة أخرى"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-bold transition-colors"
                                          >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            إعادة رفع
                                          </button>
                                        )}

                                        <AutodeskFileButton fileId={f.id} fileName={f.fileName} extension={f.extension} />
                                        <ShareButton
                                          resourceType="engineering_file"
                                          resourceId={f.id}
                                          title={f.fileName}
                                          label=""
                                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-400 transition-colors"
                                        />

                                        <button
                                          type="button"
                                          disabled={fileBusy}
                                          onClick={async () => {
                                            setBusyFileId(f.id);
                                            try {
                                              await onDeleteFile(f.id);
                                              await fetchRowFiles(proj.id);
                                            } finally {
                                              setBusyFileId(null);
                                            }
                                          }}
                                          title="حذف الملف من المشروع"
                                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                                        >
                                          {fileBusy ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => triggerUpload(proj.id)}
                                  className="w-full py-2.5 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  + اسحب ملفات هنا أو اضغط لإرفاق المزيد — أي صيغة وأي حجم
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
