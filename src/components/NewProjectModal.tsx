"use client";

import React, { useState, useRef } from "react";
import { X, Compass, Star, UploadCloud, Paperclip, Loader2 } from "lucide-react";
import { formatBytes, normalizeExtension } from "@/lib/engineering";

export function NewProjectModal({
  isOpen,
  onClose,
  onCreateProject,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (
    payload: Record<string, unknown>,
    files: File[]
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [clientOrSite, setClientOrSite] = useState("");
  const [segment, setSegment] = useState("revit");
  const [discipline, setDiscipline] = useState("Revit BIM - معماري وMEP");
  const [software, setSoftware] = useState("Revit 2025 + AutoCAD 2025");
  const [status, setStatus] = useState("in_progress");
  const [priority, setPriority] = useState("high");
  const [progress, setProgress] = useState("45");
  const [sheetsCount, setSheetsCount] = useState("24");
  const [hoursLogged, setHoursLogged] = useState("40");
  const [location, setLocation] = useState("القاهرة الجديدة");
  const [isSample, setIsSample] = useState(true);
  const [sampleSummary, setSampleSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Project attachments (uploaded together with the project on save)
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [`${f.name}-${f.size}`, f]));
      for (const f of incoming) {
        map.set(`${f.name}-${f.size}`, f);
      }
      return Array.from(map.values());
    });
  };

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientOrSite.trim()) return;
    setSubmitting(true);
    try {
      await onCreateProject(
        {
          title: title.trim(),
          clientOrSite: clientOrSite.trim(),
          segment,
          discipline: discipline.trim(),
          software: software.trim(),
          status,
          priority,
          progress: Number(progress) || 0,
          sheetsCount: Number(sheetsCount) || 10,
          hoursLogged: Number(hoursLogged) || 12,
          location: location.trim(),
          isSample,
          sampleSummary: sampleSummary.trim(),
        },
        files
      );
      setTitle("");
      setClientOrSite("");
      setSampleSummary("");
      setFiles([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                إضافة مشروع هندسي أو مهمة عمل متوازية
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                سجّل المشروع وارفع ملفاته في خطوة واحدة — هتلاقيهم مربوطين بيه في سجل المشاريع
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                اسم المشروع / المهمة الهندسية *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: لوحات شوب دروينج تكييف مركزي + موديل ريفيت LOD 350"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                العميل أو اسم الموقع *
              </label>
              <input
                type="text"
                required
                value={clientOrSite}
                onChange={(e) => setClientOrSite(e.target.value)}
                placeholder="مثال: شركة النخيل للمقاولات / مستشفى السلام"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المسار الرئيسي
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="autocad">رسومات أوتوكاد (AutoCAD)</option>
                <option value="revit">نمذجة ريفيت (Revit BIM)</option>
                <option value="om">التشغيل والصيانة (O&M)</option>
                <option value="parallel">مشروع متوازي متعدد المهام</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                التخصص الدقيق
              </label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                البرامج المستخدمة
              </label>
              <input
                type="text"
                value={software}
                onChange={(e) => setSoftware(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الحالة الحالية
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="in_progress">قيد التنفيذ</option>
                <option value="review">مراجعة واعتماد</option>
                <option value="completed">مكتمل ومسلّم</option>
                <option value="on_hold">متوقف مؤقتاً</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الأولوية
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="urgent">عاجل</option>
                <option value="high">أولوية عالية</option>
                <option value="normal">قياسي</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الإنجاز %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                عدد اللوحات
              </label>
              <input
                type="number"
                min="0"
                value={sheetsCount}
                onChange={(e) => setSheetsCount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ساعات العمل المقدرة/المنجزة
              </label>
              <input
                type="number"
                min="0"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المدينة / الموقع الجغرافي
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Project files upload zone */}
          <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4" />
                ملفات المشروع (اختياري) — هتتربط بيه في سجل المشاريع
              </span>
              {files.length > 0 && (
                <span className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                  {files.length} ملف • {formatBytes(totalBytes)}
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
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
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              className={`w-full rounded-xl border-2 border-dashed px-4 py-4 text-center transition-all ${
                dragOver
                  ? "border-blue-500 bg-blue-100/60 dark:bg-blue-950/40"
                  : "border-blue-300/70 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white/60 dark:bg-slate-900/40"
              }`}
            >
              <UploadCloud className="w-5 h-5 mx-auto text-blue-500 mb-1" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                اسحب ملفات المشروع هنا أو اضغط للاختيار
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                DWG / DXF / RVT / IFC / PDF / PNG / JPG / SVG / XLSX / ZIP — أي صيغة وأي حجم، مجاناً
              </div>
            </button>

            {files.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${f.size}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                        {normalizeExtension(f.name).replace(".", "")}
                      </span>
                      <span
                        className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate"
                        title={f.name}
                      >
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                        {formatBytes(f.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        title="إزالة الملف من القائمة"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                إدراج المشروع ضمن &quot;عينات الشغل الجاهزة للعملاء&quot;
              </span>
              <input
                type="checkbox"
                checked={isSample}
                onChange={(e) => setIsSample(e.target.checked)}
                className="rounded text-amber-600"
              />
            </label>
            {isSample && (
              <input
                type="text"
                value={sampleSummary}
                onChange={(e) => setSampleSummary(e.target.value)}
                placeholder="ملخص احترافي يظهر للعميل عند مشاركة العينة..."
                className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
              />
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {files.length > 0
                    ? `جاري حفظ المشروع ورفع ${files.length} ${
                        files.length === 1 ? "ملف" : "ملفات"
                      }...`
                    : "جاري الحفظ..."}
                </>
              ) : files.length > 0 ? (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  حفظ المشروع ورفع {files.length}{" "}
                  {files.length === 1 ? "ملف" : "ملفات"}
                </>
              ) : (
                "حفظ وإضافة للداشبورد"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
