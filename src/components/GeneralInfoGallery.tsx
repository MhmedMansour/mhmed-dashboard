"use client";

import React, { useState, useRef } from "react";
import { GeneralInfoRecord } from "@/db/schema";
import {
  Images,
  FileText,
  StickyNote,
  Plus,
  X,
  UploadCloud,
  Trash2,
  Loader2,
  Sparkles,
  Pencil,
  Check,
  RefreshCw,
} from "lucide-react";
import { CollapseToggle, useCollapsed } from "./CollapsibleSection";
import { ShareButton } from "./ShareDialog";
import { openStoredPreview } from "@/lib/clientFiles";
import { formatBytes } from "@/lib/engineering";
import { queueOp } from "@/lib/offlineDb";
import { requestBackgroundSync } from "@/lib/offlineSync";

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Failed to fetch") || msg.includes("NetworkError");
}

const inputCls =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500";

export function GeneralInfoGallery({
  items,
  onChanged,
}: {
  items: GeneralInfoRecord[];
  onChanged: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<GeneralInfoRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Inline edit state (one card at a time)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const galleryOpen = useCollapsed("general-info", true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.size > 0);
    setFiles((prev) => {
      const seen = new Map(prev.map((f) => [`${f.name}-${f.size}`, f]));
      for (const f of incoming) seen.set(`${f.name}-${f.size}`, f);
      return Array.from(seen.values());
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      files.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/general-info", {
        credentials: "include",
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "تعذر حفظ البطاقة");
      }
      const data = await res.json();
      const count = Array.isArray(data.items) ? data.items.length : 1;
      setNotice(
        files.length > 1
          ? `تمت إضافة ${count} بطاقات (ملف لكل بطاقة) بنفس العنوان والوصف.`
          : "تمت إضافة البطاقة بنجاح."
      );
      setTitle("");
      setDescription("");
      setFiles([]);
      setShowAdd(false);
      await onChanged();
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "general-info-create",
            label: `إضافة بطاقة معلومات: ${title.trim()}`,
            method: "POST",
            url: "/api/general-info",
            formFields: { title: title.trim(), description: description.trim() },
            files: files.map((f) => ({
              field: "files",
              name: f.name,
              type: f.type || "application/octet-stream",
              blob: f,
            })),
          });
          requestBackgroundSync().catch(() => {});
          setNotice("💾 البطاقة محفوظة أوفلاين — هتترفع تلقائياً أول ما النت يرجع");
          setTitle("");
          setDescription("");
          setFiles([]);
          setShowAdd(false);
        } catch {
          setNotice("تعذر الحفظ أوفلاين");
        }
      } else {
        setNotice(err instanceof Error ? err.message : "تعذر حفظ البطاقة");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: GeneralInfoRecord) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description || "");
    setEditFile(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFile(null);
  };

  const saveEdit = async (item: GeneralInfoRecord) => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle.trim());
      formData.append("description", editDescription.trim());
      if (editFile) formData.append("file", editFile);
      const res = await fetch(`/api/general-info/${item.id}`, {
        credentials: "include",
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "تعذر حفظ التعديل");
      }
      setNotice("تم حفظ تعديل البطاقة ✓");
      cancelEdit();
      await onChanged();
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "general-info-update",
            label: `تعديل بطاقة معلومات: ${editTitle.trim() || `#${item.id}`}`,
            method: "PATCH",
            url: `/api/general-info/${item.id}`,
            formFields: { title: editTitle.trim(), description: editDescription.trim() },
            files: editFile
              ? [{ field: "file", name: editFile.name, type: editFile.type || "application/octet-stream", blob: editFile }]
              : [],
          });
          requestBackgroundSync().catch(() => {});
          setNotice("💾 التعديل محفوظ أوفلاين — هيترفع تلقائياً أول ما النت يرجع");
          cancelEdit();
        } catch {
          setNotice("تعذر الحفظ أوفلاين");
        }
      } else {
        setNotice(err instanceof Error ? err.message : "تعذر حفظ التعديل");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/general-info/${id}`, { credentials: "include", method: "DELETE" });
      if (!res.ok && res.status >= 500) throw new Error("server");
      if (editingId === id) cancelEdit();
      await onChanged();
    } catch (err) {
      if (isOfflineError(err)) {
        try {
          await queueOp({
            kind: "general-info-delete",
            label: `حذف بطاقة معلومات #${id}`,
            method: "DELETE",
            url: `/api/general-info/${id}`,
          });
          requestBackgroundSync().catch(() => {});
          setNotice("💾 الحذف محفوظ أوفلاين — هيتنفذ أول ما النت يرجع");
          if (editingId === id) cancelEdit();
        } catch {
          setNotice("تعذر الحفظ أوفلاين");
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const totalSelectedBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-950/70 dark:text-pink-400">
              <Images className="w-4 h-4" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              المعلومات العامة والمرفقات ({items.length})
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            صور، ملفات PDF، وملاحظات عامة — اضغط ✏️ لتعديل أي بطاقة، أو على الصورة/الملف لمعاينته
          </p>
        </div>

        <div className="flex items-center gap-2">
          {galleryOpen.open && (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAdd ? "إلغاء" : "إضافة صور / PDF / ملاحظة"}
            </button>
          )}
          <CollapseToggle open={galleryOpen.open} onToggle={galleryOpen.toggle} controls="general-info-body" />
        </div>
      </div>

      {galleryOpen.open && (
        <div id="general-info-body">
          {showAdd && (
            <form
              onSubmit={handleSubmit}
              className="mb-5 p-4 rounded-2xl border border-pink-200/80 dark:border-pink-900/60 bg-pink-50/40 dark:bg-pink-950/20 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان البطاقة *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: صور من مشروع جامعة الأميرة نورة"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الوصف / المعلومات العامة
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="وصف مختصر يظهر تحت الصورة أو الملف"
                    className={inputCls}
                  />
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`w-full rounded-xl border-2 border-dashed px-4 py-3.5 text-center transition-all ${
                  dragOver
                    ? "border-pink-500 bg-pink-100/60 dark:bg-pink-950/40"
                    : "border-pink-300/70 dark:border-pink-800 hover:border-pink-400 bg-white/60 dark:bg-slate-900/40"
                }`}
              >
                <UploadCloud className="w-5 h-5 mx-auto text-pink-500 mb-1" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {files.length > 0
                    ? `تم اختيار ${files.length} ${files.length === 1 ? "ملف" : "ملفات"} • ${formatBytes(totalSelectedBytes)} — اضغط لإضافة المزيد`
                    : "اسحب صور أو ملفات PDF هنا (أكثر من ملف معاً) أو اضغط للاختيار — بدون ملفات تُحفظ كملاحظة"}
                </div>
                {files.length > 1 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    كل ملف هيتحفظ كبطاقة مستقلة بنفس العنوان والوصف ومرقّمة تلقائياً
                  </div>
                )}
              </button>

              {files.length > 0 && (
                <ul className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5">
                  {files.map((f, idx) => (
                    <li
                      key={`${f.name}-${f.size}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate" title={f.name}>
                          {f.name}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                          title="إزالة من القائمة"
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setFiles([]);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : files.length > 1 ? (
                    `حفظ ${files.length} بطاقات`
                  ) : (
                    "حفظ البطاقة"
                  )}
                </button>
              </div>
            </form>
          )}

          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <Sparkles className="w-5 h-5 mx-auto text-slate-400 mb-2" />
              ابدأ بإضافة صور أو ملفات PDF أو ملاحظات عامة لتظهر هنا مباشرة
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`group rounded-2xl border overflow-hidden flex flex-col transition-colors ${
                      isEditing
                        ? "border-pink-400 dark:border-pink-700 bg-pink-50/40 dark:bg-pink-950/20 ring-2 ring-pink-500/15"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:border-pink-300 dark:hover:border-pink-800"
                    }`}
                  >
                    {item.mediaType === "image" && item.storagePath ? (
                      <button
                        type="button"
                        onClick={() => setLightbox(item)}
                        className="relative block h-40 overflow-hidden bg-slate-100 dark:bg-slate-800"
                      >
                        <img
                          src={`/api/general-info/${item.id}/preview`}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-bold">
                          اضغط للمعاينة
                        </span>
                      </button>
                    ) : item.mediaType === "pdf" && item.storagePath ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await openStoredPreview(
                            `/api/general-info/${item.id}/preview`,
                            item.fileName || item.title
                          );
                          if (!result.ok) setNotice(result.message);
                        }}
                        className="flex w-full items-center justify-center h-40 bg-gradient-to-br from-rose-500/10 to-pink-600/10 border-b border-slate-200 dark:border-slate-800"
                      >
                        <div className="text-center">
                          <FileText className="w-10 h-10 mx-auto text-rose-600 dark:text-rose-400" />
                          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 mt-1.5">فتح ملف PDF</div>
                          {item.sizeFormatted && (
                            <div className="text-[10px] font-mono text-slate-500">{item.sizeFormatted}</div>
                          )}
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <StickyNote className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}

                    {isEditing ? (
                      <div className="p-4 flex-1 flex flex-col gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم / العنوان *</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">الوصف</label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            className={`${inputCls} resize-y`}
                          />
                        </div>
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            setEditFile(e.target.files?.[0] ?? null);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-pink-300 dark:border-pink-800 px-2.5 py-2 text-[11px] font-bold text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/40"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {editFile ? `سيُستبدل بـ: ${editFile.name}` : item.fileName ? "استبدال الصورة / الملف (اختياري)" : "إرفاق صورة أو PDF (اختياري)"}
                        </button>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit || !editTitle.trim()}
                            onClick={() => saveEdit(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white text-[11px] font-bold"
                          >
                            {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            حفظ التعديل
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 flex-1 flex flex-col">
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{item.title}</h4>
                          {item.description && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5 line-clamp-3">
                              {item.description}
                            </p>
                          )}
                          {item.fileName && (
                            <div className="mt-auto pt-2 font-mono text-[10px] text-slate-400 truncate" title={item.fileName}>
                              📎 {item.fileName}
                            </div>
                          )}
                        </div>

                        <div className="px-4 pb-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            title="تعديل الاسم أو الوصف أو استبدال الملف"
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-300 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            تعديل
                          </button>
                          <ShareButton
                            resourceType="general_info"
                            resourceId={item.id}
                            title={item.title}
                            label="مشاركة"
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 transition-colors"
                          />
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleDelete(item.id)}
                            title="حذف البطاقة"
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
                          >
                            {busyId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            حذف
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {notice && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 hover:underline">إغلاق</button>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl w-full">
            <img
              src={`/api/general-info/${lightbox.id}/preview`}
              alt={lightbox.title}
              className="w-full max-h-[80vh] object-contain rounded-2xl"
            />
            <div className="mt-3 text-center">
              <div className="text-white text-sm font-extrabold">{lightbox.title}</div>
              {lightbox.description && (
                <div className="text-slate-300 text-xs mt-1 max-w-2xl mx-auto">{lightbox.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-2 -right-2 p-2.5 rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
