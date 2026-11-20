"use client";

import React, { useState, useRef } from "react";
import { EngineeringFileRecord, ProjectRecord } from "@/db/schema";
import {
  UploadCloud,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileArchive,
  Download,
  Star,
  Trash2,
  Copy,
  Check,
  HardDrive,
  Infinity as InfinityIcon,
  FolderPlus,
  Sparkles,
  Eye,
  Image as ImageIcon,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { isImageExtension, isPdfExtension } from "@/lib/engineering";
import { CollapsibleSection, useCollapsed, CollapseToggle } from "./CollapsibleSection";
import { downloadStoredFile, openStoredPreview, isContentAvailable } from "@/lib/clientFiles";
import { queueOp } from "@/lib/offlineDb";
import { requestBackgroundSync } from "@/lib/offlineSync";
import { ShareButton } from "./ShareDialog";
import { AutodeskFileButton } from "./AutodeskFileButton";

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}

type VaultFile = EngineeringFileRecord & { hasContent?: boolean };

export function FileVaultAndSamples({
  files,
  projects,
  onFilesUploaded,
  onToggleFileSample,
  onDeleteFile,
  onNotify,
}: {
  files: VaultFile[];
  projects: ProjectRecord[];
  onFilesUploaded: () => Promise<void>;
  onToggleFileSample: (id: number, current: boolean) => Promise<void>;
  onDeleteFile: (id: number) => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  const [uploadMode, setUploadMode] = useState<"direct" | "large_archive">("direct");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  const [selectedSegment, setSelectedSegment] = useState<string>("auto");
  const [linkedProjectId, setLinkedProjectId] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isSample, setIsSample] = useState<boolean>(true);
  const [sampleNote, setSampleNote] = useState<string>("");

  const [largeFileName, setLargeFileName] = useState<string>("");
  const [largeExt, setLargeExt] = useState<string>(".rvt");
  const [largeSizeVal, setLargeSizeVal] = useState<string>("2.4");
  const [largeSizeUnit, setLargeSizeUnit] = useState<"MB" | "GB" | "TB">("GB");
  const [largeStoragePath, setLargeStoragePath] = useState<string>("");

  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [copiedSampleId, setCopiedSampleId] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<VaultFile | null>(null);

  const metaPanel = useCollapsed("vault-upload-options", true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (message: string) => {
    setUploadStatusMsg(message);
    onNotify?.(message);
  };

  const handleDirectUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadProgress(20);
    setUploadStatusMsg(null);

    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append("files", f));
      formData.append("segment", selectedSegment);
      if (linkedProjectId) formData.append("projectId", linkedProjectId);
      if (projectTitle.trim()) formData.append("projectTitle", projectTitle.trim());
      formData.append("isClientSample", String(isSample));
      if (sampleNote.trim()) formData.append("sampleNote", sampleNote.trim());

      setUploadProgress(65);
      const res = await fetch("/api/files", { credentials: "include", method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل رفع الملفات");
      }

      setUploadProgress(100);
      const data = await res.json();
      const count = Array.isArray(data.files) ? data.files.length : 1;
      setUploadStatusMsg(`تم رفع ${count} ${count === 1 ? "ملف" : "ملفات"} وحفظها بشكل دائم — المعاينة والتحميل متاحان الآن.`);
      setProjectTitle("");
      setSampleNote("");
      await onFilesUploaded();
    } catch (e) {
      if (isOfflineError(e)) {
        try {
          const queuedFiles = Array.from(fileList).map((f) => ({
            field: "files",
            name: f.name,
            type: f.type || "application/octet-stream",
            blob: f,
          }));
          await queueOp({
            kind: "file-upload",
            label: `رفع ${queuedFiles.length} ${queuedFiles.length === 1 ? "ملف" : "ملفات"} للخزنة أوفلاين`,
            method: "POST",
            url: "/api/files",
            formFields: {
              segment: selectedSegment,
              ...(linkedProjectId ? { projectId: linkedProjectId } : {}),
              ...(projectTitle.trim() ? { projectTitle: projectTitle.trim() } : {}),
              isClientSample: String(isSample),
              ...(sampleNote.trim() ? { sampleNote: sampleNote.trim() } : {}),
            },
            files: queuedFiles,
          });
          requestBackgroundSync().catch(() => {});
          notify("💾 الملفات محفوظة أوفلاين — هتترفع تلقائياً أول ما النت يرجع");
          setProjectTitle("");
          setSampleNote("");
        } catch {
          notify("تعذر الحفظ أوفلاين — الملفات كبيرة على مساحة المتصفح غالباً");
        }
      } else {
        setUploadStatusMsg(e instanceof Error ? e.message : "حدث خطأ أثناء رفع الملف");
      }
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  };

  // Re-uploads a file whose bytes were lost, keeping it attached to the same project.
  const handleReplaceUpload = async (fileList: FileList | null) => {
    const target = replaceTarget;
    setReplaceTarget(null);
    if (!target || !fileList || fileList.length === 0) return;
    setBusyFileId(target.id);
    try {
      const formData = new FormData();
      formData.append("files", fileList[0]);
      formData.append("segment", target.segment);
      if (target.projectId) formData.append("projectId", String(target.projectId));
      if (target.projectTitle) formData.append("projectTitle", target.projectTitle);
      formData.append("isClientSample", String(target.isClientSample));
      if (target.sampleNote) formData.append("sampleNote", target.sampleNote);
      const res = await fetch("/api/files", { credentials: "include", method: "POST", body: formData });
      if (!res.ok) throw new Error("فشل إعادة رفع الملف");
      await fetch(`/api/files/${target.id}`, { credentials: "include", method: "DELETE" });
      await onFilesUploaded();
      notify(`تمت إعادة رفع «${fileList[0].name}» وحفظه بشكل دائم.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "تعذر إعادة رفع الملف");
    } finally {
      setBusyFileId(null);
    }
  };

  const handleLargeArchiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!largeFileName.trim()) return;
    setUploading(true);
    setUploadStatusMsg(null);

    try {
      const res = await fetch("/api/files", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: largeFileName.trim(),
          extension: largeExt,
          sizeValue: Number(largeSizeVal) || 1.5,
          sizeUnit: largeSizeUnit,
          segment: selectedSegment,
          projectId: linkedProjectId ? Number(linkedProjectId) : undefined,
          projectTitle: projectTitle.trim() || "حزمة مشروع هندسي كبيرة",
          isClientSample: isSample,
          sampleNote: sampleNote.trim() || "ملف مشروع هندسي كبير الحجم مسجل في الخزنة المجانية",
          storagePath: largeStoragePath.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "تعذر تسجيل الملف");
      }
      setUploadStatusMsg(`تم تسجيل الحزمة (${largeFileName.trim()} - ${largeSizeVal} ${largeSizeUnit}) في الخزنة بنجاح!`);
      setLargeFileName("");
      setLargeStoragePath("");
      setSampleNote("");
      await onFilesUploaded();
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "file-register",
            label: `تسجيل حزمة: ${largeFileName.trim()}`,
            method: "POST",
            url: "/api/files",
            json: {
              fileName: largeFileName.trim(),
              extension: largeExt,
              sizeValue: Number(largeSizeVal) || 1.5,
              sizeUnit: largeSizeUnit,
              segment: selectedSegment,
              projectId: linkedProjectId ? Number(linkedProjectId) : undefined,
              projectTitle: projectTitle.trim() || "حزمة مشروع هندسي كبيرة",
              isClientSample: isSample,
              sampleNote: sampleNote.trim() || "ملف مشروع هندسي كبير الحجم مسجل في الخزنة المجانية",
              storagePath: largeStoragePath.trim() || undefined,
            },
          });
          requestBackgroundSync().catch(() => {});
          notify("💾 التسجيل محفوظ أوفلاين — هيترفع تلقائياً أول ما النت يرجع");
          setLargeFileName("");
          setLargeStoragePath("");
          setSampleNote("");
        } catch {
          notify("تعذر الحفظ أوفلاين");
        }
      } else {
        setUploadStatusMsg(err instanceof Error ? err.message : "تعذر تسجيل الملف");
      }
    } finally {
      setUploading(false);
    }
  };

  const filteredVaultFiles = files.filter((f) => {
    if (formatFilter === "samples") return f.isClientSample;
    if (formatFilter === "missing") return !isContentAvailable(f);
    if (formatFilter !== "all" && f.formatGroup !== formatFilter) return false;
    return true;
  });

  const missingCount = files.filter((f) => !isContentAvailable(f)).length;
  const sampleProjects = projects.filter((p) => p.isSample).slice(0, 4);
  const sampleFiles = files.filter((f) => f.isClientSample).slice(0, 4);

  const copyPortfolioPitch = async (key: string, title: string, subtitle: string, meta: string) => {
    const text = `📐 عينة أعمال هندسية (AutoCAD / Revit BIM / O&M)\n• العنوان: ${title}\n• الوصف: ${subtitle}\n• المواصفات: ${meta}\n• متاح للمعاينة والاعتماد الفوري.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSampleId(key);
      setTimeout(() => setCopiedSampleId(null), 2200);
    } catch {
      // Clipboard may be blocked in embedded previews.
    }
  };

  const getFormatBadge = (ext: string, group: string) => {
    if (group === "autocad") return { icon: FileCode2, cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800" };
    if (group === "revit_bim") return { icon: HardDrive, cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800" };
    if (group === "documents_pdf") return { icon: FileText, cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800" };
    if (group === "images") return { icon: ImageIcon, cls: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/70 dark:text-pink-300 dark:border-pink-800" };
    if (ext === ".xlsx" || ext === ".csv") return { icon: FileSpreadsheet, cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800" };
    return { icon: FileArchive, cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800" };
  };

  const handlePreview = async (file: VaultFile) => {
    const result = await openStoredPreview(`/api/files/${file.id}/preview`, file.fileName);
    if (!result.ok) notify(result.message);
  };

  const handleDownload = async (file: VaultFile) => {
    setBusyFileId(file.id);
    const result = await downloadStoredFile(`/api/files/${file.id}/download`, file.fileName);
    setBusyFileId(null);
    if (!result.ok) notify(result.message);
    else await onFilesUploaded();
  };

  const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-5">
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          handleReplaceUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {/* 1. Uploader */}
      <CollapsibleSection
        storageKey="vault-upload"
        icon={<span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs"><UploadCloud className="w-5 h-5" /></span>}
        title="رفع الملفات الهندسية — بكل الصيغ والأحجام"
        subtitle="DWG, DXF, RVT, IFC, PDF, صور، أرشيف… بتتحفظ بشكل دائم وتقدر تعاينها وتحمّلها في أي وقت"
        badge={<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"><InfinityIcon className="w-3.5 h-3.5" />مجانية</span>}
        actions={
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl text-[11px]">
            <button type="button" onClick={() => setUploadMode("direct")} className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${uploadMode === "direct" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs" : "text-slate-600 dark:text-slate-400"}`}>
              <UploadCloud className="w-3.5 h-3.5" />رفع مباشر
            </button>
            <button type="button" onClick={() => setUploadMode("large_archive")} className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${uploadMode === "large_archive" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs" : "text-slate-600 dark:text-slate-400"}`}>
              <FolderPlus className="w-3.5 h-3.5" />حزم ضخمة GB+
            </button>
          </div>
        }
      >
        {/* Upload options (collapsible sub-panel) */}
        <div className="mb-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">خيارات الرفع: التخصص، ربط المشروع، ملاحظة، عينة</span>
            <CollapseToggle open={metaPanel.open} onToggle={metaPanel.toggle} controls="vault-upload-options" />
          </div>
          {metaPanel.open && (
            <div id="vault-upload-options" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 px-3 pb-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">التخصص / المسار</label>
                <select value={selectedSegment} onChange={(e) => setSelectedSegment(e.target.value)} className={`${inputCls} font-semibold`}>
                  <option value="auto">تصنيف تلقائي حسب الصيغة</option>
                  <option value="autocad">رسومات أوتوكاد AutoCAD</option>
                  <option value="revit">نماذج ريفيت Revit BIM</option>
                  <option value="om">التشغيل والصيانة O&M</option>
                  <option value="certificates">شهادات واعتمادات</option>
                  <option value="samples">عينات شغل للعملاء</option>
                  <option value="haram">مهام الحرم النبوي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ربط بمشروع من السجل 📎</label>
                <select value={linkedProjectId} onChange={(e) => setLinkedProjectId(e.target.value)} className={`${inputCls} font-semibold`}>
                  <option value="">بدون ربط (ملف عام)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>[{p.code}] {p.title.length > 42 ? `${p.title.slice(0, 42)}…` : p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المشروع أو الموقع المرتبط</label>
                <input type="text" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="مثال: مول النخيل أو مستشفى الصفوة" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">وصف سريع / ملاحظة فنية</label>
                <input type="text" value={sampleNote} onChange={(e) => setSampleNote(e.target.value)} placeholder="مثال: لوحات شوب دروينج تكييف LOD 350" className={inputCls} />
              </div>
              <div className="flex items-end">
                <label className="w-full flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 cursor-pointer">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />تجهيز كعينة للعملاء</span>
                  <input type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} className="rounded text-amber-600 focus:ring-amber-500" />
                </label>
              </div>
            </div>
          )}
        </div>

        {uploadMode === "direct" ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleDirectUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${isDragging ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 scale-[0.995]" : "border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/60 dark:bg-slate-900/40"}`}
          >
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleDirectUpload(e.target.files); e.target.value = ""; }} />
            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3"><UploadCloud className="w-6 h-6" /></div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">اسحب وأفلت ملفاتك هنا أو اضغط لاختيار الملفات من جهازك</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              يقبل جميع الصيغ: <span className="font-mono text-slate-700 dark:text-slate-300">.DWG, .DXF, .RVT, .RFA, .IFC, .NWD, .PDF, .PNG, .JPG, .SVG, .XLSX, .DOCX, .ZIP, .RAR, .MP4</span>
            </p>
            {uploading && (
              <div className="max-w-md mx-auto mt-4">
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1 block">جاري رفع وحفظ الملفات بشكل دائم...</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLargeArchiveSubmit} className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الحزمة / ملف الـ BIM الضخم</label>
                <input type="text" required value={largeFileName} onChange={(e) => setLargeFileName(e.target.value)} placeholder="مثال: Mall-Federation-Full-BIM-2025" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الصيغة</label>
                <input type="text" value={largeExt} onChange={(e) => setLargeExt(e.target.value)} placeholder=".rvt / .nwd / .zip" className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الحجم الفعلي</label>
                <div className="flex gap-1.5">
                  <input type="number" step="0.1" min="0.1" value={largeSizeVal} onChange={(e) => setLargeSizeVal(e.target.value)} className={`${inputCls} font-mono`} />
                  <select value={largeSizeUnit} onChange={(e) => setLargeSizeUnit(e.target.value as "MB" | "GB" | "TB")} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                    <option value="MB">MB</option><option value="GB">GB</option><option value="TB">TB</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={uploading} className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs">
                {uploading ? "جاري الحفظ..." : "+ حفظ بالخزنة"}
              </button>
            </div>
            <input type="text" value={largeStoragePath} onChange={(e) => setLargeStoragePath(e.target.value)} placeholder="مسار الأرشيف على جهازك أو رابط السحابة (اختياري)" className={`${inputCls} mt-3 font-mono`} />
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">الفهرسة تسجّل بيانات الحزمة فقط (الاسم والحجم والمكان) بدون رفع محتواها.</p>
          </form>
        )}

        {uploadStatusMsg && (
          <div className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
            <span>{uploadStatusMsg}</span>
            <button type="button" onClick={() => setUploadStatusMsg(null)} className="text-emerald-600 hover:underline shrink-0">إغلاق</button>
          </div>
        )}
      </CollapsibleSection>

      {/* 2. Client samples showcase */}
      <CollapsibleSection
        storageKey="vault-samples"
        icon={<span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400"><Sparkles className="w-4 h-4" /></span>}
        title="معرض عينات الشغل المعتمدة"
        subtitle="نماذج مختارة من لوحات الأوتوكاد وموديلات الريفيت وتقارير التشغيل والصيانة جاهزة للمشاركة"
        badge={<span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{sampleProjects.length + sampleFiles.length}</span>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {[
            { src: "/images/sample-revit-bim.png", alt: "Revit 3D BIM MEP Coordination Sample", tag: "Revit BIM • LOD 350 • Clash-Free", tagCls: "bg-indigo-600", title: "عينة نمذجة معماري وكهروميكانيك MEP متكاملة", desc: "شبكات تكييف مركزي، مكافحة حريق، لوحات كهرباء، وجداول حصر كميات تلقائية" },
            { src: "/images/sample-autocad-mep.png", alt: "AutoCAD 2D Shop Drawing Blueprint Sample", tag: "AutoCAD 2025 • Shop Drawings .DWG", tagCls: "bg-blue-600", title: "عينة لوحات شوب دروينج تنفيذية ومخططات As-Built", desc: "تفاصيل تنفيذية دقيقة بمقياس 1:50 و 1:20 مع بلوكات ديناميكية وجداول أحمال" },
          ].map((card) => (
            <div key={card.src} className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900">
              <img src={card.src} alt={card.alt} className="w-full h-44 object-cover opacity-85 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end">
                <span className={`inline-block w-fit px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold text-white mb-1.5 ${card.tagCls}`}>{card.tag}</span>
                <h4 className="text-sm font-extrabold text-white">{card.title}</h4>
                <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {sampleProjects.map((sp) => {
            const key = `proj-${sp.id}`;
            return (
              <div key={key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">{sp.code}</span>
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed">{sp.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">{sp.sampleSummary || sp.discipline}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums">{sp.sheetsCount} لوحة</span>
                  <button type="button" onClick={() => copyPortfolioPitch(key, sp.title, sp.sampleSummary || sp.discipline, `${sp.software} • ${sp.sheetsCount} لوحة/نموذج`)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors">
                    {copiedSampleId === key ? <><Check className="w-3 h-3 text-emerald-500" />تم النسخ</> : <><Copy className="w-3 h-3" />نسخ للعميل</>}
                  </button>
                </div>
              </div>
            );
          })}

          {sampleFiles.slice(0, Math.max(0, 4 - sampleProjects.length)).map((sf) => {
            const key = `file-${sf.id}`;
            const available = isContentAvailable(sf);
            return (
              <div key={key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 uppercase">{sf.extension}</span>
                    <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums">{sf.sizeFormatted}</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate" title={sf.fileName}>{sf.fileName}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{sf.sampleNote || sf.projectTitle}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  {available ? (
                    <button type="button" onClick={() => handleDownload(sf)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"><Download className="w-3 h-3" />تحميل</button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600"><AlertTriangle className="w-3 h-3" />يحتاج إعادة رفع</span>
                  )}
                  <button type="button" onClick={() => copyPortfolioPitch(key, sf.fileName, sf.sampleNote || sf.projectTitle || "ملف عينة هندسية", `صيغة ${sf.extension.toUpperCase()} • حجم ${sf.sizeFormatted}`)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {copiedSampleId === key ? <><Check className="w-3 h-3 text-emerald-500" />تم النسخ</> : <><Copy className="w-3 h-3" />نسخ</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* 3. Vault table */}
      <CollapsibleSection
        storageKey="vault-archive"
        flush
        icon={<span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/70 dark:text-teal-400"><HardDrive className="w-4 h-4" /></span>}
        title="أرشيف الملفات المرفوعة"
        subtitle="تصفح وعاين وحمّل ملفاتك الهندسية في أي وقت"
        badge={<span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{filteredVaultFiles.length}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl text-[11px]">
            {[
              { key: "all", label: "كل الصيغ" },
              { key: "autocad", label: "AutoCAD" },
              { key: "revit_bim", label: "Revit" },
              { key: "documents_pdf", label: "PDF" },
              { key: "images", label: "صور" },
              { key: "archives_other", label: "أرشيف" },
              { key: "samples", label: "⭐ عينات" },
              ...(missingCount > 0 ? [{ key: "missing", label: `⚠️ تحتاج رفع (${missingCount})` }] : []),
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setFormatFilter(tab.key)} className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${formatFilter === tab.key ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {missingCount > 0 && (
          <div className="mx-4 mt-4 flex flex-wrap items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <span className="font-extrabold">{missingCount} ملف رُفع قبل تفعيل التخزين الدائم ومحتواه غير متاح.</span>
              <span className="mr-1">أسماؤها وربطها بالمشاريع محفوظ — اضغط «إعادة رفع» بجانب أي ملف وهيتحفظ بشكل دائم هذه المرة.</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">اسم الملف والصيغة</th>
                <th className="py-3 px-4">المشروع / التصنيف</th>
                <th className="py-3 px-4">الحجم</th>
                <th className="py-3 px-4">تاريخ الرفع</th>
                <th className="py-3 px-4">عينة شغل</th>
                <th className="py-3 px-4 text-center">معاينة وتحميل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {filteredVaultFiles.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">لا توجد ملفات في هذا التصنيف حالياً — استخدم صندوق الرفع أعلاه لإضافة ملفاتك</td></tr>
              ) : (
                filteredVaultFiles.map((file) => {
                  const badge = getFormatBadge(file.extension, file.formatGroup);
                  const IconComp = badge.icon;
                  const available = isContentAvailable(file);
                  const previewable = available && (isImageExtension(file.extension) || isPdfExtension(file.extension));
                  const busy = busyFileId === file.id;
                  return (
                    <tr key={file.id} className={`transition-colors ${available ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/40" : "bg-amber-50/40 dark:bg-amber-950/10"}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {available && isImageExtension(file.extension) ? (
                            <button type="button" onClick={() => handlePreview(file)} title="معاينة الصورة" className="shrink-0 block">
                              <img src={`/api/files/${file.id}/preview`} alt={file.fileName} className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700" loading="lazy" />
                            </button>
                          ) : (
                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${available ? badge.cls : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"}`}>
                              {available ? <IconComp className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[280px]" title={file.fileName}>{file.fileName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400">{file.extension}</span>
                              {!available ? (
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">المحتوى غير متاح — أعد رفعه</span>
                              ) : file.sampleNote ? (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">• {file.sampleNote}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">{file.projectTitle || "ملف هندسي عام"}</td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">{file.sizeFormatted}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{file.uploadedDate}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button type="button" onClick={() => onToggleFileSample(file.id, file.isClientSample)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${file.isClientSample ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600"}`}>
                          <Star className={`w-3 h-3 ${file.isClientSample ? "fill-amber-500" : ""}`} />
                          {file.isClientSample ? "عينة معتمدة" : "أرشيف"}
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {available ? (
                            <>
                              {previewable && (
                                <button type="button" onClick={() => handlePreview(file)} title="معاينة مباشرة في تاب جديد" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white dark:bg-pink-950/70 dark:text-pink-300 dark:hover:bg-pink-600 dark:hover:text-white text-xs font-bold transition-colors">
                                  <Eye className="w-3.5 h-3.5" />معاينة
                                </button>
                              )}
                              <button type="button" disabled={busy} onClick={() => handleDownload(file)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-blue-950/70 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white text-xs font-bold transition-colors disabled:opacity-60">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                تحميل ({file.downloadsCount})
                              </button>
                              <AutodeskFileButton fileId={file.id} fileName={file.fileName} extension={file.extension} />
                              <ShareButton resourceType="engineering_file" resourceId={file.id} title={file.fileName} label="" />
                            </>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => { setReplaceTarget(file); replaceInputRef.current?.click(); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold transition-colors disabled:opacity-60">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              إعادة رفع
                            </button>
                          )}
                          <button type="button" onClick={() => onDeleteFile(file.id)} title="حذف الملف" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}
