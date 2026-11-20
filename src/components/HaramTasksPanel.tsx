"use client";

import React, { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { HaramTaskRecord, EngineeringFileRecord } from "@/db/schema";
import {
  FileSpreadsheet,
  UploadCloud,
  Loader2,
  X,
  Eye,
  Download,
  Trash2,
  Paperclip,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Check,
  Plus,
  Search,
  ChevronDown,
  Landmark,
  Filter,
  MapPin,
  CalendarDays,
  Layers,
  Clock3,
  FileArchive,
  FileCode2,
  Building2,
  ArrowUpDown,
  IdCard,
  CreditCard,
} from "lucide-react";
import { HaramDocumentRecord } from "@/db/schema";
import {
  downloadStoredFile,
  isContentAvailable,
  openStoredPreview,
} from "@/lib/clientFiles";
import { formatBytes, isImageExtension, isPdfExtension } from "@/lib/engineering";
import { ShareButton } from "./ShareDialog";
import { AutodeskFileButton } from "./AutodeskFileButton";
import {
  HARAM_CATEGORY_LABELS,
  HARAM_PRIORITY_LABELS,
  HARAM_STATUS_LABELS,
  HaramCategory,
  HaramPriority,
  HaramStatus,
} from "@/lib/haramExcel";
import { CollapsibleSection, CollapseToggle, useCollapsed } from "./CollapsibleSection";
import { queueOp } from "@/lib/offlineDb";
import { requestBackgroundSync } from "@/lib/offlineSync";

type TaskFile = EngineeringFileRecord & { hasContent?: boolean };

interface PreviewPayload {
  count: number;
  skipped: number;
  sheets: Array<{ name: string; rows: number; imported: number; headers: string[] }>;
  warnings: string[];
  sample: Array<{
    taskNo: string | null;
    title: string;
    category: HaramCategory;
    location: string | null;
    status: HaramStatus;
    startDate: string | null;
    endDate: string | null;
    sourceSheet: string;
    sourceRow: number;
  }>;
}

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}

