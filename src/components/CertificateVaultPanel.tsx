"use client";

import React, { useRef, useState, useEffect } from "react";
import { CertificateRecord, EngineeringFileRecord } from "@/db/schema";
import {
  FolderOpen,
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
} from "lucide-react";
import {
  downloadStoredFile,
  isContentAvailable,
  openStoredPreview,
} from "@/lib/clientFiles";
import { formatBytes, isImageExtension, isPdfExtension } from "@/lib/engineering";
import { CollapseToggle, useCollapsed } from "./CollapsibleSection";
import { ShareButton } from "./ShareDialog";
import { queueOp } from "@/lib/offlineDb";
import { requestBackgroundSync } from "@/lib/offlineSync";

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}

type CertFile = EngineeringFileRecord & { hasContent?: boolean };

const CATEGORY_OPTIONS = [
  { key: "cad_bim", label: "AutoCAD & Revit BIM" },
  { key: "om_facility", label: "تشغيل وصيانة / مرافق" },
  { key: "safety_pm", label: "سلامة مهنية / إدارة مشاريع" },
  { key: "academic", label: "تأهيل أكاديمي / شهادات خبرة" },
];

export function CertificateVaultPanel({
  certificates,
  certificateFiles,
  onChanged,
  onDeleteFile,
  onNotify,
}: {
  certificates: CertificateRecord[];
  certificateFiles: CertFile[];
  onChanged: () => Promise<void>;
  onDeleteFile: (id: number) => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  const importOpen = useCollapsed("cert-folder-import", true);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("cad_bim");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachTarget, setAttachTarget] = useState<number | null>(null);
  const [attaching, setAttaching] = useState(false);

  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  // Chrome/Edge folder selection: webkitdirectory is not a typed React prop.
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  const notify = (msg: string) => {
    setNotice(msg);
    onNotify?.(msg);
  };

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.size > 0);
    setFiles((prev) => {
      const seen = new Map(prev.map((f) => [`${f.name}-${f.size}`, f]));
      for (const f of incoming) seen.set(`${f.name}-${f.size}`, f);
      return Array.from(seen.values());
    });
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("category", category);
      formData.append("issuer", issuer.trim());
      formData.append("issueDate", issueDate);

      const res = await fetch("/api/certificates/import", {
        credentials: "include",
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "تعذر استيراد الملفات");
      }
      const data = await res.json();
      const count = Number(data.count) || files.length;
      notify(`تم استيراد ${count} ${count === 1 ? "شهادة" : "شهادات"} مع ملفاتها — كل شهادة قابلة للتعديل ✏️`);
      setFiles([]);
      await onChanged();
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "certificate-import",
            label: `استيراد ${files.length} ${files.length === 1 ? "شهادة" : "شهادات"} أوفلاين`,
            method: "POST",
            url: "/api/certificates/import",
            formFields: { category, issuer: issuer.trim(), issueDate },
            files: files.map((f) => ({
              field: "files",
              name: f.name,
              type: f.type || "application/octet-stream",
              blob: f,
            })),
          });
          requestBackgroundSync().catch(() => {});
          notify("💾 الاستيراد محفوظ أوفلاين — هيترفع تلقائياً أول ما النت يرجع");
          setFiles([]);
        } catch {
          notify("تعذر الحفظ أوفلاين — الملفات كبيرة على مساحة المتصفح غالباً");
        }
      } else {
        notify(err instanceof Error ? err.message : "تعذر استيراد الملفات");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttach = async (list: FileList | null) => {
    const certId = attachTarget;
    setAttachTarget(null);
    if (!certId || !list || list.length === 0) return;
    setAttaching(true);
    try {
      const formData = new FormData();
      Array.from(list).forEach((f) => formData.append("files", f));
      formData.append("certificateId", String(certId));
      formData.append("segment", "certificates");
      const res = await fetch("/api/files", { credentials: "include", method: "POST", body: formData });
      if (!res.ok) throw new Error("تعذر إرفاق الملفات بالشهادة");
      await onChanged();
      notify("تم إرفاق الملفات بالشهادة بنجاح ✓");
    } catch (err) {
      if (isOfflineError(err) && list) {
        try {
          const arr = Array.from(list);
          await queueOp({
            kind: "file-upload",
            label: `إرفاق ${arr.length} ${arr.length === 1 ? "ملف" : "ملفات"} لشهادة #${certId} أوفلاين`,
            method: "POST",
            url: "/api/files",
            formFields: { certificateId: String(certId), segment: "certificates" },
            files: arr.map((f) => ({
              field: "files",
              name: f.name,
              type: f.type || "application/octet-stream",
              blob: f,
            })),
          });
          requestBackgroundSync().catch(() => {});
          notify("💾 الإرفاق محفوظ أوفلاين — هيترفع تلقائياً أول ما النت يرجع");
        } catch {
          notify("تعذر الحفظ أوفلاين");
        }
      } else {
        notify(err instanceof Error ? err.message : "تعذر إرفاق الملفات");
      }
    } finally {
      setAttaching(false);
    }
  };

  const grouped = new Map<number, CertFile[]>();
  for (const f of certificateFiles) {
    if (f.certificateId == null) continue;
    const list = grouped.get(f.certificateId) || [];
    list.push(f);
    grouped.set(f.certificateId, list);
  }

  const totalBytes = certificateFiles.reduce((acc, f) => acc + Number(f.sizeBytes || 0), 0);

  return (
    <div className="space-y-4">
      {/* Folder import */}
      <section className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
              <FolderOpen className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                استيراد فولدر الشهادات دفعة واحدة
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                اختَر الفولدر كله أو كل الملفات مرة واحدة — كل ملف = شهادة مستقلة باسمه
              </p>
            </div>
          </div>
          <CollapseToggle open={importOpen.open} onToggle={importOpen.toggle} controls="cert-import-body" />
        </div>

        {importOpen.open && (
          <form id="cert-import-body" onSubmit={handleImport} className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">تصنيف الشهادات</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-[11px] font-semibold text-slate-800 dark:text-slate-200"
                >
                  {CATEGORY_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">الجهة المانحة (تُطبّق على الكل)</label>
                <input
                  type="text"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="مثال: Autodesk / مركز تدريب / جهة الخبرة"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-[11px] text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الإصدار</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <input
              ref={filesInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`rounded-xl border-2 border-dashed p-4 text-center transition-all ${dragOver ? "border-amber-500 bg-amber-100/60 dark:bg-amber-950/40" : "border-amber-300/70 dark:border-amber-800 bg-white/60 dark:bg-slate-900/40"}`}
            >
              <UploadCloud className="w-5 h-5 mx-auto text-amber-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {files.length > 0
                  ? `تم اختيار ${files.length} ملف • ${formatBytes(files.reduce((a, f) => a + f.size, 0))}`
                  : "اسحب ملفات الشهادات هنا (PDF / صور / أي صيغة) أو استخدم الأزرار بالأسفل"}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-amber-700"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  اختيار الفولدر كامل 📁
                </button>
                <button
                  type="button"
                  onClick={() => filesInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-amber-400"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  اختيار ملفات متعددة
                </button>
              </div>
            </div>

            {files.length > 0 && (
              <ul className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                {files.map((f, idx) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-2.5 py-1.5">
                    <span className="min-w-0 flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">{idx + 1}</span>
                      <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate" title={f.name}>{f.name}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">{formatBytes(f.size)}</span>
                      <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))} title="إزالة" className="p-1 rounded text-slate-400 hover:text-rose-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                بعد الاستيراد اضغط ✏️ على أي شهادة لتعديل الاسم أو الجهة أو التاريخ
              </span>
              <button
                type="submit"
                disabled={submitting || files.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {files.length > 0 ? `استيراد ${files.length} ${files.length === 1 ? "شهادة" : "شهادات"}` : "استيراد الشهادات"}
              </button>
            </div>
          </form>
        )}
      </section>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[11px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 hover:underline">إغلاق</button>
        </div>
      )}

      {/* Attached files per certificate */}
      {certificateFiles.length > 0 && (
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
              <Paperclip className="w-3.5 h-3.5 text-amber-600" />
              ملفات الشهادات ({certificateFiles.length} • {formatBytes(totalBytes)})
            </h4>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">محفوظة دائماً — معاينة وتحميل مباشر</span>
          </div>

          <div className="space-y-3">
            {certificates.filter((c) => (grouped.get(c.id) || []).length > 0).map((cert) => (
              <div key={cert.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 truncate max-w-[260px]" title={cert.title}>
                    🏅 {cert.title}
                  </span>
                  <button
                    type="button"
                    disabled={attaching}
                    onClick={() => { setAttachTarget(cert.id); attachInputRef.current?.click(); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600"
                  >
                    <Paperclip className="w-3 h-3" />إرفاق المزيد
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(grouped.get(cert.id) || []).map((f) => {
                    const available = isContentAvailable(f);
                    const previewable = available && (isImageExtension(f.extension) || isPdfExtension(f.extension));
                    const busy = busyFileId === f.id;
                    return (
                      <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-2 py-1.5">
                        <span className="flex min-w-0 items-center gap-2">
                          {available && isImageExtension(f.extension) ? (
                            <button type="button" title="معاينة الصورة" onClick={async () => { const r = await openStoredPreview(`/api/files/${f.id}/preview`, f.fileName); if (!r.ok) notify(r.message); }} className="shrink-0">
                              <img src={`/api/files/${f.id}/preview`} alt={f.fileName} className="h-7 w-7 rounded object-cover" />
                            </button>
                          ) : (
                            <span className="text-slate-400 shrink-0">
                              {isPdfExtension(f.extension) ? <FileText className="w-4 h-4" /> : isImageExtension(f.extension) ? <ImageIcon className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={f.fileName}>{f.fileName}</span>
                            <span className="block font-mono text-[9px] text-slate-400 tabular-nums">{f.sizeFormatted} • {f.uploadedDate}</span>
                          </span>
                        </span>

                        <span className="flex items-center gap-1 shrink-0">
                          {available ? (
                            <>
                              {previewable && (
                                <button type="button" title="معاينة" onClick={async () => { const r = await openStoredPreview(`/api/files/${f.id}/preview`, f.fileName); if (!r.ok) notify(r.message); }} className="rounded p-1.5 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/50">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button type="button" disabled={busy} title="تحميل" onClick={async () => {
                                setBusyFileId(f.id);
                                const r = await downloadStoredFile(`/api/files/${f.id}/download`, f.fileName);
                                setBusyFileId(null);
                                if (!r.ok) notify(r.message); else await onChanged();
                              }} className="rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          ) : (
                            <span title="المحتوى غير متاح — احذف الملف وأعد رفعه" className="text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /></span>
                          )}
                          <ShareButton resourceType="engineering_file" resourceId={f.id} title={f.fileName} label="" className="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50" />
                          <button type="button" disabled={busy} title="حذف الملف" onClick={async () => { setBusyFileId(f.id); await onDeleteFile(f.id); setBusyFileId(null); await onChanged(); }} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <input
        ref={attachInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { handleAttach(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