const CATEGORY_STYLE: Record<HaramCategory, string> = {
  drawing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  survey: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  planning: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
  coordination: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
  operation: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  other: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const STATUS_STYLE: Record<HaramStatus, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  on_hold: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const PRIORITY_STYLE: Record<HaramPriority, string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  normal: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500";

function fileIcon(group: string, ext: string) {
  if (isImageExtension(ext)) return ImageIcon;
  if (isPdfExtension(ext)) return FileText;
  if (group === "autocad" || group === "revit_bim") return FileCode2;
  return FileArchive;
}

type SortKey = "sortOrder" | "title" | "category" | "status" | "startDate" | "endDate" | "location";

export function HaramTasksPanel({
  onNotify,
}: {
  onNotify?: (msg: string) => void;
}) {
  const [tasks, setTasks] = useState<HaramTaskRecord[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [documents, setDocuments] = useState<HaramDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  // Official documents (بطاقة الحرم / تصاريح)
  const [docTarget, setDocTarget] = useState<number | null>(null);
  const [busyDocId, setBusyDocId] = useState<number | null>(null);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [docDraft, setDocDraft] = useState<Partial<HaramDocumentRecord>>({});
  const [savingDoc, setSavingDoc] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<HaramDocumentRecord>>({ title: "", docType: "other" });
  const docsInputRef = useRef<HTMLInputElement | null>(null);
  const docEditInputRef = useRef<HTMLInputElement | null>(null);

  // Import
  const importOpen = useCollapsed("haram-import", true);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  // Filters / sort
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | HaramCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | HaramStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Edit / add
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<HaramTaskRecord>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState<Partial<HaramTaskRecord>>({
    title: "",
    category: "drawing",
    status: "completed",
    priority: "normal",
  });

  // Attachments
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [attachTarget, setAttachTarget] = useState<number | null>(null);
  const [attaching, setAttaching] = useState<number | null>(null);
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const [dragOverTask, setDragOverTask] = useState<number | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (text: string, ok = true) => {
    setNotice({ text, ok });
    onNotify?.(text);
    setTimeout(() => setNotice(null), 4200);
  };

  const load = async () => {
    try {
      const [tRes, dRes] = await Promise.all([
        fetch("/api/haram-tasks", { credentials: "include", cache: "no-store" }),
        fetch("/api/haram-documents", { credentials: "include", cache: "no-store" }),
      ]);
      if (tRes.ok) {
        const data = await tRes.json();
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        setFiles(Array.isArray(data.files) ? data.files : []);
      }
      if (dRes.ok) {
        const data = await dRes.json();
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      }
    } catch {
      // offline → keep whatever the SW cache provided (fetch above may have succeeded from cache)
    } finally {
      setLoading(false);
    }
  };

  // ---------- Official documents ----------
  const attachDocFile = async (docId: number, list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setBusyDocId(docId);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/haram-documents/${docId}`, {
        credentials: "include",
        method: "PATCH",
        body: fd,
      });
      if (!res.ok) throw new Error("فشل الرفع");
      notify(`تم حفظ صورة «${documents.find((d) => d.id === docId)?.title || "الوثيقة"}» ✓`);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({
          kind: "haram-doc-file",
          label: `رفع صورة وثيقة حرم #${docId} أوفلاين`,
          method: "PATCH",
          url: `/api/haram-documents/${docId}`,
          files: [{ field: "file", name: f.name, type: f.type || "application/octet-stream", blob: f }],
        });
        requestBackgroundSync().catch(() => {});
        notify("💾 الصورة محفوظة أوفلاين — هتترفع أول ما النت يرجع");
      } else {
        notify("تعذر رفع الصورة", false);
      }
    } finally {
      setBusyDocId(null);
    }
  };

  const saveDocEdit = async (docId: number) => {
    if (!String(docDraft.title || "").trim()) return;
    setSavingDoc(true);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, ...docDraft } : d)));
    try {
      const res = await fetch(`/api/haram-documents/${docId}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docDraft),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      notify("تم حفظ تعديل الوثيقة ✓");
      setEditingDocId(null);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({
          kind: "haram-doc-update",
          label: `تعديل وثيقة حرم #${docId}`,
          method: "PATCH",
          url: `/api/haram-documents/${docId}`,
          json: docDraft as Record<string, unknown>,
        });
        requestBackgroundSync().catch(() => {});
        notify("💾 التعديل محفوظ أوفلاين");
        setEditingDocId(null);
      } else {
        notify("تعذر حفظ التعديل", false);
      }
    } finally {
      setSavingDoc(false);
    }
  };

  const deleteDoc = async (doc: HaramDocumentRecord) => {
    if (!window.confirm(`حذف «${doc.title}» وصورتها؟`)) return;
    setBusyDocId(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    try {
      const res = await fetch(`/api/haram-documents/${doc.id}`, { credentials: "include", method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({ kind: "haram-doc-delete", label: `حذف وثيقة حرم: ${doc.title}`, method: "DELETE", url: `/api/haram-documents/${doc.id}` });
        requestBackgroundSync().catch(() => {});
        notify("💾 الحذف محفوظ أوفلاين");
      } else {
        notify("تعذر الحذف", false);
        await load();
      }
    } finally {
      setBusyDocId(null);
    }
  };

  const addDoc = async () => {
    if (!String(newDoc.title || "").trim()) return;
    setSavingDoc(true);
    try {
      const res = await fetch("/api/haram-documents", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoc),
      });
      if (!res.ok) throw new Error("فشل الإضافة");
      notify("تمت إضافة الوثيقة ✓");
      setNewDoc({ title: "", docType: "other" });
      setShowAddDoc(false);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({ kind: "haram-doc-create", label: `إضافة وثيقة حرم: ${newDoc.title}`, method: "POST", url: "/api/haram-documents", json: newDoc as Record<string, unknown> });
        requestBackgroundSync().catch(() => {});
        notify("💾 الوثيقة محفوظة أوفلاين");
        setNewDoc({ title: "", docType: "other" });
        setShowAddDoc(false);
      } else {
        notify("تعذر إضافة الوثيقة", false);
      }
    } finally {
      setSavingDoc(false);
    }
  };

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("online", refresh);
    // Re-read after the offline outbox has been replayed (queue items drained).
    window.addEventListener("mihwar-outbox-change", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("mihwar-outbox-change", refresh);
    };
  }, []);

  // ---------- Import ----------
  const pickExcel = async (f: File | null) => {
    setExcelFile(f);
    setPreview(null);
    if (!f) return;
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("mode", "preview");
      const res = await fetch("/api/haram-tasks/import", { credentials: "include", method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر قراءة الملف");
      setPreview(data as PreviewPayload);
    } catch (err) {
      notify(err instanceof Error ? err.message : "تعذر قراءة الملف", false);
    } finally {
      setPreviewing(false);
    }
  };

  const doImport = async () => {
    if (!excelFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", excelFile);
      fd.append("mode", "import");
      fd.append("replace", String(replaceMode));
      const res = await fetch("/api/haram-tasks/import", { credentials: "include", method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر الاستيراد");
      notify(`تم استيراد ${data.count} مهمة من ملف Excel ✓${data.skipped ? ` (تم تخطي ${data.skipped} صف فارغ)` : ""}`);
      setExcelFile(null);
      setPreview(null);
      await load();
    } catch (err) {
      if (isOfflineError(err) && excelFile) {
        try {
          await queueOp({
            kind: "haram-import",
            label: `استيراد مهام الحرم من ${excelFile.name}`,
            method: "POST",
            url: "/api/haram-tasks/import",
            formFields: { mode: "import", replace: String(replaceMode) },
            files: [{ field: "file", name: excelFile.name, type: excelFile.type || "application/octet-stream", blob: excelFile }],
          });
          requestBackgroundSync().catch(() => {});
          notify("💾 الاستيراد محفوظ أوفلاين — هيتنفذ تلقائياً أول ما النت يرجع");
          setExcelFile(null);
          setPreview(null);
        } catch {
          notify("تعذر الحفظ أوفلاين", false);
        }
      } else {
        notify(err instanceof Error ? err.message : "تعذر الاستيراد", false);
      }
    } finally {
      setImporting(false);
    }
  };

  // ---------- CRUD ----------
  const patchLocal = (id: number, patch: Partial<HaramTaskRecord>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const saveEdit = async (id: number) => {
    if (!String(draft.title || "").trim()) return;
    setSaving(true);
    patchLocal(id, draft);
    try {
      const res = await fetch(`/api/haram-tasks/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      notify("تم حفظ تعديل المهمة ✓");
      setEditingId(null);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({ kind: "haram-update", label: `تعديل مهمة حرم #${id}`, method: "PATCH", url: `/api/haram-tasks/${id}`, json: draft as Record<string, unknown> });
        requestBackgroundSync().catch(() => {});
        notify("💾 التعديل محفوظ أوفلاين");
        setEditingId(null);
      } else {
        notify("تعذر حفظ التعديل", false);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (t: HaramTaskRecord) => {
    if (!window.confirm(`حذف المهمة «${t.title}» وكل مرفقاتها؟`)) return;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    try {
      const res = await fetch(`/api/haram-tasks/${t.id}`, { credentials: "include", method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      notify("تم حذف المهمة");
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({ kind: "haram-delete", label: `حذف مهمة حرم: ${t.title}`, method: "DELETE", url: `/api/haram-tasks/${t.id}` });
        requestBackgroundSync().catch(() => {});
        notify("💾 الحذف محفوظ أوفلاين");
      } else {
        notify("تعذر الحذف", false);
        await load();
      }
    }
  };

  const addTask = async () => {
    if (!String(newTask.title || "").trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/haram-tasks", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      if (!res.ok) throw new Error("فشل الإضافة");
      notify("تمت إضافة المهمة ✓");
      setNewTask({ title: "", category: "drawing", status: "completed", priority: "normal" });
      setShowAdd(false);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({ kind: "haram-create", label: `إضافة مهمة حرم: ${newTask.title}`, method: "POST", url: "/api/haram-tasks", json: newTask as Record<string, unknown> });
        requestBackgroundSync().catch(() => {});
        notify("💾 المهمة محفوظة أوفلاين");
        setNewTask({ title: "", category: "drawing", status: "completed", priority: "normal" });
        setShowAdd(false);
      } else {
        notify("تعذر إضافة المهمة", false);
      }
    } finally {
      setAdding(false);
    }
  };

  // ---------- Attachments ----------
  const attachFiles = async (taskId: number, list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    const arr = Array.from(list).filter((f) => f.size > 0);
    if (arr.length === 0) return;
    setAttaching(taskId);
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("files", f));
      fd.append("haramTaskId", String(taskId));
      fd.append("segment", "haram");
      const res = await fetch("/api/files", { credentials: "include", method: "POST", body: fd });
      if (!res.ok) throw new Error("فشل الرفع");
      notify(`تم إرفاق ${arr.length} ${arr.length === 1 ? "ملف" : "ملفات"} بالمهمة ✓`);
      setExpandedId(taskId);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "file-upload",
            label: `إرفاق ${arr.length} ${arr.length === 1 ? "ملف" : "ملفات"} لمهمة حرم #${taskId}`,
            method: "POST",
            url: "/api/files",
            formFields: { haramTaskId: String(taskId), segment: "haram" },
            files: arr.map((f) => ({ field: "files", name: f.name, type: f.type || "application/octet-stream", blob: f })),
          });
          requestBackgroundSync().catch(() => {});
          notify("💾 المرفقات محفوظة أوفلاين — هتترفع أول ما النت يرجع");
        } catch {
          notify("تعذر الحفظ أوفلاين — الملفات كبيرة غالباً", false);
        }
      } else {
        notify("تعذر إرفاق الملفات", false);
      }
    } finally {
      setAttaching(null);
    }
  };

  const deleteFile = async (f: TaskFile) => {
    setBusyFileId(f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    try {
      const res = await fetch(`/api/files/${f.id}`, { credentials: "include", method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueOp({ kind: "file-delete", label: `حذف مرفق: ${f.fileName}`, method: "DELETE", url: `/api/files/${f.id}` });
        requestBackgroundSync().catch(() => {});
        notify("💾 الحذف محفوظ أوفلاين");
      } else {
        notify("تعذر حذف الملف", false);
        await load();
      }
    } finally {
      setBusyFileId(null);
    }
  };

  // ---------- Derived ----------
  const filesByTask = useMemo(() => {
    const m = new Map<number, TaskFile[]>();
    for (const f of files) {
      if (f.haramTaskId == null) continue;
      const list = m.get(f.haramTaskId) || [];
      list.push(f);
      m.set(f.haramTaskId, list);
    }
    return m;
  }, [files]);

  const sourceExcelFiles = useMemo(
    () => files.filter((f) => f.haramTaskId == null && f.segment === "haram"),
    [files]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const sheets = tasks.reduce((a, t) => a + (t.sheetsCount || 0), 0);
    const hours = tasks.reduce((a, t) => a + (t.hours || 0), 0);
    const byCat: Record<string, number> = {};
    for (const t of tasks) byCat[t.category] = (byCat[t.category] || 0) + 1;
    return { total, completed, inProgress, sheets, hours, byCat, attachments: files.filter((f) => f.haramTaskId != null).length };
  }, [tasks, files]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = tasks.filter((t) => {
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!needle) return true;
      return [t.taskNo, t.title, t.description, t.location, t.requestedBy, t.notes, t.sourceSheet]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string | number;
      const bv = (b[sortKey] ?? "") as string | number;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ar") * dir;
    });
  }, [tasks, q, catFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-emerald-600" : "opacity-40"}`} />
    </button>
  );

  const renderField = (
    label: string,
    key: keyof HaramTaskRecord,
    type: "text" | "date" | "number" | "textarea" = "text",
    state: Partial<HaramTaskRecord>,
    setState: (p: Partial<HaramTaskRecord>) => void
  ) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">{label}</label>
      {type === "textarea" ? (
        <textarea rows={2} value={String(state[key] ?? "")} onChange={(e) => setState({ ...state, [key]: e.target.value })} className={`${inputCls} resize-y`} />
      ) : (
        <input
          type={type}
          value={String(state[key] ?? "")}
          onChange={(e) => setState({ ...state, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
          className={inputCls}
        />
      )}
    </div>
  );

  const renderSelects = (state: Partial<HaramTaskRecord>, setState: (p: Partial<HaramTaskRecord>) => void) => (
    <>
      <div>
        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">التصنيف</label>
        <select value={state.category || "other"} onChange={(e) => setState({ ...state, category: e.target.value })} className={inputCls}>
          {(Object.keys(HARAM_CATEGORY_LABELS) as HaramCategory[]).map((k) => <option key={k} value={k}>{HARAM_CATEGORY_LABELS[k]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">الحالة</label>
        <select value={state.status || "completed"} onChange={(e) => setState({ ...state, status: e.target.value })} className={inputCls}>
          {(Object.keys(HARAM_STATUS_LABELS) as HaramStatus[]).map((k) => <option key={k} value={k}>{HARAM_STATUS_LABELS[k]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">الأولوية</label>
        <select value={state.priority || "normal"} onChange={(e) => setState({ ...state, priority: e.target.value })} className={inputCls}>
          {(Object.keys(HARAM_PRIORITY_LABELS) as HaramPriority[]).map((k) => <option key={k} value={k}>{HARAM_PRIORITY_LABELS[k]}</option>)}
        </select>
      </div>
    </>
  );

  const renderTaskForm = (state: Partial<HaramTaskRecord>, setState: (p: Partial<HaramTaskRecord>) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      <div className="lg:col-span-2">{renderField("اسم المهمة *", "title", "text", state, setState)}</div>
      {renderField("رقم / مرجع", "taskNo", "text", state, setState)}
      {renderField("الموقع داخل الحرم", "location", "text", state, setState)}
      {renderSelects(state, setState)}
      {renderField("الجهة الطالبة", "requestedBy", "text", state, setState)}
      {renderField("تاريخ البدء", "startDate", "date", state, setState)}
      {renderField("تاريخ الانتهاء", "endDate", "date", state, setState)}
      {renderField("عدد اللوحات", "sheetsCount", "number", state, setState)}
      {renderField("الساعات", "hours", "number", state, setState)}
      <div className="lg:col-span-2">{renderField("الوصف", "description", "textarea", state, setState)}</div>
      <div className="lg:col-span-2">{renderField("ملاحظات", "notes", "textarea", state, setState)}</div>
    </div>
  );

  return (
    <CollapsibleSection
      storageKey="haram-tasks"
      flush
      icon={
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
          <Landmark className="w-5 h-5" />
        </span>
      }
      title="مهام الحرم النبوي الشريف"
      subtitle="سجل أعمالك في الحرم — مستورد من ملف Excel، قابل للتعديل، وكل مهمة ليها مرفقاتها (لوحات / صور / PDF)"
      badge={
        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          {stats.total} مهمة • {stats.attachments} مرفق
        </span>
      }
      actions={
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
        >
          <Plus className="w-3.5 h-3.5" />
          {showAdd ? "إلغاء" : "مهمة يدوية"}
        </button>
      }
    >
      <input ref={attachInputRef} type="file" multiple className="hidden" onChange={(e) => { if (attachTarget) attachFiles(attachTarget, e.target.files); e.target.value = ""; setAttachTarget(null); }} />
      <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,.ods" className="hidden" onChange={(e) => { pickExcel(e.target.files?.[0] || null); e.target.value = ""; }} />
      <input ref={docsInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { if (docTarget) attachDocFile(docTarget, e.target.files); e.target.value = ""; setDocTarget(null); }} />

      {/* Official Haram documents (access card / permits) */}
      <div className="px-5 pt-4">
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white">
                <IdCard className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  الوثائق الرسمية لمشروع الحرم ({documents.length})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  بطاقة الحرم النبوي والتصاريح — ارفع صورة الوجه الأمامي والخلفي لكل وثيقة
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDoc((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-900"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddDoc ? "إلغاء" : "إضافة وثيقة"}
            </button>
          </div>

          {showAddDoc && (
            <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">اسم الوثيقة *</label>
                  <input value={String(newDoc.title || "")} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="مثال: تصريح دخول ساحات الحرم" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">النوع</label>
                  <select value={String(newDoc.docType || "other")} onChange={(e) => setNewDoc({ ...newDoc, docType: e.target.value })} className={inputCls}>
                    <option value="card_front">بطاقة — وجه أمامي</option>
                    <option value="card_back">بطاقة — وجه خلفي</option>
                    <option value="permit">تصريح</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">اسم حامل الوثيقة</label>
                  <input value={String(newDoc.holderName || "")} onChange={(e) => setNewDoc({ ...newDoc, holderName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">المسمى الوظيفي</label>
                  <input value={String(newDoc.roleTitle || "")} onChange={(e) => setNewDoc({ ...newDoc, roleTitle: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">الجهة / الجهة المانحة</label>
                  <input value={String(newDoc.organization || "")} onChange={(e) => setNewDoc({ ...newDoc, organization: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddDoc(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">إلغاء</button>
                <button type="button" onClick={addDoc} disabled={savingDoc || !String(newDoc.title || "").trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-[11px] font-bold text-white disabled:opacity-60">
                  {savingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} حفظ الوثيقة
                </button>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center">
              <CreditCard className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">مفيش وثائق رسمية مسجلة</p>
              <p className="text-[11px] text-slate-400 mt-0.5">أضف بطاقة الحرم (أمامي/خلفي) أو أي تصريح وارفع صورته</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => {
                const hasFile = !!doc.storagePath;
                const isImg = (doc.mimeType || "").startsWith("image/");
                const isPdf = doc.mimeType === "application/pdf";
                const editing = editingDocId === doc.id;
                const busy = busyDocId === doc.id;
                const previewUrl = `/api/haram-documents/${doc.id}/preview`;
                return (
                  <div key={doc.id} className={`rounded-2xl border overflow-hidden flex flex-col transition-colors ${editing ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 ring-2 ring-amber-500/15" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-800"}`}>
                    {hasFile && isImg ? (
                      <button type="button" onClick={async () => { const r = await openStoredPreview(previewUrl, doc.fileName || doc.title); if (!r.ok) notify(r.message, false); }} className="relative block h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img src={previewUrl} alt={doc.title} className="w-full h-full object-cover" loading="lazy" />
                        <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">اضغط للمعاينة</span>
                      </button>
                    ) : hasFile && isPdf ? (
                      <button type="button" onClick={async () => { const r = await openStoredPreview(previewUrl, doc.fileName || doc.title); if (!r.ok) notify(r.message, false); }} className="flex w-full items-center justify-center h-44 bg-gradient-to-br from-rose-500/10 to-pink-600/10 border-b border-slate-200 dark:border-slate-800">
                        <div className="text-center">
                          <FileText className="w-9 h-9 mx-auto text-rose-600" />
                          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 mt-1">فتح ملف PDF</div>
                        </div>
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setDocTarget(doc.id); docsInputRef.current?.click(); }} className="flex w-full items-center justify-center h-44 border-b border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <div className="text-center px-3">
                          <IdCard className="w-9 h-9 mx-auto text-slate-400" />
                          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1.5">ارفع صورة الوثيقة</div>
                          <div className="text-[10px] text-slate-400">الوجه الأمامي / الخلفي</div>
                        </div>
                      </button>
                    )}

                    {editing ? (
                      <div className="p-3.5 flex-1 space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">الاسم *</label>
                          <input value={String(docDraft.title ?? "")} onChange={(e) => setDocDraft({ ...docDraft, title: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">حامل الوثيقة</label>
                          <input value={String(docDraft.holderName ?? "")} onChange={(e) => setDocDraft({ ...docDraft, holderName: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">المسمى الوظيفي</label>
                          <input value={String(docDraft.roleTitle ?? "")} onChange={(e) => setDocDraft({ ...docDraft, roleTitle: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">الجهة</label>
                          <input value={String(docDraft.organization ?? "")} onChange={(e) => setDocDraft({ ...docDraft, organization: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">ملاحظة الوثيقة</label>
                          <textarea rows={3} value={String(docDraft.cardNote ?? "")} onChange={(e) => setDocDraft({ ...docDraft, cardNote: e.target.value })} className={`${inputCls} resize-y`} />
                        </div>
                        <input ref={docEditInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) attachDocFile(doc.id, e.target.files); e.target.value = ""; }} />
                        <button type="button" onClick={() => docEditInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-emerald-300 dark:border-emerald-800 px-2.5 py-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                          <UploadCloud className="w-3.5 h-3.5 inline" /> استبدال صورة الوثيقة
                        </button>
                        <div className="flex justify-end gap-2 pt-1">
                          <button type="button" onClick={() => setEditingDocId(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">إلغاء</button>
                          <button type="button" onClick={() => saveDocEdit(doc.id)} disabled={savingDoc} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60">
                            {savingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} حفظ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3.5 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">{doc.title}</h5>
                            <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
                              {doc.docType === "card_front" ? "أمامي" : doc.docType === "card_back" ? "خلفي" : doc.docType === "permit" ? "تصريح" : "وثيقة"}
                            </span>
                          </div>
                          {doc.holderName && <div className="mt-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">{doc.holderName}</div>}
                          {doc.roleTitle && <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">{doc.roleTitle}</div>}
                          {doc.projectTitle && <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">{doc.projectTitle}</p>}
                          {doc.organization && <p className="mt-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 line-clamp-2">{doc.organization}</p>}
                          {doc.cardNote && <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">{doc.cardNote}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                            {doc.contactNumber && <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-bold text-slate-600 dark:text-slate-300">☎ {doc.contactNumber}</span>}
                            {doc.sizeFormatted && <span>{doc.sizeFormatted}</span>}
                            {!hasFile && <span className="text-amber-600">بانتظار رفع الصورة</span>}
                          </div>
                        </div>
                        <div className="px-3.5 pb-3 flex items-center gap-2">
                          <button type="button" onClick={() => { setDocTarget(doc.id); docsInputRef.current?.click(); }} disabled={busy} title="رفع / استبدال الصورة" className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/50">
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                            {hasFile ? "استبدال الصورة" : "رفع الصورة"}
                          </button>
                          <ShareButton resourceType="haram_document" resourceId={doc.id} title={doc.title} label="" className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-400 transition-colors" />
                          <button type="button" onClick={() => { setEditingDocId(doc.id); setDocDraft({ ...doc }); }} title="تعديل بيانات الوثيقة" className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-amber-600 hover:border-amber-300">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteDoc(doc)} title="حذف الوثيقة" className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-400 hover:text-rose-600 hover:border-rose-300">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 px-5 pt-4">
        {[
          { label: "إجمالي المهام", value: stats.total, icon: Layers, cls: "text-emerald-600" },
          { label: "منجزة", value: stats.completed, icon: CheckCircle2, cls: "text-emerald-600" },
          { label: "جارية", value: stats.inProgress, icon: Clock3, cls: "text-blue-600" },
          { label: "لوحات منتجة", value: stats.sheets, icon: FileSpreadsheet, cls: "text-indigo-600" },
          { label: "ساعات عمل", value: stats.hours, icon: Clock3, cls: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{k.label}</span>
              <k.icon className={`w-3.5 h-3.5 ${k.cls}`} />
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Category chips */}
      {stats.total > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
          <button type="button" onClick={() => setCatFilter("all")} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${catFilter === "all" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
            الكل ({stats.total})
          </button>
          {(Object.keys(HARAM_CATEGORY_LABELS) as HaramCategory[])
            .filter((k) => stats.byCat[k])
            .map((k) => (
              <button key={k} type="button" onClick={() => setCatFilter(k)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${catFilter === k ? "bg-emerald-600 text-white border-emerald-600" : CATEGORY_STYLE[k]}`}>
                {HARAM_CATEGORY_LABELS[k]} ({stats.byCat[k]})
              </button>
            ))}
        </div>
      )}

      {/* Excel import */}
      <div className="px-5 pt-4">
        <section className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">استيراد ملف Excel المهام</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ارفع ملف <span className="font-mono">المهام.xlsx</span> من جهازك — بيتعرّف على الأعمدة تلقائياً (المهمة، الموقع، التاريخ، الحالة…)
                </p>
              </div>
            </div>
            <CollapseToggle open={importOpen.open} onToggle={importOpen.toggle} controls="haram-import-body" />
          </div>

          {importOpen.open && (
            <div id="haram-import-body" className="px-4 pb-4 space-y-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickExcel(e.dataTransfer.files?.[0] || null); }}
                onClick={() => excelInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${dragOver ? "border-emerald-500 bg-emerald-100/60 dark:bg-emerald-950/40" : "border-emerald-300/70 dark:border-emerald-800 bg-white/60 dark:bg-slate-900/40 hover:border-emerald-400"}`}
              >
                <UploadCloud className="w-6 h-6 mx-auto text-emerald-600 mb-1.5" />
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {excelFile ? `📄 ${excelFile.name} • ${formatBytes(excelFile.size)}` : "اسحب ملف Excel هنا أو اضغط للاختيار (.xlsx / .xls / .csv)"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  مثال للأعمدة المفهومة: م • المهمة • الوصف • النوع • الموقع • الجهة الطالبة • الحالة • تاريخ البدء • تاريخ الانتهاء • عدد اللوحات • ملاحظات
                </div>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const result = await downloadStoredFile(
                      "/api/haram-tasks/template",
                      "قالب-مهام-الحرم.xlsx"
                    );
                    if (!result.ok) notify(result.message, false);
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                >
                  <Download className="w-3 h-3" /> تحميل قالب Excel جاهز
                </button>
                {previewing && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري قراءة الملف…
                  </div>
                )}
              </div>

              {preview && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                      معاينة: <span className="font-mono text-emerald-700">{preview.count}</span> مهمة جاهزة للاستيراد
                      {preview.skipped > 0 && <span className="text-slate-500"> • تخطي {preview.skipped} صف فارغ</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.sheets.map((s) => (
                        <span key={s.name} className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {s.name}: {s.imported}
                        </span>
                      ))}
                    </div>
                  </div>
                  {preview.warnings.length > 0 && (
                    <div className="px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <ul className="space-y-0.5">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </div>
                  )}
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5">#</th>
                          <th className="px-2 py-1.5">المهمة</th>
                          <th className="px-2 py-1.5">التصنيف</th>
                          <th className="px-2 py-1.5">الموقع</th>
                          <th className="px-2 py-1.5">الحالة</th>
                          <th className="px-2 py-1.5">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {preview.sample.map((r, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1.5 font-mono text-slate-500">{r.taskNo || r.sourceRow}</td>
                            <td className="px-2 py-1.5 font-bold text-slate-800 dark:text-slate-200 max-w-[320px] truncate" title={r.title}>{r.title}</td>
                            <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 border text-[10px] ${CATEGORY_STYLE[r.category]}`}>{HARAM_CATEGORY_LABELS[r.category]}</span></td>
                            <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{r.location || "—"}</td>
                            <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 border text-[10px] ${STATUS_STYLE[r.status]}`}>{HARAM_STATUS_LABELS[r.status]}</span></td>
                            <td className="px-2 py-1.5 font-mono text-slate-500">{r.startDate || r.endDate || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.count > preview.sample.length && (
                      <div className="px-3 py-2 text-[10px] text-slate-500">… و{preview.count - preview.sample.length} مهمة أخرى</div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
                    <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} className="rounded text-emerald-600" />
                      استبدال المهام المستوردة سابقاً (المهام اليدوية بتفضل)
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { setExcelFile(null); setPreview(null); }} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        إلغاء
                      </button>
                      <button type="button" onClick={doImport} disabled={importing || preview.count === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        استيراد {preview.count} مهمة
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {sourceExcelFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-bold">ملفات Excel الأصلية المحفوظة:</span>
                  {sourceExcelFiles.map((f) => (
                    <button key={f.id} type="button" onClick={async () => { const r = await downloadStoredFile(`/api/files/${f.id}/download`, f.fileName); if (!r.ok) notify(r.message, false); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono hover:border-emerald-400">
                      <Download className="w-3 h-3" />
                      {f.fileName} <span className="text-slate-400">({f.uploadedDate})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Add manual */}
      {showAdd && (
        <div className="px-5 pt-4">
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">إضافة مهمة يدوياً</h4>
            {renderTaskForm(newTask, setNewTask)}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">إلغاء</button>
              <button type="button" onClick={addTask} disabled={adding || !String(newTask.title || "").trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white disabled:opacity-60">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} حفظ المهمة
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className={`mx-5 mt-3 rounded-xl border px-4 py-2.5 text-[11px] font-bold flex items-center justify-between gap-3 ${notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 hover:underline">إغلاق</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4 pb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في المهام (الاسم، الموقع، الجهة، الملاحظات)…" className={`${inputCls} pr-8`} />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg text-[11px]">
          <Filter className="w-3.5 h-3.5 text-slate-400 mx-1" />
          {(["all", "completed", "in_progress", "pending", "on_hold"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`px-2 py-1 rounded-md font-bold ${statusFilter === s ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs" : "text-slate-600 dark:text-slate-400"}`}>
              {s === "all" ? "الكل" : HARAM_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-mono text-slate-500">{visible.length} / {tasks.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center">
            <Landmark className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{tasks.length === 0 ? "لسه مفيش مهام — ارفع ملف Excel أو أضف مهمة يدوياً" : "مفيش مهام مطابقة للفلتر"}</p>
          </div>
        ) : (
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-3 whitespace-nowrap"><SortBtn k="sortOrder" label="#" /></th>
                <th className="py-3 px-3 min-w-[260px]"><SortBtn k="title" label="المهمة" /></th>
                <th className="py-3 px-3 whitespace-nowrap"><SortBtn k="category" label="التصنيف" /></th>
                <th className="py-3 px-3 whitespace-nowrap"><SortBtn k="location" label="الموقع" /></th>
                <th className="py-3 px-3 whitespace-nowrap"><SortBtn k="status" label="الحالة" /></th>
                <th className="py-3 px-3 whitespace-nowrap"><SortBtn k="startDate" label="التاريخ" /></th>
                <th className="py-3 px-3 whitespace-nowrap text-center"><span className="inline-flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> مرفقات</span></th>
                <th className="py-3 px-3 whitespace-nowrap text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {visible.map((t) => {
                const tFiles = filesByTask.get(t.id) || [];
                const isEditing = editingId === t.id;
                const isExpanded = expandedId === t.id;
                return (
                  <Fragment key={t.id}>
                    <tr className={`transition-colors ${isExpanded || isEditing ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}`}>
                      <td className="py-3 px-3 align-top font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {t.taskNo || t.sortOrder}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug">{t.title}</div>
                        {t.description && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{t.description}</div>}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400">
                          {t.requestedBy && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{t.requestedBy}</span>}
                          {t.sheetsCount > 0 && <span>{t.sheetsCount} لوحة</span>}
                          {t.hours > 0 && <span>{t.hours} ساعة</span>}
                          {t.sourceSheet && t.sourceSheet !== "يدوي" && <span className="font-mono">📄 {t.sourceSheet}{t.sourceRow ? `:${t.sourceRow}` : ""}</span>}
                          <span className={`rounded px-1.5 py-0.5 border text-[10px] ${PRIORITY_STYLE[(t.priority as HaramPriority) || "normal"]}`}>{HARAM_PRIORITY_LABELS[(t.priority as HaramPriority) || "normal"]}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 py-0.5 border text-[11px] font-bold ${CATEGORY_STYLE[(t.category as HaramCategory) || "other"]}`}>
                          {HARAM_CATEGORY_LABELS[(t.category as HaramCategory) || "other"]}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {t.location ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-600" />{t.location}</span> : "—"}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <select
                          value={t.status}
                          onChange={async (e) => {
                            const status = e.target.value;
                            patchLocal(t.id, { status });
                            try {
                              const res = await fetch(`/api/haram-tasks/${t.id}`, { credentials: "include", method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
                              if (!res.ok) throw new Error("x");
                            } catch (err) {
                              if (isOfflineError(err)) {
                                await queueOp({ kind: "haram-update", label: `تغيير حالة مهمة #${t.id}`, method: "PATCH", url: `/api/haram-tasks/${t.id}`, json: { status } });
                                requestBackgroundSync().catch(() => {});
                              }
                            }
                          }}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold cursor-pointer focus:outline-none ${STATUS_STYLE[(t.status as HaramStatus) || "completed"]}`}
                        >
                          {(Object.keys(HARAM_STATUS_LABELS) as HaramStatus[]).map((k) => <option key={k} value={k}>{HARAM_STATUS_LABELS[k]}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-3 align-top font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{t.startDate || "—"}</div>
                        {t.endDate && <div className="text-slate-400">→ {t.endDate}</div>}
                      </td>
                      <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : t.id)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${isExpanded ? "bg-emerald-600 border-emerald-600 text-white" : tFiles.length > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300" : "border-dashed border-slate-300 dark:border-slate-600 text-slate-500"}`}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="font-mono">{tFiles.length}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => { setAttachTarget(t.id); attachInputRef.current?.click(); }} title="إرفاق ملفات" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-300">
                            {attaching === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={() => { setEditingId(isEditing ? null : t.id); setDraft({ ...t }); }} title="تعديل المهمة" className={`p-1.5 rounded-lg border transition ${isEditing ? "bg-amber-100 border-amber-300 text-amber-700" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300"}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteTask(t)} title="حذف المهمة" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-300">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isEditing && (
                      <tr className="bg-amber-50/40 dark:bg-amber-950/10">
                        <td colSpan={8} className="px-4 pb-4 pt-2">
                          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5 text-amber-600" /> تعديل المهمة</div>
                            {renderTaskForm(draft, setDraft)}
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">إلغاء</button>
                              <button type="button" onClick={() => saveEdit(t.id)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-[11px] font-bold text-white disabled:opacity-60">
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} حفظ التعديل
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-900/50">
                        <td colSpan={8} className="px-4 pb-4 pt-1">
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragOverTask(t.id); }}
                            onDragLeave={() => setDragOverTask(null)}
                            onDrop={(e) => { e.preventDefault(); setDragOverTask(null); attachFiles(t.id, e.dataTransfer.files); }}
                            className={`rounded-2xl border-2 p-4 transition-all ${dragOverTask === t.id ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30" : "border-dashed border-slate-300/80 dark:border-slate-700 bg-white/70 dark:bg-[#0D1424]/70"}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                              <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white"><Paperclip className="w-3.5 h-3.5" /></span>
                                مرفقات المهمة «{t.title.length > 50 ? t.title.slice(0, 50) + "…" : t.title}»
                                <span className="font-mono text-slate-500">({tFiles.length})</span>
                              </div>
                              <button type="button" onClick={() => { setAttachTarget(t.id); attachInputRef.current?.click(); }} disabled={attaching === t.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                                {attaching === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                إرفاق ملفات (أي صيغة)
                              </button>
                            </div>

                            {tFiles.length === 0 ? (
                              <button type="button" onClick={() => { setAttachTarget(t.id); attachInputRef.current?.click(); }} className="w-full py-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400">
                                <UploadCloud className="w-6 h-6 mx-auto text-slate-400 mb-1.5" />
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">لسه مفيش مرفقات للمهمة دي</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">اسحب اللوحات / الصور / PDF هنا أو اضغط للاختيار</div>
                              </button>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {tFiles.map((f) => {
                                  const Icon = fileIcon(f.formatGroup, f.extension);
                                  const available = isContentAvailable(f);
                                  const previewable = available && (isImageExtension(f.extension) || isPdfExtension(f.extension));
                                  const busy = busyFileId === f.id;
                                  return (
                                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-3 py-2">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {available && isImageExtension(f.extension) ? (
                                          <button type="button" onClick={async () => { const r = await openStoredPreview(`/api/files/${f.id}/preview`, f.fileName); if (!r.ok) notify(r.message, false); }} className="shrink-0">
                                            <img src={`/api/files/${f.id}/preview`} alt={f.fileName} className="h-9 w-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700" loading="lazy" />
                                          </button>
                                        ) : (
                                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0"><Icon className="w-4 h-4" /></span>
                                        )}
                                        <div className="min-w-0">
                                          <div className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate max-w-[220px]" title={f.fileName}>{f.fileName}</div>
                                          <div className="font-mono text-[10px] text-slate-400">{f.extension.toUpperCase()} • {f.sizeFormatted} • {f.uploadedDate}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {available ? (
                                          <>
                                            {previewable && (
                                              <button type="button" title="معاينة" onClick={async () => { const r = await openStoredPreview(`/api/files/${f.id}/preview`, f.fileName); if (!r.ok) notify(r.message, false); }} className="rounded-lg p-1.5 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/50"><Eye className="w-3.5 h-3.5" /></button>
                                            )}
                                            <button type="button" title="تحميل" disabled={busy} onClick={async () => { setBusyFileId(f.id); const r = await downloadStoredFile(`/api/files/${f.id}/download`, f.fileName); setBusyFileId(null); if (!r.ok) notify(r.message, false); }} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50">
                                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                            </button>
                                          </>
                                        ) : (
                                          <span title="المحتوى غير متاح" className="text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /></span>
                                        )}
                                        <AutodeskFileButton fileId={f.id} fileName={f.fileName} extension={f.extension} compact />
                                        <button type="button" title="حذف" disabled={busy} onClick={() => deleteFile(f)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </CollapsibleSection>
  );
}
